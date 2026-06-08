import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export interface UserProfileDto {
  id: string;
  deviceId: string;
  type: 'guest' | 'registered';
  name: string;
  email: string;
  phone: string;
  profileCompleted: boolean;
  shippingAddress: User['shippingAddress'];
  tier: string;
  points: number;
  memberSince: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  toProfile(user: User & { _id: { toString(): string }; createdAt?: Date }): UserProfileDto {
    return {
      id: user._id.toString(),
      deviceId: user.deviceId,
      type: user.type,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileCompleted: user.profileCompleted,
      shippingAddress: user.shippingAddress,
      tier: user.tier,
      points: user.points,
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async findByDeviceId(deviceId: string) {
    return this.userModel.findOne({ deviceId }).lean();
  }

  async findById(id: string) {
    return this.userModel.findById(id).lean();
  }

  async findOrCreateGuest(deviceId: string) {
    let user = await this.userModel.findOne({ deviceId });
    if (!user) {
      user = await this.userModel.create({ deviceId, type: 'guest' });
    }
    return user;
  }

  async completeProfileFromOrder(
    userId: string,
    customer: { name: string; phone: string; email: string },
    shippingAddress: { province: string; district: string; ward: string; address: string },
  ) {
    const user = await this.userModel.findById(userId);
    if (!user || user.profileCompleted) return user;

    user.name = customer.name.trim() || user.name;
    user.email = customer.email.trim() || user.email;
    user.phone = customer.phone.trim() || user.phone;
    user.shippingAddress = shippingAddress;
    user.profileCompleted = true;
    await user.save();
    return user;
  }

  async updateProfile(
    userId: string,
    patch: Partial<Pick<User, 'name' | 'email' | 'phone' | 'shippingAddress'>>,
  ) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, patch, { new: true })
      .lean();
    return user;
  }
}
