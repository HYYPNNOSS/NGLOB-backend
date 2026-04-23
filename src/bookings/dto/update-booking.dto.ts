import {
  IsString, IsOptional, IsArray, ValidateNested,
  IsNumber, IsEnum, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCategory } from '@prisma/client';

export class UpdateAddressesDto {
  @IsOptional() @IsString()
  pickupAddress?: string;

  @IsOptional() @IsString()
  destinationAddress?: string;

  @IsOptional() @IsString()
  notesForDriver?: string;
}

export class UpdateBookingItemDto {
  @IsString() name: string;
  @IsEnum(ItemCategory) category: ItemCategory;
  @IsNumber() widthCm: number;
  @IsNumber() heightCm: number;
  @IsNumber() depthCm: number;
  @IsNumber() @Min(1) quantity: number;
}

export class UpdateItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBookingItemDto)
  items: UpdateBookingItemDto[];
}
