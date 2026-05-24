import { IsNumber, IsString } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class UpdateBookingStatusDto {
  @IsString()
  status: string;
}
