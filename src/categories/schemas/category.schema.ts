import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, unique: true })
  categoryId!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop()
  image?: string;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);
