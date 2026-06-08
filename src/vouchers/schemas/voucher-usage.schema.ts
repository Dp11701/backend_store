import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VoucherUsageDocument = HydratedDocument<VoucherUsage>;

@Schema({ timestamps: true, collection: 'voucher_usages' })
export class VoucherUsage {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, uppercase: true, index: true })
  voucherCode!: string;

  @Prop({ required: true })
  orderCode!: number;
}

export const VoucherUsageSchema = SchemaFactory.createForClass(VoucherUsage);
VoucherUsageSchema.index({ userId: 1, voucherCode: 1 }, { unique: true });
