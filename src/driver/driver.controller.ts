import {
  Controller, Get, Post, Put, Patch, Param, Body, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DriverService,
  UpdateLocationDto,
  UpdateBookingStatusDto,
  ApplyAsDriverDto,
  UploadDocumentDto,
  SetAvailabilityDto,
  ToggleDayDto,
} from './driver.service';

const documentStorage = memoryStorage();
 
@ApiTags('Driver')
@ApiBearerAuth()
@Controller('driver')
export class DriverController {
  constructor(private driverService: DriverService) {}

  // ── Open to any authenticated user ─────────────────────────
  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Apply as a driver — creates a PENDING driver profile' })
  apply(@CurrentUser() user: any, @Body() dto: ApplyAsDriverDto) {
    return this.driverService.applyAsDriver(user.id, dto);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current driver application status (PENDING/APPROVED/REJECTED or null)' })
  getStatus(@CurrentUser() user: any) {
    return this.driverService.getDriverStatus(user.id);
  }

  // ── Document management ────────────────────────────────────
  @Get('documents')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all documents for the current driver' })
  getDocuments(@CurrentUser() user: any) {
    return this.driverService.getDocuments(user.id);
  }

  @Post('documents/upload')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload (or re-upload) a driver document with file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: documentStorage, limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    const fileUrl = file ? `/uploads/documents/${uuidv4()}${extname(file.originalname)}` : undefined;
    return this.driverService.uploadDocument(user.id, {
      ...dto,
      fileName: file?.originalname || dto.fileName,
      fileUrl,
    });
  }

  @Post('documents/submit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit all documents for manager review' })
  submitDocuments(@CurrentUser() user: any) {
    return this.driverService.submitDocumentsForReview(user.id);
  }

  // ── Protected — DRIVER role only ───────────────────────────
  @Patch('location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Update driver GPS — broadcasts to all active booking sockets' })
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: any) {
    return this.driverService.updateLocation(user.id, dto);
  }
 
  @Get('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiOperation({ summary: "Get today's assigned bookings" })
  getAssignments(@CurrentUser() user: any) {
    return this.driverService.getAssignments(user.id);
  }
 
  @Patch('assignments/:bookingId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Set booking status (LOADED | DELIVERED | UNREACHABLE)' })
  updateStatus(
    @Param('bookingId') bookingId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const { status, truckPhoto, extraItem, extraTimeHours, extraTimeCost, extraTimePayment, ...rest } = body;
    return this.driverService.updateBookingStatus(bookingId, status, user.id, {
      truckPhoto,
      extraItem,
      extraTimeHours,
      extraTimeCost,
      extraTimePayment,
    });
  }

  // ── Availability management ────────────────────────────────
  @Get('availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Get weekly availability schedule' })
  getAvailability(@CurrentUser() user: any) {
    return this.driverService.getAvailability(user.id);
  }

  @Put('availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Set full weekly availability schedule' })
  setAvailability(@CurrentUser() user: any, @Body() dto: SetAvailabilityDto) {
    return this.driverService.setAvailability(user.id, dto.slots);
  }

  @Patch('availability/:day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Toggle a single day on/off' })
  toggleDay(
    @Param('day') day: string,
    @Body() dto: ToggleDayDto,
    @CurrentUser() user: any,
  ) {
    return this.driverService.toggleDayAvailability(user.id, parseInt(day), dto.isActive, dto.startTime, dto.endTime);
  }
}
