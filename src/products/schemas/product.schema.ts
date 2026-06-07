import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ProductColor {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  code!: string;
}

@Schema({ _id: false })
export class ProductSize {
  @Prop({ required: true })
  size!: string;

  @Prop({ default: true })
  available!: boolean;
}

@Schema({
  timestamps: true,
  collection: 'products',
  // `collection` and `isNew` are product fields; Mongoose reserves those names as paths.
  suppressReservedKeysWarning: true,
})
export class Product {
  @Prop({ required: true, unique: true })
  productId!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true })
  sku!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  categorySlug?: string;

  @Prop({ required: true })
  collection!: string;

  @Prop({ required: true })
  price!: number;

  @Prop()
  originalPrice?: number;

  @Prop({ default: 0 })
  rating!: number;

  @Prop({ default: 0 })
  reviews!: number;

  @Prop({ default: 0 })
  sold!: number;

  @Prop({ required: true })
  image!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: [ProductColor], default: [] })
  colors!: ProductColor[];

  @Prop({ type: [ProductSize], default: [] })
  sizes!: ProductSize[];

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  material!: string;

  @Prop({ required: true })
  origin!: string;

  @Prop()
  lining?: string;

  @Prop()
  fit?: string;

  @Prop()
  modelHeight?: string;

  @Prop({ default: true })
  inStock!: boolean;

  @Prop({ default: false })
  isSale!: boolean;

  @Prop({ default: false })
  isNew!: boolean;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
