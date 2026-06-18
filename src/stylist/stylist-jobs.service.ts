import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductsService } from '../products/products.service';
import { SizeChartsService } from '../size-charts/size-charts.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateStylistJobDto } from './dto/create-stylist-job.dto';
import { RecommendSizeDto } from './dto/recommend-size.dto';
import { GeminiService } from './gemini.service';
import {
  buildFallbackAdvice,
  recommendSize,
  type MeasurementInput,
} from './recommend-size.util';
import {
  StylistJob,
  StylistJobDocument,
} from './schemas/stylist-job.schema';

export interface StylistRecommendationResult {
  productId: string;
  productTitle: string;
  sizeChartId: string;
  sizeChartName: string;
  measurements: MeasurementInput;
  recommendedSize: string;
  alternateSize?: string;
  confidence: 'high' | 'medium' | 'low';
  scoreGap: number;
  recommendedInStock: boolean;
  advice: string;
  aiEnabled: boolean;
  photoUploaded?: boolean;
  userPhotoUrl?: string;
  generatedImageUrl?: string;
  tryOnImageGenerated?: boolean;
  disclaimer: string;
}

@Injectable()
export class StylistJobsService {
  private readonly logger = new Logger(StylistJobsService.name);

  constructor(
    @InjectModel(StylistJob.name)
    private readonly jobModel: Model<StylistJobDocument>,
    private readonly products: ProductsService,
    private readonly sizeCharts: SizeChartsService,
    private readonly gemini: GeminiService,
    private readonly uploads: UploadsService,
  ) {}

  assertAllowedPhotoUrl(url: string) {
    const normalized = url.split('?')[0].trim();
    if (!normalized) {
      throw new BadRequestException('URL ảnh không hợp lệ');
    }

    try {
      const key = new URL(normalized).pathname.replace(/^\//, '');
      if (key.startsWith('store/stylist/')) return;
    } catch {
      /* fall through */
    }

    const publicBase = this.uploads.getPublicBaseUrl()?.replace(/\/$/, '');
    if (publicBase && normalized.startsWith(`${publicBase}/`)) return;

    throw new BadRequestException('URL ảnh không hợp lệ — phải từ kho ảnh Thiên Nga');
  }

  async createJob(dto: CreateStylistJobDto) {
    this.assertAllowedPhotoUrl(dto.userPhotoUrl);

    const job = await this.jobModel.create({
      status: 'queued',
      progress: 5,
      message: 'Đã nhận yêu cầu, đang xếp hàng…',
      productId: dto.productId,
      productSlug: dto.productSlug,
      userPhotoUrl: dto.userPhotoUrl,
      measurements: {
        height: dto.height,
        bust: dto.bust,
        waist: dto.waist,
        hip: dto.hip,
      },
    });

    void this.runJob(String(job._id));

    return {
      jobId: String(job._id),
      status: job.status,
      progress: job.progress,
      message: job.message,
    };
  }

  async getJob(jobId: string) {
    const job = await this.jobModel.findById(jobId).lean();
    if (!job) {
      throw new NotFoundException('Không tìm thấy job');
    }

    return {
      id: String(job._id),
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result ?? null,
      error: job.error ?? null,
    };
  }

  private async patchJob(
    jobId: string,
    patch: Partial<
      Pick<
        StylistJob,
        | 'status'
        | 'progress'
        | 'message'
        | 'result'
        | 'error'
        | 'tryOnPredictionId'
        | 'tryOnStatus'
        | 'tryOnResultUrl'
      >
    >,
  ) {
    await this.jobModel.findByIdAndUpdate(jobId, patch);
  }

  private async runJob(jobId: string) {
    const job = await this.jobModel.findById(jobId);
    if (!job) return;

    const dto: RecommendSizeDto = {
      productId: job.productId,
      productSlug: job.productSlug,
      height: job.measurements.height,
      bust: job.measurements.bust,
      waist: job.measurements.waist,
      hip: job.measurements.hip,
    };

    try {
      await this.patchJob(jobId, {
        status: 'processing_size',
        progress: 20,
        message: 'Đang tính size phù hợp…',
      });

      const sized = await this.buildRecommendation(dto, job.userPhotoUrl, { skipAdvice: true });

      await this.patchJob(jobId, {
        status: 'consulting_ai',
        progress: 50,
        message: 'AI đang phân tích ảnh & số đo…',
      });

      const withAdvice = await this.buildRecommendation(dto, job.userPhotoUrl, {
        skipAdvice: false,
        sizeResult: sized,
      });

      await this.patchJob(jobId, {
        status: 'generating_image',
        progress: 78,
        message: 'Đang dựng hình thử đồ AI…',
      });

      const generatedImageUrl = await this.generateAndUploadTryOn(
        jobId,
        withAdvice.productTitle,
        job.userPhotoUrl,
        job.productId,
        job.measurements,
      );

      const result: StylistRecommendationResult = {
        ...withAdvice,
        photoUploaded: true,
        userPhotoUrl: job.userPhotoUrl,
        generatedImageUrl: generatedImageUrl ?? undefined,
        tryOnImageGenerated: Boolean(generatedImageUrl),
      };

      await this.patchJob(jobId, {
        status: 'completed',
        progress: 100,
        message: generatedImageUrl
          ? 'Hoàn tất — ảnh thử đồ đã sẵn sàng'
          : 'Hoàn tất gợi ý size — dựng hình AI chưa khả dụng, xem ảnh gốc',
        result: result as unknown as Record<string, unknown>,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Xử lý thất bại';
      this.logger.error(`Stylist job ${jobId} failed: ${message}`);
      await this.patchJob(jobId, {
        status: 'failed',
        progress: 100,
        message: 'Không thể hoàn tất tư vấn',
        error: message,
      });
    }
  }

  async buildRecommendation(
    dto: RecommendSizeDto,
    userPhotoUrl?: string,
    options?: {
      skipAdvice?: boolean;
      sizeResult?: StylistRecommendationResult;
    },
  ): Promise<StylistRecommendationResult> {
    if (options?.sizeResult && !options.skipAdvice) {
      const imagePrompt = [
        'Bạn là stylist thời trang công sở Thiên Nga. Viết 2-3 câu tiếng Việt, thân thiện, chuyên nghiệp.',
        'Giải thích vì sao size gợi ý phù hợp với số đo khách. Không bịa thêm size khác ngoài dữ liệu.',
        'Kết thúc nhắc đây là gợi ý tham khảo.',
        '',
        `Sản phẩm: ${options.sizeResult.productTitle}`,
        `Size gợi ý: ${options.sizeResult.recommendedSize}`,
        userPhotoUrl ? `Ảnh khách hàng: ${userPhotoUrl}` : '',
        '',
        'Khách có gửi ảnh toàn thân. Nếu quan sát được dáng/người, điều chỉnh lời tư vấn nhẹ (không chẩn đoán y tế).',
      ]
        .filter(Boolean)
        .join('\n');

      let aiAdvice: string | null = null;
      if (userPhotoUrl) {
        aiAdvice = await this.gemini.generateAdviceWithImageUrl(imagePrompt, userPhotoUrl);
      }
      if (!aiAdvice) {
        aiAdvice = await this.gemini.generateAdvice(imagePrompt);
      }

      return {
        ...options.sizeResult,
        advice: aiAdvice ?? options.sizeResult.advice,
        aiEnabled: Boolean(aiAdvice),
        userPhotoUrl,
        photoUploaded: Boolean(userPhotoUrl),
      };
    }
    let product;
    try {
      product = await this.products.findByProductId(dto.productId);
    } catch {
      if (dto.productSlug) {
        product = await this.products.findBySlug(dto.productSlug);
      } else {
        throw new NotFoundException('Không tìm thấy sản phẩm');
      }
    }

    const sizeChart = await this.sizeCharts.resolveForProduct(
      product.sizeChartId,
      product.categorySlug,
    );

    if (!sizeChart.rows?.length) {
      throw new BadRequestException('Sản phẩm chưa có bảng size');
    }

    const measurements: MeasurementInput = {
      height: dto.height,
      bust: dto.bust,
      waist: dto.waist,
      hip: dto.hip,
    };

    const availableSizes = (product.sizes ?? [])
      .filter((s) => s.available !== false)
      .map((s) => s.size);

    const recommendation = recommendSize(measurements, sizeChart.rows, availableSizes);
    const recommendedAvailable = availableSizes.some(
      (s) => s.toUpperCase() === recommendation.recommendedSize.toUpperCase(),
    );

    const fallbackAdvice = buildFallbackAdvice(product.title, measurements, recommendation);

    const prompt = [
      'Bạn là stylist thời trang công sở Thiên Nga. Viết 2-3 câu tiếng Việt, thân thiện, chuyên nghiệp.',
      'Giải thích vì sao size gợi ý phù hợp với số đo khách. Không bịa thêm size khác ngoài dữ liệu.',
      'Kết thúc nhắc đây là gợi ý tham khảo.',
      '',
      `Sản phẩm: ${product.title}`,
      `Chất liệu / fit: ${product.material || '—'}${product.fit ? ` · ${product.fit}` : ''}`,
      `Bảng size: ${sizeChart.name}`,
      `Số đo khách: cao ${measurements.height}cm, ngực ${measurements.bust}cm, eo ${measurements.waist}cm, hông ${measurements.hip}cm`,
      `Size gợi ý: ${recommendation.recommendedSize} (độ tin cậy: ${recommendation.confidence})`,
      recommendation.alternateSize
        ? `Size thay thế nếu muốn thoải mái hơn: ${recommendation.alternateSize}`
        : '',
      `Size còn hàng: ${availableSizes.join(', ') || 'không rõ'}`,
      userPhotoUrl ? `Ảnh khách hàng: ${userPhotoUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const base: StylistRecommendationResult = {
      productId: product.id,
      productTitle: product.title,
      sizeChartId: sizeChart.id,
      sizeChartName: sizeChart.name,
      measurements,
      recommendedSize: recommendation.recommendedSize,
      alternateSize: recommendation.alternateSize,
      confidence: recommendation.confidence,
      scoreGap: recommendation.scoreGap,
      recommendedInStock: recommendedAvailable,
      advice: fallbackAdvice,
      aiEnabled: false,
      disclaimer:
        'Gợi ý mang tính tham khảo dựa trên số đo và bảng size Thiên Nga. Vui lòng kiểm tra bảng size trước khi đặt.',
    };

    if (options?.skipAdvice) {
      return base;
    }

    const imagePrompt = [
      prompt,
      '',
      'Khách có gửi ảnh toàn thân (URL ở trên). Nếu quan sát được dáng/người, điều chỉnh lời tư vấn nhẹ (không chẩn đoán y tế).',
    ].join('\n');

    let aiAdvice: string | null = null;
    if (userPhotoUrl) {
      aiAdvice = await this.gemini.generateAdviceWithImageUrl(imagePrompt, userPhotoUrl);
    }
    if (!aiAdvice) {
      aiAdvice = await this.gemini.generateAdvice(prompt);
    }

    return {
      ...base,
      advice: aiAdvice ?? fallbackAdvice,
      aiEnabled: Boolean(aiAdvice),
      userPhotoUrl,
      photoUploaded: Boolean(userPhotoUrl),
    };
  }

  private async generateAndUploadTryOn(
    jobId: string,
    productTitle: string,
    userPhotoUrl: string,
    productId: string,
    measurements?: MeasurementInput,
  ): Promise<string | null> {
    if (!this.uploads.isConfigured()) return null;

    const userImage = await this.gemini.fetchImageFromUrl(userPhotoUrl);
    if (!userImage) return null;

    let product;
    try {
      product = await this.products.findByProductId(productId);
    } catch {
      return null;
    }

    // IMAGE 1 = ảnh user (chỉ lấy mặt), IMAGE 2 = ảnh sản phẩm (tái tạo bộ đồ)
    const images = [userImage];
    const garmentUrl = product.tryOnImage || product.image;
    if (garmentUrl) {
      const productImage = await this.gemini.fetchImageFromUrl(garmentUrl);
      if (productImage) images.push(productImage);
    }

    // Dòng số đo → dựng dáng người tương đối giống khách (nếu có)
    const bodyLine =
      measurements &&
      measurements.height &&
      measurements.bust &&
      measurements.waist &&
      measurements.hip
        ? `Give the model natural, realistic female body proportions approximately: height ${measurements.height}cm, bust ${measurements.bust}cm, waist ${measurements.waist}cm, hip ${measurements.hip}cm.`
        : 'Give the model natural, realistic female body proportions.';

    const prompt = [
      'You are a professional fashion lookbook image generator.',
      'IMAGE 1 is a real person — use ONLY their face and head (facial features, hairstyle, skin tone). Do NOT copy their clothing, body or background.',
      'IMAGE 2 is a clothing product photographed flat (flat-lay). Reproduce this exact outfit faithfully: colors, pattern, cut and details. Ignore the hanger, tags, floor and any background objects.',
      `TASK: generate ONE photorealistic full-body fashion lookbook photo of a female model WEARING this exact outfit ("${productTitle}"), with the FACE of the person from IMAGE 1.`,
      bodyLine,
      'Standing relaxed pose, full body visible head to toe, soft studio lighting, clean light-grey seamless background, premium fashion lookbook quality.',
      'No text, no price tags, no hanger, no watermark.',
    ].join('\n');

    await this.patchJob(jobId, { tryOnStatus: 'processing' });

    const generated = await this.gemini.generateTryOnImage(prompt, images);
    if (!generated) {
      await this.patchJob(jobId, { tryOnStatus: 'failed' });
      return null;
    }

    try {
      const uploaded = await this.uploads.uploadBuffer(
        generated.buffer,
        generated.mimeType,
        'stylist',
        'try-on.png',
      );
      await this.patchJob(jobId, {
        tryOnStatus: 'succeeded',
        tryOnResultUrl: uploaded.url,
      });
      return uploaded.url;
    } catch (err) {
      await this.patchJob(jobId, { tryOnStatus: 'failed' });
      this.logger.warn(
        `Try-on upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
