import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ValidateVoucherDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;
}
