import { IsEmail } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}
