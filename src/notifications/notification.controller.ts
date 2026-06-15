import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('unread')
  async getUnread(@Request() req) {
    return this.notificationService.getUnreadNotifications(req.user.id);
  }

  @Patch(':id/read')
  async markRead(@Request() req, @Param('id') id: string) {
    await this.notificationService.markAsRead(id, req.user.id);
    return { success: true };
  }
  
  @Patch('read-all')
  async markAllRead(@Request() req) {
    await this.notificationService.markAllAsRead(req.user.id);
    return { success: true };
  }
}
