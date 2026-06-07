import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { extname } from 'path';

export type UploadFolder = 'products' | 'categories' | 'misc';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Giá trị mẫu trong AWS docs — không gọi S3 với key này */
const PLACEHOLDER_ACCESS_KEY_IDS = new Set(['AKIAIOSFODNN7EXAMPLE']);

@Injectable()
export class UploadsService {
  private readonly client: S3Client | null;
  private readonly configMessage: string | null;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly publicBase: string;
  private readonly maxBytes: number;
  private readonly allowedMime: Set<string>;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION')?.trim();
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID')?.trim();
    console.log('accessKeyId', accessKeyId);
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY')?.trim();
    this.bucket = this.config.get<string>('S3_BUCKET_NAME') ?? '';
    this.prefix = (this.config.get<string>('S3_UPLOAD_PREFIX') ?? 'store').replace(
      /^\/|\/$/g,
      ''
    );
    const cdnBase = this.config.get<string>('S3_CDN_BASE_URL')?.replace(/\/$/, '');
    const publicBase = this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '') ?? '';
    this.publicBase = cdnBase || publicBase;

    this.maxBytes = Number(this.config.get('UPLOAD_MAX_BYTES') ?? DEFAULT_MAX_BYTES);
    const mimeList =
      this.config.get<string>('UPLOAD_ALLOWED_MIME')?.split(',').map((s) => s.trim()) ??
      DEFAULT_MIMES;
    this.allowedMime = new Set(mimeList.filter(Boolean));

    if (!region || !accessKeyId || !secretAccessKey || !this.bucket || !this.publicBase) {
      this.client = null;
      this.configMessage =
        'Thiếu biến môi trường: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, S3_PUBLIC_BASE_URL trong backend/.env';
    } else if (isPlaceholderAwsCredentials(accessKeyId, secretAccessKey)) {
      this.client = null;
      this.configMessage =
        'AWS key đang là giá trị mẫu (AKIAIOSFODNN7EXAMPLE). Tạo IAM Access Key thật và ghi vào backend/.env, rồi restart API.';
    } else {
      this.client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.configMessage = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getStatus(): { configured: boolean; message: string; publicBaseUrl?: string } {
    if (this.client) {
      return {
        configured: true,
        message: 'S3 upload sẵn sàng',
        publicBaseUrl: this.publicBase,
      };
    }
    return {
      configured: false,
      message:
        this.configMessage ??
        'S3 chưa cấu hình. Kiểm tra AWS_* và S3_* trong backend/.env',
    };
  }

  async upload(
    file: Express.Multer.File,
    folder: UploadFolder
  ): Promise<{ url: string; key: string }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'S3 chưa cấu hình. Kiểm tra AWS_* và S3_* trong backend/.env'
      );
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Không có file');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `File quá lớn (tối đa ${Math.round(this.maxBytes / 1024 / 1024)}MB)`
      );
    }
    const mime = file.mimetype || 'application/octet-stream';
    if (!this.allowedMime.has(mime)) {
      throw new BadRequestException(`Định dạng không hỗ trợ: ${mime}`);
    }

    const safeFolder = ['products', 'categories', 'misc'].includes(folder)
      ? folder
      : 'misc';
    const key = `${this.prefix}/${safeFolder}/${Date.now()}-${randomBytes(4).toString('hex')}-${safeFilename(file.originalname)}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000',
        })
      );
    } catch (err) {
      throw mapS3UploadError(err);
    }

    return { key, url: `${this.publicBase}/${key}` };
  }
}

function isPlaceholderAwsCredentials(accessKeyId: string, secretAccessKey: string): boolean {
  if (PLACEHOLDER_ACCESS_KEY_IDS.has(accessKeyId)) return true;
  if (/example/i.test(accessKeyId) || /example/i.test(secretAccessKey)) return true;
  return false;
}

function mapS3UploadError(err: unknown): ServiceUnavailableException {
  const code =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: string }).name)
      : err && typeof err === 'object' && 'Code' in err
        ? String((err as { Code?: string }).Code)
        : '';

  if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
    return new ServiceUnavailableException(
      'AWS Access Key / Secret không hợp lệ. Cập nhật AWS_ACCESS_KEY_ID và AWS_SECRET_ACCESS_KEY trong backend/.env (IAM user: quyền s3:PutObject trên bucket), sau đó restart API.'
    );
  }
  if (code === 'AccessDenied' || code === 'AllAccessDisabled') {
    return new ServiceUnavailableException(
      'IAM không có quyền ghi S3. Gắn policy s3:PutObject (và ListBucket nếu cần) cho bucket store/.'
    );
  }
  if (code === 'NoSuchBucket') {
    return new ServiceUnavailableException(
      'Bucket S3 không tồn tại hoặc sai region. Kiểm tra S3_BUCKET_NAME và AWS_REGION.'
    );
  }

  const detail = err instanceof Error ? err.message : 'Lỗi không xác định';
  return new ServiceUnavailableException(`Upload S3 thất bại: ${detail}`);
}

function safeFilename(original: string): string {
  const ext = extname(original).toLowerCase().slice(0, 12);
  const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const safeExt = allowedExt.includes(ext) ? ext : '.jpg';
  const base = original
    .replace(extname(original), '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'image'}${safeExt}`;
}
