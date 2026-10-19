import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto, QueryMyListingsDto } from './dto/query-listings.dto';
import { ReportListingDto } from './dto/report-listing.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { MarketplaceService } from './marketplace.service';

@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  // Selling needs a verified email. Browsing and buying do not.
  @Post('listings')
  @UseGuards(VerifiedEmailGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.marketplaceService.create(user.id, dto);
  }

  @Get('listings')
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryListingsDto) {
    return this.marketplaceService.findAll(user.id, query);
  }

  @Get('listings/mine')
  findMine(@CurrentUser() user: AuthUser, @Query() query: QueryMyListingsDto) {
    return this.marketplaceService.findMine(user.id, query);
  }

  @Get('sellers/:username')
  getSeller(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.marketplaceService.getSeller(user.id, username);
  }

  @Get('sellers/:username/listings')
  findBySeller(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query() query: QueryMyListingsDto,
  ) {
    return this.marketplaceService.findBySeller(user.id, username, query);
  }

  @Get('listings/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplaceService.findById(user.id, id);
  }

  @Patch('listings/:id')
  @UseGuards(VerifiedEmailGuard)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.marketplaceService.updateOwn(user.id, id, dto);
  }

  @Patch('listings/:id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateListingStatusDto,
  ) {
    return this.marketplaceService.updateStatus(user.id, id, dto);
  }

  @Delete('listings/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplaceService.deleteOwn(user.id, id);
  }

  // Same as POST /reports with targetType LISTING.
  @Post('listings/:id/report')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReportListingDto) {
    return this.marketplaceService.report(user.id, id, dto.reason);
  }
}
