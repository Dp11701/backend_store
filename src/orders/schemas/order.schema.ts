import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: String, index: true, default: null }) userId!: string | null;

  @Prop({ required: true, unique: true }) orderCode!: number;

  @Prop({ type: Object, required: true })
  customer!: { name: string; phone: string; email: string };

  @Prop({ type: Object, required: true })
  shippingAddress!: { province: string; district: string; ward: string; address: string };

  @Prop({ type: Array, required: true })
  items!: Array<{
    productId: string; title: string; price: number;
    quantity: number; color: string; size: string; image: string;
  }>;

  @Prop({ required: true }) shippingMethod!: string;
  @Prop({ required: true, default: 0 }) shippingCost!: number;
  @Prop({ required: true }) paymentMethod!: string;
  @Prop({ required: true }) subtotal!: number;
  @Prop({ default: 0 }) voucherDiscount!: number;
  @Prop({ default: '' }) voucherCode!: string;
  @Prop({ required: true }) taxAmount!: number;
  @Prop({ required: true }) total!: number;
  @Prop({ default: '' }) note!: string;

  @Prop({ default: 'pending', enum: ['pending', 'paid', 'cancelled', 'cod'] })
  paymentStatus!: string;

  @Prop({
    default: 'pending',
    enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
  })
  orderStatus!: string;

  @Prop({ default: '' }) transferContent!: string;
  @Prop({ default: '' }) transactionRef!: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
