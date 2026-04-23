import {
  IsEnum, IsNumber, IsOptional, IsArray, Min, Max,
  ValidateNested, IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HomeSize, ExtrasType } from '@prisma/client';

export class PricingItemDto {
  @IsNumber() volumeM3: number;
  @IsNumber() @Min(1) quantity: number;
}

export class PricingMaterialDto {
  @IsString() type: string;
  @IsNumber() @Min(0) quantity: number;
}

export class CalculatePriceDto {
  @IsOptional()
  @IsEnum(HomeSize)
  homeSize?: HomeSize;

  @IsNumber() @Min(1) @Max(3)
  moversCount: number;

  @IsEnum(ExtrasType)
  extras: ExtrasType;

  @IsNumber() @Min(0)
  distanceKm: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  items?: PricingItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingMaterialDto)
  packingMaterials?: PricingMaterialDto[];
}
