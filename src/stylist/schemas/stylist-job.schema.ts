import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StylistJobDocument = HydratedDocument<StylistJob>;

export const STYLIST_JOB_STATUSES = [
  'queued',
  'processing_size',
  'consulting_ai',
  'generating_image',
  'completed',
  'failed',
] as const;

export type StylistJobStatus = (typeof STYLIST_JOB_STATUSES)[number];

@Schema({ _id: true, timestamps: true })
export class StylistJob {
  @Prop({ required: true, enum: STYLIST_JOB_STATUSES, default: 'queued' })
  status!: StylistJobStatus;

  @Prop({ default: 0 })
  progress!: number;

  @Prop({ default: '' })
  message!: string;

  @Prop({ required: true })
  productId!: string;

  @Prop()
  productSlug?: string;

  @Prop({ required: true })
  userPhotoUrl!: string;

  @Prop({ type: Object, required: true })
  measurements!: {
    height: number;
    bust: number;
    waist: number;
    hip: number;
  };

  @Prop({ type: Object })
  result?: Record<string, unknown>;

  @Prop()
  tryOnPredictionId?: string;

  @Prop({ enum: ['pending', 'processing', 'succeeded', 'failed'] })
  tryOnStatus?: 'pending' | 'processing' | 'succeeded' | 'failed';

  @Prop()
  tryOnResultUrl?: string;

  @Prop()
  error?: string;
}

export const StylistJobSchema = SchemaFactory.createForClass(StylistJob);

StylistJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
