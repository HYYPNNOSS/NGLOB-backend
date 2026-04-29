import {
  Controller, Get, Patch, Param, Body, UseGuards, Query, Post, Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEnum } from 'class-validator';
import { DriverStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService, AdminBookingsQueryDto } from './admin.service';
import { CreateManagerDto, ApproveManagerDto, RejectManagerDto } from './dto/admin.dto';
 
class AssignDriverDto { @IsString() driverId: string; }
class UpdateDriverStatusDto { @IsEnum(DriverStatus) status: DriverStatus; }
 
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}
 
  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats — bookings, revenue, storage' })
  getStats() {
    return this.adminService.getDashboardStats();
  }
 
  @Get('bookings')
  @ApiOperation({ summary: 'All bookings with filters (status, date, driverId)' })
  getBookings(@Query() query: AdminBookingsQueryDto) {
    return this.adminService.getAllBookings(query);
  }
 
  @Patch('bookings/:id/assign-driver')
  @ApiOperation({ summary: 'Assign a driver to a booking' })
  assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.adminService.assignDriver(id, dto.driverId);
  }
 
  @Get('drivers')
  @ApiOperation({ summary: "List all drivers with today's schedule" })
  getDrivers() {
    return this.adminService.getDrivers();
  }

  @Patch('drivers/:id/status')
  @ApiOperation({ summary: 'Update a driver application status' })
  updateDriverStatus(@Param('id') id: string, @Body() dto: UpdateDriverStatusDto) {
    return this.adminService.updateDriverStatus(id, dto.status);
  }

  // ─── Manager Application Workflow ──────────────────────────

  @Get('manager-applications')
  @ApiOperation({ summary: 'List manager applications (optional status filter)' })
  getManagerApplications(@Query('status') status?: string) {
    return this.adminService.getManagerApplications(status);
  }

  @Patch('manager-applications/:id/approve')
  @ApiOperation({ summary: 'Approve a manager application' })
  approveManagerApplication(
    @Param('id') id: string,
    @Body() dto: ApproveManagerDto,
  ) {
    return this.adminService.approveManagerApplication(id, dto);
  }

  @Patch('manager-applications/:id/reject')
  @ApiOperation({ summary: 'Reject a manager application' })
  rejectManagerApplication(
    @Param('id') id: string,
    @Body() dto: RejectManagerDto,
  ) {
    return this.adminService.rejectManagerApplication(id, dto);
  }

  // ─── Manager Management ────────────────────────────────────

  @Post('managers')
  @ApiOperation({ summary: 'Create or promote user to manager (direct)' })
  createManager(@Body() dto: CreateManagerDto) {
    return this.adminService.createManager(dto);
  }

  @Get('managers')
  @ApiOperation({ summary: 'Get all active managers' })
  getManagers() {
    return this.adminService.getManagers();
  }

  @Delete('managers/:id')
  @ApiOperation({ summary: 'Remove manager role from user' })
  removeManager(@Param('id') id: string) {
    return this.adminService.removeManager(id);
  }
}
