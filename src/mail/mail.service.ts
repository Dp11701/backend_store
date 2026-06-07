import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface OrderMailData {
  orderCode: number;
  transferContent?: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: { province: string; district: string; ward: string; address: string };
  items: Array<{ title: string; color: string; size: string; quantity: number; price: number }>;
  shippingMethod: string;
  shippingCost: number;
  paymentMethod: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  note?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get('MAIL_HOST');
    const user = this.config.get('MAIL_USER');
    const pass = this.config.get('MAIL_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('MAIL_PORT') ?? 587),
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('MAIL_* env vars not set — email sending disabled');
    }
  }

  async sendOrderConfirmation(order: OrderMailData): Promise<void> {
    await this.send({
      to: order.customer.email,
      subject: `[Thiên Nga Store] Xác nhận đơn hàng #TNG-${String(order.orderCode).slice(-6)}`,
      html: this.buildOrderEmail(order, 'confirmed'),
    });
  }

  async sendPaymentConfirmation(order: OrderMailData): Promise<void> {
    await this.send({
      to: order.customer.email,
      subject: `[Thiên Nga Store] Thanh toán thành công - Đơn #TNG-${String(order.orderCode).slice(-6)}`,
      html: this.buildOrderEmail(order, 'paid'),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.transporter) return;
    try {
      const from = this.config.get('MAIL_FROM') ?? `"Thiên Nga Store" <${this.config.get('MAIL_USER')}>`;
      await this.transporter.sendMail({ from, ...opts });
      this.logger.log(`Email sent → ${opts.to} | ${opts.subject}`);
    } catch (err) {
      this.logger.error(`Email failed → ${opts.to}`, err);
    }
  }

  private buildOrderEmail(order: OrderMailData, type: 'confirmed' | 'paid'): string {
    const displayCode = `TNG-${String(order.orderCode).slice(-6)}`;
    const fmtVND = (n: number) =>
      n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

    const isPaid = type === 'paid';
    const isCod  = order.paymentMethod === 'cod';

    const itemRows = order.items
      .map(
        (i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">
            <div style="font-size:14px;font-weight:500;color:#111">${i.title}</div>
            <div style="font-size:12px;color:#888;margin-top:2px">${i.color} · ${i.size} · SL: ${i.quantity}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;color:#111;white-space:nowrap">
            ${fmtVND(i.price * i.quantity)}
          </td>
        </tr>`
      )
      .join('');

    const discount = order.subtotal + order.shippingCost + order.taxAmount - order.total;
    const discountRow =
      discount > 0
        ? `<tr>
            <td style="padding:6px 0;font-size:13px;color:#16a34a">Giảm giá</td>
            <td style="padding:6px 0;font-size:13px;color:#16a34a;text-align:right">−${fmtVND(discount)}</td>
          </tr>`
        : '';

    const addressBlock =
      order.shippingMethod === 'pickup'
        ? `<p style="margin:0;color:#555;font-size:14px">Nhận tại showroom (Hà Nội)</p>`
        : `<p style="margin:0;color:#555;font-size:14px">
            ${order.shippingAddress.address},
            ${order.shippingAddress.ward},
            ${order.shippingAddress.district},
            ${order.shippingAddress.province}
          </p>`;

    const noteBlock = order.note
      ? `<p style="margin:12px 0 0;font-size:13px;color:#888">Ghi chú: ${order.note}</p>`
      : '';

    const statusBanner = isPaid
      ? `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:14px 18px;margin-bottom:28px">
          <p style="margin:0;font-size:15px;font-weight:600;color:#166534">✓ Thanh toán đã được xác nhận</p>
          <p style="margin:6px 0 0;font-size:13px;color:#166534">Chúng tôi sẽ xử lý và giao hàng sớm nhất có thể.</p>
        </div>`
      : isCod
      ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:14px 18px;margin-bottom:28px">
          <p style="margin:0;font-size:15px;font-weight:600;color:#713f12">Đơn hàng đã được tiếp nhận (COD)</p>
          <p style="margin:6px 0 0;font-size:13px;color:#713f12">Thanh toán khi nhận hàng. Chúng tôi sẽ liên hệ xác nhận sớm.</p>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e5e5">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px;border-bottom:2px solid #111">
            <p style="margin:0;font-size:22px;font-style:italic;font-weight:700;letter-spacing:1px;color:#111">
              Thiên Nga Store
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">

            ${statusBanner}

            <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111">
              Đơn hàng ${displayCode}
            </h1>
            <p style="margin:0 0 28px;font-size:14px;color:#666">
              Xin chào <strong>${order.customer.name}</strong>,
              ${isPaid ? 'cảm ơn bạn đã thanh toán.' : 'cảm ơn bạn đã đặt hàng.'}
            </p>

            <!-- Items -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              ${itemRows}
            </table>

            <!-- Price breakdown -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border-top:1px solid #e5e5e5;padding-top:16px;margin-bottom:28px">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#666">Tạm tính</td>
                <td style="padding:6px 0;font-size:13px;color:#111;text-align:right">${fmtVND(order.subtotal)}</td>
              </tr>
              ${discountRow}
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#666">Vận chuyển</td>
                <td style="padding:6px 0;font-size:13px;color:${order.shippingCost === 0 ? '#16a34a' : '#111'};text-align:right">
                  ${order.shippingCost === 0 ? 'Miễn phí' : fmtVND(order.shippingCost)}
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#666">Thuế VAT (10%)</td>
                <td style="padding:6px 0;font-size:13px;color:#111;text-align:right">${fmtVND(order.taxAmount)}</td>
              </tr>
              <tr style="border-top:1px solid #e5e5e5">
                <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#111">Tổng cộng</td>
                <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#111;text-align:right">${fmtVND(order.total)}</td>
              </tr>
            </table>

            <!-- Shipping info -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:16px;vertical-align:top">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999">
                    Địa chỉ giao hàng
                  </p>
                  ${addressBlock}
                  ${noteBlock}
                </td>
                <td width="50%" style="vertical-align:top">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999">
                    Liên hệ
                  </p>
                  <p style="margin:0;color:#555;font-size:14px">${order.customer.phone}</p>
                  <p style="margin:4px 0 0;color:#555;font-size:14px">${order.customer.email}</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e5e5e5;background:#f9f9f9">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center">
              © Thiên Nga Store · Hà Nội, Việt Nam
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
