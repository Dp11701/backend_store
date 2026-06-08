import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { signToken, verifyToken } from './jwt.util';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private config: ConfigService,
  ) {}

  private get secret() {
    return this.config.get<string>('JWT_SECRET') ?? 'thiennga-dev-secret-change-me';
  }

  createDeviceId() {
    return { deviceId: randomUUID() };
  }

  async guestLogin(deviceId: string) {
    const user = await this.users.findOrCreateGuest(deviceId);
    const token = signToken(
      { sub: user._id.toString(), deviceId: user.deviceId, type: 'guest' },
      this.secret,
    );
    return { token, user: this.users.toProfile(user) };
  }

  async validateToken(token: string) {
    const payload = verifyToken(token, this.secret);
    if (!payload) throw new UnauthorizedException('Invalid or expired token');

    const user = await this.users.findById(payload.sub);
    if (!user || user.deviceId !== payload.deviceId) {
      throw new UnauthorizedException('User not found');
    }

    return { payload, user };
  }

  parseBearer(authHeader?: string) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim() || null;
  }
}
