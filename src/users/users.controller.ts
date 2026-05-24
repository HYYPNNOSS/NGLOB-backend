import {
  Controller, Get, Patch, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService, UpdateUserDto } from './users.service';
 
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
 
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }
 
  @Patch('me')
  @ApiOperation({ summary: 'Update name, email or phone' })
  updateMe(@Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(user.id, dto);
  }
 
  @Get('me/bonuses')
  @ApiOperation({ summary: 'Get bonus points balance and transaction history' })
  getBonuses(@CurrentUser() user: any) {
    return this.usersService.getBonuses(user.id);
  }
}
