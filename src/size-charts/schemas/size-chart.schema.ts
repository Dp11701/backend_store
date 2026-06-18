import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class SizeChartRow {
  @Prop({ required: true })
  size!: string;

  /** Ngực (cm) */
  @Prop({ required: true })
  bust!: number;

  /** Eo (cm) */
  @Prop({ required: true })
  waist!: number;

  /** Hông (cm) */
  @Prop({ required: true })
  hip!: number;

  @Prop({ required: true })
  heightMin!: number;

  @Prop({ required: true })
  heightMax!: number;
}

@Schema({ timestamps: true, collection: 'size_charts' })
export class SizeChart {
  @Prop({ required: true, unique: true })
  sizeChartId!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true })
  name!: string;

  /** Gợi ý map theo danh mục — sản phẩm có thể override bằng sizeChartId */
  @Prop({ index: true })
  categorySlug?: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [SizeChartRow], default: [] })
  rows!: SizeChartRow[];

  @Prop({ default: false })
  isDefault!: boolean;
}

export type SizeChartDocument = HydratedDocument<SizeChart>;
export const SizeChartSchema = SchemaFactory.createForClass(SizeChart);
