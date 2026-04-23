import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  IsEnum, IsNumber, IsOptional, IsArray, Min, Max,
  ValidateNested, IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PricingService } from './pricing.service';
import { HomeSize, ExtrasType } from '@prisma/client';

class PricingItemDto {
  @IsNumber() volumeM3: number;
  @IsNumber() @Min(1) quantity: number;
}

class PricingMaterialDto {
  @IsString() type: string;
  @IsNumber() @Min(0) quantity: number;
}

export class CalculatePriceDto {
  @IsOptional()
  @IsEnum(['STUDIO', 'ONE', 'TWO', 'THREE', 'FOUR_PLUS'])
  homeSize?: HomeSize;

  @IsNumber() @Min(1) @Max(3)
  moversCount: number;

  @IsEnum(['MATERIALS_ONLY', 'FULL_PACKING'])
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

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Get live price estimate — no auth required' })
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricingService.calculate(dto);
  }
}
