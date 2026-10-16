import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { MarketplaceService } from './marketplace.service';

@UseGuards(JwtAuthGuard)
@Controller('marketplace/listings')
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateListingDto) {
    return this.marketplaceService.create(user.id, dto);
  }

  @Get()
  findAll(@Query() query: QueryListingsDto) {
    return this.marketplaceService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketplaceService.findById(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.marketplaceService.updateOwn(user.id, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateListingStatusDto,
  ) {
    return this.marketplaceService.updateStatus(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.marketplaceService.deleteOwn(user.id, id);
  }
}
