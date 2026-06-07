import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list() {
    return this.ordersService.listOrders();
  }

  @Patch(':orderCode')
  update(
    @Param('orderCode', ParseIntPipe) orderCode: number,
    @Body() body: { orderStatus?: string; paymentStatus?: string },
  ) {
    return this.ordersService.updateOrder(orderCode, body);
  }
}
