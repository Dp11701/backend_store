import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { VouchersService } from '../vouchers/vouchers.service';
import { CreateVoucherDto, UpdateVoucherDto } from '../vouchers/dto/voucher.dto';

@Controller('admin/vouchers')
export class AdminVouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vouchersService.remove(id);
  }
}
