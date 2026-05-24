import {
  Controller, Post, Body, UseGuards, Get, Param, Optional
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PromoService } from './promo.service';
import { ValidatePromoDto, CreatePromoCodeDto } from './dto/promo.dto';

@ApiTags('Promo Codes')
@Controller('promo')
export class PromoController {
  constructor(private promoService: PromoService) {}

  // POST /promo/validate
  @Post('validate')
  @ApiOperation({ summary: 'Validate a promo code and get discount amount' })
  validate(@Body() dto: ValidatePromoDto, @Optional() @CurrentUser() user?: any) {
    return this.promoService.validate(dto, user?.id);
  }

  // POST /promo/admin/create
  @Post('admin/create')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new promo code (admin only)' })
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promoService['prisma'].promoCode.create({ data: { ...dto, isActive: true } });
  }
}
