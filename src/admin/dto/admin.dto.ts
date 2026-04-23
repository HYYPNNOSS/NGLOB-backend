import { IsOptional, IsString } from 'class-validator';

export class AdminBookingsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  driverId?: string;
}

export class AssignDriverDto {
  @IsString()
  driverId: string;
}
