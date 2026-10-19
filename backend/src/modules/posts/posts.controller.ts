import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CreatePostDto } from './dto/create-post.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { PostsService } from './posts.service';

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.postsService.findById(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.postsService.deleteOwn(user.id, id);
  }

  @Post(':id/poll/vote')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  vote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: VotePollDto) {
    return this.postsService.vote(user.id, id, dto);
  }
}
