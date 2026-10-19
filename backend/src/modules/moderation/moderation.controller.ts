import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CreateReportDto } from './dto/create-report.dto';
import { ModerationService } from './moderation.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  // Report a post, comment, listing, group or user.
  @Post('reports')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  createReport(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(user.id, dto);
  }

  @Get('users/me/blocked')
  listBlocked(@CurrentUser() user: AuthUser) {
    return this.moderationService.listBlocked(user.id);
  }

  @Get('users/me/muted')
  listMuted(@CurrentUser() user: AuthUser) {
    return this.moderationService.listMuted(user.id);
  }

  @Post('users/:userId/block')
  block(@CurrentUser() user: AuthUser, @Param('userId') targetUserId: string) {
    return this.moderationService.block(user.id, targetUserId);
  }

  @Delete('users/:userId/block')
  unblock(@CurrentUser() user: AuthUser, @Param('userId') targetUserId: string) {
    return this.moderationService.unblock(user.id, targetUserId);
  }

  @Post('users/:userId/mute')
  mute(@CurrentUser() user: AuthUser, @Param('userId') targetUserId: string) {
    return this.moderationService.mute(user.id, targetUserId);
  }

  @Delete('users/:userId/mute')
  unmute(@CurrentUser() user: AuthUser, @Param('userId') targetUserId: string) {
    return this.moderationService.unmute(user.id, targetUserId);
  }
}
