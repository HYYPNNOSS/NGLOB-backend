import {
  Controller, Get, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DriverService, UpdateLocationDto, UpdateBookingStatusDto } from './driver.service';
 
@ApiTags('Driver')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
@Controller('driver')
export class DriverController {
  constructor(private driverService: DriverService) {}
 
  @Patch('location')
  @ApiOperation({ summary: 'Update driver GPS — broadcasts to all active booking sockets' })
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: any) {
    return this.driverService.updateLocation(user.id, dto);
  }
 
  @Get('assignments')
  @ApiOperation({ summary: "Get today's assigned bookings" })
  getAssignments(@CurrentUser() user: any) {
    return this.driverService.getAssignments(user.id);
  }
 
  @Patch('assignments/:bookingId/status')
  @ApiOperation({ summary: 'Set booking status (LOADED | DELIVERED | UNREACHABLE)' })
  updateStatus(
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.driverService.updateBookingStatus(bookingId, dto.status, user.id);
  }
}
