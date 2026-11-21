import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { QueryPpasDto, SuggestPpasDto } from './dto/query-ppas.dto';
import { SubmitPpaReviewDto } from './dto/submit-ppa-review.dto';
import { UpdatePpaReviewDto } from './dto/update-ppa-review.dto';
import { PpaService } from './ppa.service';

// Fixed paths (suggest, reviews/...) come before the ones with :id so they
// are not mistaken for an id.
@UseGuards(JwtAuthGuard)
@Controller('ppas')
export class PpaController {
  constructor(private ppaService: PpaService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryPpasDto) {
    return this.ppaService.findAll(user, query);
  }

  @Get('suggest')
  suggest(@Query() query: SuggestPpasDto) {
    return this.ppaService.suggest(query);
  }

  @Get('reviews/mine')
  findMine(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.ppaService.findMine(user, query);
  }

  // Only verified serving and ex corps members. The 403 carries a `code`:
  // EMAIL_NOT_VERIFIED, VERIFICATION_REQUIRED or ROLE_NOT_ALLOWED.
  @Post('reviews')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitPpaReviewDto) {
    return this.ppaService.submit(user, dto);
  }

  @Patch('reviews/:reviewId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(@CurrentUser() user: AuthUser, @Param('reviewId') reviewId: string, @Body() dto: UpdatePpaReviewDto) {
    return this.ppaService.update(user, reviewId, dto);
  }

  @Delete('reviews/:reviewId')
  remove(@CurrentUser() user: AuthUser, @Param('reviewId') reviewId: string) {
    return this.ppaService.deleteOwn(user, reviewId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ppaService.findById(user, id);
  }

  @Get(':id/reviews')
  findReviews(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: PageQueryDto) {
    return this.ppaService.findReviews(user, id, query);
  }
}
