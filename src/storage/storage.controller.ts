import {
  Controller, Post, Get, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { CreateStorageDto, RequestDeliveryDto, UpdateStorageDto } from './dto/storage.dto';

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new storage subscription' })
  create(@Body() dto: CreateStorageDto, @CurrentUser() user: any) {
    return this.storageService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all storage subscriptions for current user' })
  findAll(@CurrentUser() user: any) {
    return this.storageService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single storage with items and deliveries' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storageService.findOne(id, user.id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'List items currently in storage with weekly costs' })
  getItems(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storageService.getItems(id, user.id);
  }

  @Post(':id/delivery')
  @ApiOperation({ summary: 'Request delivery from storage (1st free, then £10+)' })
  requestDelivery(
    @Param('id') id: string,
    @Body() dto: RequestDeliveryDto,
    @CurrentUser() user: any,
  ) {
    return this.storageService.requestDelivery(id, dto, user.id);
  }

  @Patch(':id/update')
  @ApiOperation({ summary: 'Update delivery address or payment method' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStorageDto,
    @CurrentUser() user: any,
  ) {
    return this.storageService.update(id, dto, user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel storage subscription' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storageService.cancel(id, user.id);
  }
}
