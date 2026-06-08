import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auth: AuthService,
  ) {}

  /** Danh sách đơn của guest/user đang đăng nhập */
  @Get('me/list')
  async myOrders(@Headers('authorization') authHeader: string) {
    const userId = await this.resolveUserId(authHeader);
    return this.ordersService.listOrdersByUser(userId);
  }

  /** Chi tiết đơn thuộc tài khoản guest */
  @Get('me/:orderCode')
  async myOrderDetail(
    @Headers('authorization') authHeader: string,
    @Param('orderCode', ParseIntPipe) orderCode: number,
  ) {
    const userId = await this.resolveUserId(authHeader);
    return this.ordersService.getOrderForUser(userId, orderCode);
  }

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = await this.tryResolveUserId(authHeader);
    return this.ordersService.createOrder(dto, userId);
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

  private async resolveUserId(authHeader: string) {
    const userId = await this.tryResolveUserId(authHeader);
    if (!userId) throw new UnauthorizedException();
    return userId;
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
