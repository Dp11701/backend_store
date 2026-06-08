import { Body, Controller, Post } from '@nestjs/common';
import { SubscribeNewsletterDto } from './dto/subscribe.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletter.subscribe(dto.email);
  }
}
