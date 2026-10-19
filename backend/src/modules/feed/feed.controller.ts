import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';

@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Get()
  getFeed(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto) {
    return this.feedService.getFeed(user.id, query);
  }

  @Get('trending')
  getTrending(@CurrentUser() user: AuthUser) {
    return this.feedService.getTrending(user.id);
  }
}
