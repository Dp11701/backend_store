import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'vouchers' })
export class Voucher {
  @Prop({ required: true, unique: true })
  voucherId!: string;

  @Prop({ required: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  discount!: number;

  @Prop({ required: true, enum: ['percentage', 'fixed'] })
  discountType!: 'percentage' | 'fixed';

  @Prop()
  minPurchase?: number;

  @Prop()
  maxUses?: number;

  @Prop({ default: 0 })
  usedCount!: number;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: true })
  isActive!: boolean;
}

export type VoucherDocument = HydratedDocument<Voucher>;
export const VoucherSchema = SchemaFactory.createForClass(Voucher);
