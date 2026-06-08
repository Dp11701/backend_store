import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { ProductsModule } from '../products/products.module';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [MailModule, ProductsModule],
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
