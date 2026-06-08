import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private users: UsersService,
  ) {}

  /** Tạo device_id mới cho thiết bị chưa có trong localStorage */
  @Post('devices')
  createDevice() {
    return this.auth.createDeviceId();
  }

  /** Đăng nhập guest bằng device_id → JWT + profile mặc định */
  @Post('guest/login')
  guestLogin(@Body() dto: GuestLoginDto) {
    return this.auth.guestLogin(dto.deviceId);
  }

  @Get('me')
  async me(@Headers('authorization') auth: string) {
    const token = this.auth.parseBearer(auth);
    if (!token) throw new UnauthorizedException();
    const { user } = await this.auth.validateToken(token);
    return this.users.toProfile(user as any);
  }

  @Patch('me')
  async updateMe(@Headers('authorization') auth: string, @Body() dto: UpdateProfileDto) {
    const token = this.auth.parseBearer(auth);
    if (!token) throw new UnauthorizedException();
    const { user } = await this.auth.validateToken(token);
    const updated = await this.users.updateProfile(user._id.toString(), dto);
    if (!updated) throw new UnauthorizedException();
    return this.users.toProfile(updated as any);
  }
}
