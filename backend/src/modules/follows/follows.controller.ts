import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FollowsService } from './follows.service';

@UseGuards(JwtAuthGuard)
@Controller('users/:userId/follow')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post()
  follow(@CurrentUser() user: { id: string }, @Param('userId') targetUserId: string) {
    return this.followsService.follow(user.id, targetUserId);
  }

  @Delete()
  unfollow(@CurrentUser() user: { id: string }, @Param('userId') targetUserId: string) {
    return this.followsService.unfollow(user.id, targetUserId);
  }
}
