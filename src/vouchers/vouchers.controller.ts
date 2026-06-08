import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ValidateVoucherDto } from './dto/validate-voucher.dto';
import { VouchersService } from './vouchers.service';

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@Query('all') all?: string) {
    return all === 'true' ? this.vouchersService.findAll() : this.vouchersService.findActive();
  }

  /** Kiểm tra mã (min đơn, hết hạn, once-per-user) — gọi khi khách áp mã */
  @Post('validate')
  async validate(
    @Body() dto: ValidateVoucherDto,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = await this.tryResolveUserId(authHeader);
    return this.vouchersService.validateForUser(
      dto.code,
      userId,
      dto.subtotal ?? 0,
    );
  }

  @Get(':code')
  byCode(@Param('code') code: string) {
    return this.vouchersService.findByCode(code);
  }

  private async tryResolveUserId(authHeader?: string) {
    const token = this.auth.parseBearer(authHeader);
    if (!token) return null;
    try {
      const { user } = await this.auth.validateToken(token);
      return user._id.toString();
    } catch {
      return null;
    }
  }
}
