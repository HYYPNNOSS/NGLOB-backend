import {
  Controller, Post, Get, Patch, Param, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, RescheduleBookingDto } from './dto/create-booking.dto';
import { UpdateAddressesDto, UpdateItemsDto } from './dto/update-booking.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create removal booking (returns booking + pricing breakdown)' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: any) {
    return this.bookingsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get active and previous bookings' })
  findAll(@CurrentUser() user: any) {
    return this.bookingsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single booking with all detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.findOne(id, user.id);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule booking (£30 fee if <48h before move)' })
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.reschedule(id, dto, user.id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking (£60 fee if <48h before move)' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.cancel(id, user.id);
  }

  @Get(':id/tracking')
  @ApiOperation({ summary: 'Get driver GPS position (poll or use WebSocket)' })
  tracking(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.getTracking(id, user.id);
  }

  @Patch(':id/addresses')
  @ApiOperation({ summary: 'Update pick-up/delivery addresses (free if >3 days before move)' })
  updateAddresses(
    @Param('id') id: string,
    @Body() dto: UpdateAddressesDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.updateAddresses(id, dto, user.id);
  }

  @Patch(':id/items')
  @ApiOperation({ summary: 'Add, remove, or update items (free if >3 days before move)' })
  updateItems(
    @Param('id') id: string,
    @Body() dto: UpdateItemsDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.updateItems(id, dto, user.id);
  }
}
