import {
  IsString, IsBoolean, IsOptional, IsArray, IsEnum, IsDateString,
} from 'class-validator';
import { TimeSlot } from '@prisma/client';

export class CreateStorageDto {
  @IsOptional() @IsString()
  bookingId?: string;

  @IsString()
  deliveryAddress: string;

  @IsBoolean()
  autoRenew: boolean;
}

export class RequestDeliveryDto {
  @IsString() deliveryAddress: string;
  @IsDateString() deliveryDate: string;
  @IsEnum(TimeSlot) deliveryTimeSlot: TimeSlot;

  @IsOptional()
  @IsArray()
  itemIds?: string[]; // empty = all items
}

export class UpdateStorageDto {
  @IsOptional() @IsString() deliveryAddress?: string;
  @IsOptional() @IsString() paymentMethodId?: string;
}
