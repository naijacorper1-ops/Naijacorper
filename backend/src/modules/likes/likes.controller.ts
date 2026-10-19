import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { LikesService } from './likes.service';

@UseGuards(JwtAuthGuard)
@Controller('posts/:postId/like')
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  like(@CurrentUser() user: AuthUser, @Param('postId') postId: string) {
    return this.likesService.like(user.id, postId);
  }

  @Delete()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  unlike(@CurrentUser() user: AuthUser, @Param('postId') postId: string) {
    return this.likesService.unlike(user.id, postId);
  }
}
