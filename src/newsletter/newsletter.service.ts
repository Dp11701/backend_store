import { Injectable } from '@nestjs/common';
import { MailService, type NewsletterProductItem } from '../mail/mail.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly products: ProductsService,
    private readonly mail: MailService,
  ) {}

  async subscribe(email: string) {
    const normalized = email.trim().toLowerCase();

    const [newProducts, saleProducts] = await Promise.all([
      this.products.findAll({ isNew: true, sort: 'newest' }),
      this.products.findAll({ isSale: true, sort: 'popular' }),
    ]);

    const seen = new Set<string>();
    const picks: NewsletterProductItem[] = [];

    for (const p of newProducts) {
      if (picks.length >= 4) break;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      picks.push(this.toMailItem(p));
    }

    for (const p of saleProducts) {
      if (picks.length >= 6) break;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      picks.push(this.toMailItem(p));
    }

    const emailSent = await this.mail.sendNewsletterWelcome(normalized, {
      newCount: newProducts.length,
      saleCount: saleProducts.length,
      products: picks,
    });

    const mailStatus = this.mail.getStatus();

    return {
      ok: true,
      emailSent,
      mailConfigured: mailStatus.configured,
      mailMessage: emailSent
        ? undefined
        : mailStatus.configured
          ? 'Gửi email thất bại. Kiểm tra log API hoặc thử lại sau.'
          : mailStatus.message,
    };
  }

  private toMailItem(p: {
    title: string;
    slug: string;
    price: number;
    originalPrice?: number;
    image: string;
    isSale: boolean;
    isNew: boolean;
  }): NewsletterProductItem {
    return {
      title: p.title,
      slug: p.slug,
      price: p.price,
      originalPrice: p.originalPrice,
      image: p.image,
      isSale: p.isSale,
      isNew: p.isNew,
    };
  }
}
