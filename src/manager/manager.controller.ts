import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { DriverStatus, DocumentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ManagerService, ManagerBookingsQueryDto, ApplyAsManagerDto } from './manager.service';

class AssignDriverDto { 
  @IsString() driverId: string; 
  @IsOptional() @IsArray() @IsString({ each: true }) crewIds?: string[];
}
class UpdateDriverStatusDto { @IsEnum(DriverStatus) status: DriverStatus; }
class ReviewDocumentDto {
  @IsEnum(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() reviewNote?: string;
}

@ApiTags('Manager')
@ApiBearerAuth()
@Controller('manager')
export class ManagerController {
  constructor(private managerService: ManagerService) {}

  // ── Open to any authenticated user ─────────────────────────
  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Apply as a manager — creates a PENDING manager application' })
  apply(@CurrentUser() user: any, @Body() dto: ApplyAsManagerDto) {
    return this.managerService.applyAsManager(user.id, dto);
  }

  @Get('application-status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current manager application status' })
  getApplicationStatus(@CurrentUser() user: any) {
    return this.managerService.getApplicationStatus(user.id);
  }

  // ── Protected — MANAGER / ADMIN role only ──────────────────
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Dashboard stats for manager (global)' })
  getStats() {
    return this.managerService.getDashboardStats();
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'All bookings with filters (global for managers)' })
  getBookings(@Query() query: ManagerBookingsQueryDto) {
    return this.managerService.getAllBookings(query);
  }

  @Patch('bookings/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Confirm a booking' })
  confirmBooking(@Param('id') id: string) {
    return this.managerService.confirmBooking(id);
  }

  @Patch('bookings/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Cancel a booking' })
  cancelBooking(@Param('id') id: string) {
    return this.managerService.cancelBooking(id);
  }

  @Patch('bookings/:id/assign-driver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Assign a driver to a confirmed booking' })
  assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.managerService.assignDriver(id, dto.driverId, dto.crewIds);
  }

  @Get('drivers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: "List all drivers with today's schedule (global)" })
  getDrivers() {
    return this.managerService.getDrivers();
  }

  @Patch('drivers/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update a driver application status' })
  updateDriverStatus(@Param('id') id: string, @Body() dto: UpdateDriverStatusDto) {
    return this.managerService.updateDriverStatus(id, dto.status);
  }

  // ── Driver document review ─────────────────────────────────

  @Get('drivers-with-documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List all drivers with their uploaded documents' })
  getDriversWithDocuments() {
    return this.managerService.getDriversWithDocuments();
  }

  @Get('drivers/:id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get a single driver with their documents for review' })
  getDriverDocuments(@Param('id') id: string) {
    return this.managerService.getDriverDocuments(id);
  }

  @Patch('documents/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Approve or reject a specific driver document' })
  reviewDocument(
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.managerService.reviewDocument(id, dto.status, dto.reviewNote);
  }

  // ── Live Rides ─────────────────────────────────────────────

  @Get('active-rides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get all active rides with driver locations, photos, and items' })
  getActiveRides() {
    return this.managerService.getActiveRides();
  }

  @Get('rides/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get full ride detail with history' })
  getRideDetail(@Param('id') id: string) {
    return this.managerService.getRideDetail(id);
  }

  @Get('completed-rides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get recently completed rides' })
  getCompletedRides() {
    return this.managerService.getCompletedRides();
  }
}
