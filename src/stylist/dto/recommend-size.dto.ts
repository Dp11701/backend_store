import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecommendSizeDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(140)
  @Max(200)
  height!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(70)
  @Max(130)
  bust!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(55)
  @Max(120)
  waist!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(75)
  @Max(140)
  hip!: number;

  @IsOptional()
  @IsString()
  productSlug?: string;
}
