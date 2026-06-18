import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TEXT_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_VISION_MODEL = 'google/gemini-2.5-flash';
// Nano Banana — sinh ảnh thử đồ qua OpenRouter (đầu vào ảnh người + ảnh sản phẩm)
const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string | null;
  private readonly textModel: string;
  private readonly visionModel: string;
  private readonly imageModel: string;
  /**
   * Trần token cho request sinh ảnh. OpenRouter từ chối (402) nếu max_tokens vượt
   * số dư khả dụng của key — cap nhỏ để vừa ngân sách. 1 ảnh ~1300 token.
   */
  private readonly imageMaxTokens: number;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim() || null;
    this.textModel =
      this.config.get<string>('OPENROUTER_TEXT_MODEL')?.trim() || DEFAULT_TEXT_MODEL;
    this.visionModel =
      this.config.get<string>('OPENROUTER_VISION_MODEL')?.trim() || DEFAULT_VISION_MODEL;
    this.imageModel =
      this.config.get<string>('OPENROUTER_IMAGE_MODEL')?.trim() || DEFAULT_IMAGE_MODEL;
    this.imageMaxTokens = Number(this.config.get('OPENROUTER_IMAGE_MAX_TOKENS') ?? 4096);
    this.enabled = Boolean(this.apiKey);
    if (!this.enabled) {
      this.logger.warn('OPENROUTER_API_KEY chưa cấu hình — dùng lời tư vấn mặc định');
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async fetchImageFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) return null;
      return { buffer, mimeType };
    } catch (err) {
      this.logger.warn(
        `Fetch image failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async generateAdvice(prompt: string): Promise<string | null> {
    if (!this.apiKey) return null;
    return this.requestChatCompletion({
      model: this.textModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.4,
    });
  }

  async generateAdviceWithImage(
    prompt: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string | null> {
    if (!this.apiKey) return null;
    const safeMime = sanitizeMime(mimeType);
    const dataUrl = `data:${safeMime};base64,${imageBuffer.toString('base64')}`;

    return this.requestChatCompletion({
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0.4,
    });
  }

  async generateAdviceWithImageUrl(prompt: string, imageUrl: string): Promise<string | null> {
    const image = await this.fetchImageFromUrl(imageUrl);
    if (!image) return this.generateAdvice(prompt);
    return this.generateAdviceWithImage(prompt, image.buffer, image.mimeType);
  }

  /**
   * Sinh ảnh thử đồ bằng Gemini image (Nano Banana) qua OpenRouter.
   * Đầu vào: ảnh người (bắt buộc) + ảnh sản phẩm (khuyến nghị). Trả về ảnh PNG
   * ngay trong response (không cần polling như Replicate).
   */
  async generateTryOnImage(
    prompt: string,
    images: { buffer: Buffer; mimeType: string }[],
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY chưa cấu hình — bỏ qua dựng ảnh try-on');
      return null;
    }
    if (!images.length) {
      this.logger.warn('generateTryOnImage skipped — cần tối thiểu 1 ảnh người');
      return null;
    }

    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [{ type: 'text', text: prompt }];

    for (const img of images) {
      const safeMime = sanitizeMime(img.mimeType);
      content.push({
        type: 'image_url',
        image_url: { url: `data:${safeMime};base64,${img.buffer.toString('base64')}` },
      });
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.imageModel,
          messages: [{ role: 'user', content }],
          modalities: ['image', 'text'],
          max_tokens: this.imageMaxTokens,
        }),
      });

      const data = (await res.json()) as {
        choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
        error?: { message?: string };
      };

      if (!res.ok) {
        this.logger.warn(
          `OpenRouter image ${this.imageModel} HTTP ${res.status}: ${data.error?.message ?? res.statusText}`,
        );
        return null;
      }

      const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!dataUrl) {
        this.logger.warn(`OpenRouter image ${this.imageModel}: response không có ảnh`);
        return null;
      }

      return dataUrlToBuffer(dataUrl);
    } catch (err) {
      this.logger.warn(
        `OpenRouter image ${this.imageModel} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async requestChatCompletion(input: {
    model: string;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
          >;
    }>;
    max_tokens: number;
    temperature: number;
  }): Promise<string | null> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          max_tokens: input.max_tokens,
          temperature: input.temperature,
        }),
      });

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };

      if (!res.ok) {
        this.logger.warn(
          `OpenRouter ${input.model} HTTP ${res.status}: ${data.error?.message ?? res.statusText}`,
        );
        return null;
      }

      const content = data.choices?.[0]?.message?.content;
      return typeof content === 'string' && content.trim() ? content.trim() : null;
    } catch (err) {
      this.logger.warn(
        `OpenRouter ${input.model} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

function sanitizeMime(mimeType: string): string {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg';
}

/** Parse `data:image/png;base64,xxxx` → buffer + mime. */
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = sanitizeMime(match[1]);
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;
  return { buffer, mimeType };
}
