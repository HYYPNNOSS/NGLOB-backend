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

export class CreateManagerDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  @IsOptional()
  password?: string;
}

export class ApproveManagerDto {
  // Empty, no longer requires city
}

export class RejectManagerDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
