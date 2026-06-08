import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { VouchersService } from '../vouchers/vouchers.service';

interface SepayWebhookBody {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string;
  content: string;
  transferType: string;
  transferAmount: number;
  referenceCode?: string;
  accumulated?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private config: ConfigService,
    private mail: MailService,
    private users: UsersService,
    private vouchers: VouchersService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId?: string | null) {
    const orderCode = Date.now();
    const transferContent = `TNG${orderCode}`;
    const isCod = dto.paymentMethod === 'cod';

    let voucherCode = '';
    let voucherDiscount = 0;
    if (dto.voucherCode?.trim()) {
      const voucher = await this.vouchers.validateForUser(
        dto.voucherCode,
        userId ?? null,
        dto.subtotal,
      );
      voucherCode = voucher.code;
      voucherDiscount = this.vouchers.calculateDiscount(voucher, dto.subtotal);
    }

    await this.orderModel.create({
      orderCode,
      userId: userId ?? null,
      ...dto,
      voucherCode,
      voucherDiscount,
      transferContent,
      paymentStatus: isCod ? 'cod' : 'pending',
      orderStatus: isCod ? 'confirmed' : 'pending',
    });

    if (isCod && voucherCode && userId) {
      await this.vouchers.recordUsage(userId, voucherCode, orderCode);
    }

    if (userId) {
      void this.users.completeProfileFromOrder(userId, dto.customer, dto.shippingAddress);
      const phone = dto.customer.phone?.trim();
      if (phone) {
        void this.orderModel.updateMany(
          { userId: null, 'customer.phone': phone },
          { $set: { userId } },
        );
      }
    }

    if (isCod) {
      void this.mail.sendOrderConfirmation({ orderCode, transferContent, ...dto });
    }

    return { orderCode, transferContent };
  }

  private async userOrdersFilter(userId: string) {
    const user = await this.users.findById(userId);
    const phone = user?.phone?.trim();
    if (phone) {
      return {
        $or: [{ userId }, { userId: null, 'customer.phone': phone }],
      };
    }
    return { userId };
  }

  async listOrdersByUser(userId: string) {
    const filter = await this.userOrdersFilter(userId);
    return this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .select(
        'orderCode paymentStatus orderStatus total subtotal shippingCost shippingMethod voucherCode voucherDiscount taxAmount paymentMethod customer shippingAddress items createdAt transferContent note',
      )
      .lean();
  }

  async getOrderForUser(userId: string, orderCode: number) {
    const filter = await this.userOrdersFilter(userId);
    const order = await this.orderModel.findOne({ ...filter, orderCode }).lean();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listOrders() {
    return this.orderModel.find().sort({ createdAt: -1 }).lean();
  }

  async updateOrder(
    orderCode: number,
    patch: { orderStatus?: string; paymentStatus?: string },
  ) {
    const order = await this.orderModel
      .findOneAndUpdate({ orderCode }, patch, { new: true })
      .lean();
    if (!order) throw new Error(`Order ${orderCode} not found`);
    return order;
  }

  async getOrderStatus(orderCode: number) {
    return this.orderModel
      .findOne({ orderCode })
      .select('orderCode paymentStatus orderStatus total transferContent paymentMethod customer')
      .lean();
  }

  async handleSepayWebhook(body: SepayWebhookBody, authHeader: string) {
    const secret = this.config.get<string>('SEPAY_WEBHOOK_SECRET') ?? '';
    if (authHeader !== `Apikey ${secret}`) {
      throw new UnauthorizedException('Invalid webhook key');
    }

    if (body.transferType !== 'in') return { success: true };

    const content = (body.content ?? '').toUpperCase();
    const match = content.match(/TNG(\d{13})/);
    if (!match) return { success: true };

    const orderCode = parseInt(match[1], 10);
    const order = await this.orderModel.findOne({ orderCode }).lean();
    if (!order || order.paymentStatus === 'paid') return { success: true };

    if (body.transferAmount < order.total) return { success: true };

    await this.orderModel.updateOne(
      { orderCode },
      {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        transactionRef: body.referenceCode ?? body.code ?? '',
      },
    );

    if (order.voucherCode && order.userId) {
      await this.vouchers.recordUsage(order.userId, order.voucherCode, orderCode);
    }

    void this.mail.sendPaymentConfirmation({
      orderCode:       order.orderCode,
      customer:        order.customer,
      shippingAddress: order.shippingAddress,
      items:           order.items,
      shippingMethod:  order.shippingMethod,
      shippingCost:    order.shippingCost,
      paymentMethod:   order.paymentMethod,
      subtotal:        order.subtotal,
      taxAmount:       order.taxAmount,
      total:           order.total,
      note:            order.note,
    });

    return { success: true };
  }
}
