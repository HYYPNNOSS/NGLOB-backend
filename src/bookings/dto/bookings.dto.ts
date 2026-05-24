import {
  IsEnum, IsString, IsDateString, IsNumber, IsBoolean,
  IsOptional, IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BookingType, HomeSize, ExtrasType, TimeSlot, ItemCategory,
  PackingMaterialType,
} from '@prisma/client';

export class BookingItemDto {
  @IsString() name: string;
  @IsEnum(ItemCategory) category: ItemCategory;
  @IsNumber() widthCm: number;
  @IsNumber() heightCm: number;
  @IsNumber() depthCm: number;
  @IsNumber() @Min(1) quantity: number;
}

export class PackingMaterialDto {
  @IsEnum(PackingMaterialType) type: PackingMaterialType;
  @IsNumber() @Min(0) quantity: number;
}

export class CreateBookingDto {
  @IsEnum(BookingType) type: BookingType;
  @IsString() pickupAddress: string;
  @IsString() destinationAddress: string;
  @IsDateString() pickupDate: string;
  @IsEnum(TimeSlot) pickupTimeSlot: TimeSlot;

  @IsOptional() @IsEnum(HomeSize)
  homeSize?: HomeSize;

  @IsNumber() @Min(1) @Max(3)
  moversCount: number;

  @IsEnum(ExtrasType) extras: ExtrasType;
  @IsBoolean() withStorage: boolean;

  @IsNumber() @Min(0)
  distanceKm: number; // calculated client-side via Google Maps

  @IsOptional() @IsString()
  notesForDriver?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackingMaterialDto)
  packingMaterials?: PackingMaterialDto[];

  // Deposit option
  @IsOptional() @IsBoolean()
  payDeposit?: boolean;
}

export class RescheduleBookingDto {
  @IsDateString() date: string;
  @IsEnum(TimeSlot) timeSlot: TimeSlot;
}
