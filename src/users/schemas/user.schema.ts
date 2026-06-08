import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  deviceId!: string;

  @Prop({ default: 'guest', enum: ['guest', 'registered'] })
  type!: 'guest' | 'registered';

  @Prop({ default: 'Khách hàng Thiên Nga' })
  name!: string;

  @Prop({ default: '' })
  email!: string;

  @Prop({ default: '' })
  phone!: string;

  @Prop({ default: false })
  profileCompleted!: boolean;

  @Prop({ type: Object, default: null })
  shippingAddress!: {
    province: string;
    district: string;
    ward: string;
    address: string;
  } | null;

  @Prop({ default: 'silver', enum: ['silver', 'platinum', 'diamond'] })
  tier!: string;

  @Prop({ default: 0 })
  points!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
