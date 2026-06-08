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

export interface NewsletterProductItem {
  title: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image: string;
  isSale: boolean;
  isNew: boolean;
}

export interface NewsletterMailData {
  newCount: number;
  saleCount: number;
  products: NewsletterProductItem[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly configMessage: string | null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST')?.trim();
    const user = this.config.get<string>('MAIL_USER')?.trim();
    const pass = this.config.get<string>('MAIL_PASS')?.trim();

    if (!host || !user || !pass) {
      this.configMessage = 'Thiếu MAIL_HOST, MAIL_USER hoặc MAIL_PASS trong backend/.env';
      this.logger.warn(`${this.configMessage} — email sending disabled`);
      return;
    }

    if (isPlaceholderMailCredentials(user, pass)) {
      this.configMessage =
        'MAIL_USER / MAIL_PASS đang là giá trị mẫu. Dùng Gmail thật + App Password tại myaccount.google.com/apppasswords';
      this.logger.warn(`${this.configMessage} — email sending disabled`);
      return;
    }

    this.configMessage = null;
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('MAIL_PORT') ?? 587),
      secure: false,
      auth: { user, pass: pass.replace(/\s/g, '') },
    });
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  getStatus(): { configured: boolean; message: string } {
    if (this.transporter) {
      return { configured: true, message: 'SMTP sẵn sàng' };
    }
    return {
      configured: false,
      message: this.configMessage ?? 'SMTP chưa cấu hình',
    };
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

  async sendNewsletterWelcome(to: string, data: NewsletterMailData): Promise<boolean> {
    return this.send({
      to,
      subject: '✨ Chào mừng đến Maison Letter — Hàng mới & ưu đãi dành riêng cho bạn',
      html: this.buildNewsletterEmail(data),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      const from = this.config.get('MAIL_FROM') ?? `"Thiên Nga Store" <${this.config.get('MAIL_USER')}>`;
      await this.transporter.sendMail({ from, ...opts });
      this.logger.log(`Email sent → ${opts.to} | ${opts.subject}`);
      return true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email failed → ${opts.to}: ${detail}`);
      return false;
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

  private buildNewsletterEmail(data: NewsletterMailData): string {
    const baseUrl = (this.config.get('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    const fmtVND = (n: number) =>
      n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

    const newUrl = `${baseUrl}/tim-kiem?tag=${encodeURIComponent('Mới về')}`;
    const saleUrl = `${baseUrl}/tim-kiem?tag=Sale`;

    const productCards = data.products.length
      ? data.products
          .map((p) => {
            const productUrl = `${baseUrl}/san-pham/${p.slug}`;
            const badge = p.isNew
              ? '<span style="display:inline-block;background:#111;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;padding:4px 8px;text-transform:uppercase">Mới về</span>'
              : p.isSale
                ? '<span style="display:inline-block;background:#b45309;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;padding:4px 8px;text-transform:uppercase">Sale</span>'
                : '';
            const priceBlock =
              p.originalPrice && p.originalPrice > p.price
                ? `<span style="font-size:13px;color:#999;text-decoration:line-through;margin-right:8px">${fmtVND(p.originalPrice)}</span>
                   <span style="font-size:15px;font-weight:700;color:#b45309">${fmtVND(p.price)}</span>`
                : `<span style="font-size:15px;font-weight:700;color:#111">${fmtVND(p.price)}</span>`;

            return `
            <td width="50%" style="padding:8px;vertical-align:top">
              <a href="${productUrl}" style="text-decoration:none;color:inherit;display:block;border:1px solid #eee;border-radius:4px;overflow:hidden">
                <img src="${p.image}" alt="${p.title}" width="100%" style="display:block;aspect-ratio:3/4;object-fit:cover;background:#f5f0eb" />
                <div style="padding:14px 12px">
                  ${badge ? `<div style="margin-bottom:8px">${badge}</div>` : ''}
                  <p style="margin:0 0 8px;font-size:14px;font-weight:500;color:#111;line-height:1.4">${p.title}</p>
                  <p style="margin:0">${priceBlock}</p>
                </div>
              </a>
            </td>`;
          })
          .reduce<string[]>((rows, cell, i) => {
            if (i % 2 === 0) rows.push('<tr>');
            rows[rows.length - 1] += cell;
            if (i % 2 === 1 || i === data.products.length - 1) {
              if (i % 2 === 0) rows[rows.length - 1] += '<td width="50%"></td>';
              rows[rows.length - 1] += '</tr>';
            }
            return rows;
          }, [])
          .join('')
      : '';

    const productSection = productCards
      ? `<h2 style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#999">
           Gợi ý dành cho bạn
         </h2>
         <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
           ${productCards}
         </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e8e0d8">

        <tr>
          <td style="padding:36px 32px 28px;text-align:center;border-bottom:1px solid #f0ebe4">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#888">Maison Letter</p>
            <p style="margin:0;font-size:28px;font-style:italic;font-weight:400;color:#111">Thiên Nga Store</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 32px">
            <h1 style="margin:0 0 12px;font-size:24px;font-weight:400;font-style:italic;color:#111;line-height:1.3">
              Chào mừng bạn đến với thế giới của quý cô hiện đại
            </h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#555;font-family:Arial,Helvetica,sans-serif">
              Cảm ơn bạn đã đăng ký Maison Letter. Từ giờ, bạn sẽ là người đầu tiên biết về
              <strong>bộ sưu tập mới</strong>, <strong>flash sale</strong> và những câu chuyện
              thời trang đằng sau mỗi thiết kế — trước cả khi chúng lên kệ.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
              <tr>
                <td width="48%" style="padding:20px;background:#faf7f4;border:1px solid #eee;border-radius:4px;vertical-align:top">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888">Mới về</p>
                  <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:#111;font-family:Arial,sans-serif">${data.newCount || '—'}</p>
                  <p style="margin:0 0 16px;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.5">Thiết kế vừa cập bến — tinh tế, thanh lịch, sẵn sàng cho mùa mới.</p>
                  <a href="${newUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;font-family:Arial,sans-serif">Khám phá hàng mới</a>
                </td>
                <td width="4%"></td>
                <td width="48%" style="padding:20px;background:#1a1a1a;border-radius:4px;vertical-align:top">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9a96e">Flash sale</p>
                  <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:#fff;font-family:Arial,sans-serif">${data.saleCount || '—'}</p>
                  <p style="margin:0 0 16px;font-size:13px;color:#ccc;font-family:Arial,sans-serif;line-height:1.5">Ưu đãi có hạn — đừng bỏ lỡ những thiết kế yêu thích với giá đặc biệt.</p>
                  <a href="${saleUrl}" style="display:inline-block;padding:12px 20px;background:#c9a96e;color:#111;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;font-family:Arial,sans-serif">Xem ưu đãi</a>
                </td>
              </tr>
            </table>

            ${productSection}

            <div style="text-align:center;padding:24px 0 8px;border-top:1px solid #f0ebe4">
              <p style="margin:0 0 16px;font-size:14px;color:#666;font-family:Arial,sans-serif">
                Một món quà nhỏ từ chúng tôi — miễn phí giao hàng cho đơn từ 1.500.000đ
              </p>
              <a href="${baseUrl}/danh-muc" style="display:inline-block;padding:14px 32px;border:1px solid #111;color:#111;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;font-family:Arial,sans-serif">Mua sắm ngay</a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0ebe4;background:#faf7f4;text-align:center">
            <p style="margin:0 0 6px;font-size:12px;color:#aaa;font-family:Arial,sans-serif">
              © Thiên Nga Store · Hà Nội, Việt Nam
            </p>
            <p style="margin:0;font-size:11px;color:#ccc;font-family:Arial,sans-serif">
              Bạn nhận email này vì đã đăng ký Maison Letter tại thienngastore.vn
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

function isPlaceholderMailCredentials(user: string, pass: string): boolean {
  if (/your@gmail\.com|example\.com|@email\.com/i.test(user)) return true;
  if (/^x{3,}/i.test(pass.replace(/\s/g, ''))) return true;
  if (/xxxx/i.test(pass)) return true;
  return false;
}
