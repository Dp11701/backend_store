import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SizeChartRowDto {
  @IsString()
  size!: string;

  @IsNumber()
  @Min(0)
  bust!: number;

  @IsNumber()
  @Min(0)
  waist!: number;

  @IsNumber()
  @Min(0)
  hip!: number;

  @IsNumber()
  @Min(0)
  heightMin!: number;

  @IsNumber()
  @Min(0)
  heightMax!: number;
}

export class CreateSizeChartDto {
  @IsString()
  sizeChartId!: string;

  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeChartRowDto)
  rows!: SizeChartRowDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateSizeChartDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeChartRowDto)
  rows?: SizeChartRowDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
