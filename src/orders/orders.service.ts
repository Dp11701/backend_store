import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { MailService } from '../mail/mail.service';

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
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const orderCode = Date.now();
    const transferContent = `TNG${orderCode}`;
    const isCod = dto.paymentMethod === 'cod';

    await this.orderModel.create({
      orderCode,
      ...dto,
      transferContent,
      paymentStatus: isCod ? 'cod' : 'pending',
      orderStatus: isCod ? 'confirmed' : 'pending',
    });

    if (isCod) {
      void this.mail.sendOrderConfirmation({ orderCode, transferContent, ...dto });
    }

    return { orderCode, transferContent };
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
