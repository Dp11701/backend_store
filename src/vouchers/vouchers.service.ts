import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Voucher, VoucherDocument } from './schemas/voucher.schema';
import { VoucherUsage, VoucherUsageDocument } from './schemas/voucher-usage.schema';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';

export type VoucherDto = ReturnType<VouchersService['toDto']>;

@Injectable()
export class VouchersService {
  constructor(
    @InjectModel(Voucher.name) private readonly voucherModel: Model<VoucherDocument>,
    @InjectModel(VoucherUsage.name)
    private readonly usageModel: Model<VoucherUsageDocument>,
  ) {}

  toDto(doc: VoucherDocument | Voucher) {
    return {
      id: doc.voucherId,
      code: doc.code,
      description: doc.description,
      discount: doc.discount,
      discountType: doc.discountType,
      minPurchase: doc.minPurchase,
      maxUses: doc.maxUses,
      usedCount: doc.usedCount,
      expiresAt:
        doc.expiresAt instanceof Date
          ? doc.expiresAt.toISOString()
          : String(doc.expiresAt),
      isActive: doc.isActive,
      oncePerUser: doc.oncePerUser ?? false,
    };
  }

  async findAll() {
    const docs = await this.voucherModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((d) => this.toDto(d as VoucherDocument));
  }

  async findActive() {
    const now = new Date();
    const docs = await this.voucherModel
      .find({ isActive: true, expiresAt: { $gte: now } })
      .lean();
    return docs.map((d) => this.toDto(d as VoucherDocument));
  }

  async findByCode(code: string) {
    const doc = await this.voucherModel
      .findOne({ code: code.toUpperCase(), isActive: true })
      .lean();
    if (!doc) throw new NotFoundException('Voucher not found');
    return this.toDto(doc as VoucherDocument);
  }

  private async getActiveDoc(code: string) {
    const normalized = code.trim().toUpperCase();
    const doc = await this.voucherModel.findOne({ code: normalized }).lean();
    if (!doc) throw new NotFoundException('Mã giảm giá không tồn tại');
    return doc as VoucherDocument;
  }

  async hasUserUsedVoucher(userId: string, code: string) {
    const usage = await this.usageModel
      .findOne({ userId, voucherCode: code.toUpperCase() })
      .lean();
    return Boolean(usage);
  }

  /** Kiểm tra mã trước khi áp vào giỏ — có kiểm tra oncePerUser */
  async validateForUser(code: string, userId: string | null, subtotal = 0) {
    const doc = await this.getActiveDoc(code);
    const voucher = this.toDto(doc);

    if (!doc.isActive) {
      throw new BadRequestException('Mã giảm giá không còn hiệu lực');
    }

    if (new Date(doc.expiresAt) < new Date()) {
      throw new BadRequestException('Mã giảm giá đã hết hạn');
    }

    if (doc.maxUses != null && doc.usedCount >= doc.maxUses) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng');
    }

    if (doc.oncePerUser) {
      if (!userId) {
        throw new BadRequestException('Vui lòng tải lại trang để áp mã này');
      }
      if (await this.hasUserUsedVoucher(userId, doc.code)) {
        throw new BadRequestException('Bạn đã sử dụng mã giảm giá này rồi');
      }
    }

    if (doc.minPurchase && subtotal < doc.minPurchase) {
      throw new BadRequestException(
        `Đơn tối thiểu ${doc.minPurchase.toLocaleString('vi-VN')}đ để dùng mã này`,
      );
    }

    return voucher;
  }

  calculateDiscount(voucher: VoucherDto, subtotal: number): number {
    if (voucher.discountType === 'percentage') {
      return Math.round((subtotal * voucher.discount) / 100);
    }
    return voucher.discount;
  }

  /** Ghi nhận đã dùng mã khi đơn thanh toán/xác nhận thành công */
  async recordUsage(userId: string, code: string, orderCode: number) {
    const normalized = code.toUpperCase();
    const doc = await this.voucherModel.findOne({ code: normalized });
    if (!doc) return;

    const existing = await this.usageModel.findOne({
      userId,
      voucherCode: normalized,
    });
    if (existing) return;

    try {
      await this.usageModel.create({ userId, voucherCode: normalized, orderCode });
      await this.voucherModel.updateOne(
        { code: normalized },
        { $inc: { usedCount: 1 } },
      );
    } catch {
      /* race: unique index — đã ghi nhận */
    }
  }

  async create(dto: CreateVoucherDto) {
    const code = dto.code.toUpperCase();
    const exists = await this.voucherModel.findOne({
      $or: [{ voucherId: dto.voucherId }, { code }],
    });
    if (exists) throw new ConflictException('voucherId hoặc code đã tồn tại');
    const doc = await this.voucherModel.create({
      ...dto,
      code,
      expiresAt: new Date(dto.expiresAt),
      usedCount: dto.usedCount ?? 0,
      isActive: dto.isActive ?? true,
      oncePerUser: dto.oncePerUser ?? false,
    });
    return this.toDto(doc);
  }

  async update(voucherId: string, dto: UpdateVoucherDto) {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.code) patch.code = dto.code.toUpperCase();
    if (dto.expiresAt) patch.expiresAt = new Date(dto.expiresAt);
    const doc = await this.voucherModel
      .findOneAndUpdate({ voucherId }, { $set: patch }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException(`Voucher ${voucherId} not found`);
    return this.toDto(doc as VoucherDocument);
  }

  async remove(voucherId: string) {
    const result = await this.voucherModel.deleteOne({ voucherId });
    if (!result.deletedCount) throw new NotFoundException(`Voucher ${voucherId} not found`);
    return { ok: true, voucherId };
  }

  async upsertMany(items: Record<string, unknown>[]) {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { voucherId: item.voucherId },
        update: { $set: item },
        upsert: true,
      },
    }));
    if (ops.length === 0) return { upserted: 0 };
    const result = await this.voucherModel.bulkWrite(
      ops as Parameters<typeof this.voucherModel.bulkWrite>[0],
    );
    return { upserted: result.upsertedCount + result.modifiedCount };
  }
}
