import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

class AddressDto {
  @IsString() province!: string;
  @IsString() district!: string;
  @IsString() ward!: string;
  @IsString() address!: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) shippingAddress?: AddressDto;
}
