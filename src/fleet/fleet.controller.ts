import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.ADMIN)
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('allocate/:bookingId')
  async scoreDrivers(@Param('bookingId') bookingId: string) {
    return this.fleetService.scoreDriversForBooking(bookingId);
  }
}
