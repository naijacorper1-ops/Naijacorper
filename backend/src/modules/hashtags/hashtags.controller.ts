import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { SearchHashtagsDto } from './dto/search-hashtags.dto';
import { HashtagsService } from './hashtags.service';

@UseGuards(JwtAuthGuard)
@Controller('hashtags')
export class HashtagsController {
  constructor(private hashtagsService: HashtagsService) {}

  @Get('trending')
  trending() {
    return this.hashtagsService.trending();
  }

  @Get('search')
  search(@Query() query: SearchHashtagsDto) {
    return this.hashtagsService.search(query.q);
  }

  // The tag is sent without the #, for example /hashtags/nysc2026/posts
  @Get(':tag/posts')
  posts(@CurrentUser() user: AuthUser, @Param('tag') tag: string, @Query() query: PageQueryDto) {
    return this.hashtagsService.postsFor(user.id, tag, query.cursor, query.pageSize);
  }
}
