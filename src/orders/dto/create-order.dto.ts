import { Type } from 'class-transformer';
import {
  IsString, IsEmail, IsNumber, IsArray, IsOptional,
  ValidateNested, IsPositive, Min, IsIn,
} from 'class-validator';

class CustomerDto {
  @IsString() name!: string;
  @IsString() phone!: string;
  @IsEmail() email!: string;
}

class AddressDto {
  @IsString() province!: string;
  @IsString() district!: string;
  @IsString() ward!: string;
  @IsString() address!: string;
}

class OrderItemDto {
  @IsString() productId!: string;
  @IsString() title!: string;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @IsPositive() quantity!: number;
  @IsString() color!: string;
  @IsString() size!: string;
  @IsString() image!: string;
}

export class CreateOrderDto {
  @ValidateNested() @Type(() => CustomerDto) customer!: CustomerDto;
  @ValidateNested() @Type(() => AddressDto) shippingAddress!: AddressDto;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
  @IsString() shippingMethod!: string;
  @IsNumber() @Min(0) shippingCost!: number;
  @IsIn(['vietqr', 'cod']) paymentMethod!: string;
  @IsNumber() @Min(0) subtotal!: number;
  @IsNumber() @Min(0) taxAmount!: number;
  @IsNumber() @IsPositive() total!: number;
  @IsString() @IsOptional() note?: string;
  @IsString() @IsOptional() voucherCode?: string;
}
