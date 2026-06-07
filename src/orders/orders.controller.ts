import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get(':orderCode/status')
  getStatus(@Param('orderCode', ParseIntPipe) orderCode: number) {
    return this.ordersService.getOrderStatus(orderCode);
  }

  @Post('webhook/sepay')
  webhook(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') auth: string,
  ) {
    return this.ordersService.handleSepayWebhook(body as any, auth ?? '');
  }
}
