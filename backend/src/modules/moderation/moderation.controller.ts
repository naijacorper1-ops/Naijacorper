import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ModerationService } from './moderation.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @Post('reports')
  createReport(@CurrentUser() user: { id: string }, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(user.id, dto);
  }

  @Post('users/:userId/block')
  block(@CurrentUser() user: { id: string }, @Param('userId') targetUserId: string) {
    return this.moderationService.block(user.id, targetUserId);
  }

  @Delete('users/:userId/block')
  unblock(@CurrentUser() user: { id: string }, @Param('userId') targetUserId: string) {
    return this.moderationService.unblock(user.id, targetUserId);
  }

  @Post('users/:userId/mute')
  mute(@CurrentUser() user: { id: string }, @Param('userId') targetUserId: string) {
    return this.moderationService.mute(user.id, targetUserId);
  }

  @Delete('users/:userId/mute')
  unmute(@CurrentUser() user: { id: string }, @Param('userId') targetUserId: string) {
    return this.moderationService.unmute(user.id, targetUserId);
  }
}
