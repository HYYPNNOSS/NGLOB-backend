import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsString() storageDeliveryId?: string;
  @IsOptional() @IsBoolean() isDeposit?: boolean;
}
