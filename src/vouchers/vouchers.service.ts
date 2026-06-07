import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Voucher, VoucherDocument } from './schemas/voucher.schema';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';

@Injectable()
export class VouchersService {
  constructor(
    @InjectModel(Voucher.name) private readonly voucherModel: Model<VoucherDocument>
  ) {}

  private toDto(doc: VoucherDocument) {
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
      ops as Parameters<typeof this.voucherModel.bulkWrite>[0]
    );
    return { upserted: result.upsertedCount + result.modifiedCount };
  }
}
