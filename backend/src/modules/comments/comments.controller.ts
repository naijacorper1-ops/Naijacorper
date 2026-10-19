import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@UseGuards(JwtAuthGuard)
@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(
    @CurrentUser() user: AuthUser,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.id, postId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('postId') postId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.commentsService.findForPost(user.id, postId, query.cursor, query.pageSize);
  }

  @Get(':commentId/replies')
  findReplies(
    @CurrentUser() user: AuthUser,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.commentsService.findReplies(user.id, postId, commentId, query.cursor, query.pageSize);
  }

  @Delete(':commentId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.deleteComment(user, postId, commentId);
  }
}
