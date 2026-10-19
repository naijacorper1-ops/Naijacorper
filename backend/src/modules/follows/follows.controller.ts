import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { FollowsService } from './follows.service';

@UseGuards(JwtAuthGuard)
@Controller('users/:userId/follow')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  follow(@CurrentUser() user: AuthUser, @Param('userId') targetUserId: string) {
    return this.followsService.follow(user.id, targetUserId);
  }

  @Delete()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  unfollow(@CurrentUser() user: AuthUser, @Param('userId') targetUserId: string) {
    return this.followsService.unfollow(user.id, targetUserId);
  }
}
