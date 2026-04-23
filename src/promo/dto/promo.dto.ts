import { IsString, IsEnum, IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class ValidatePromoDto {
  @IsString() code: string;
  @IsOptional() @IsNumber() bookingTotal?: number;
}

export class CreatePromoCodeDto {
  @IsString() code: string;
  @IsEnum(['PERCENT', 'FIXED']) type: 'PERCENT' | 'FIXED';
  @IsNumber() @Min(0) @Max(100) value: number;
  @IsOptional() @IsNumber() maxUses?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
}
