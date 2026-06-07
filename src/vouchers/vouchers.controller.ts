import { Controller, Get, Param, Query } from '@nestjs/common';
import { VouchersService } from './vouchers.service';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  list(@Query('all') all?: string) {
    return all === 'true' ? this.vouchersService.findAll() : this.vouchersService.findActive();
  }

  @Get(':code')
  byCode(@Param('code') code: string) {
    return this.vouchersService.findByCode(code);
  }
}
