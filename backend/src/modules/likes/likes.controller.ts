import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LikesService } from './likes.service';

@UseGuards(JwtAuthGuard)
@Controller('posts/:postId/like')
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post()
  like(@CurrentUser() user: { id: string }, @Param('postId') postId: string) {
    return this.likesService.like(user.id, postId);
  }

  @Delete()
  unlike(@CurrentUser() user: { id: string }, @Param('postId') postId: string) {
    return this.likesService.unlike(user.id, postId);
  }
}
