import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateExploreEntryDto } from './dto/create-explore-entry.dto';
import { QueryExploreEntriesDto } from './dto/query-explore-entries.dto';
import { ExploreService } from './explore.service';

@UseGuards(JwtAuthGuard)
@Controller('explore')
export class ExploreController {
  constructor(private exploreService: ExploreService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateExploreEntryDto) {
    return this.exploreService.create(user.id, dto);
  }

  @Get()
  findAll(@Query() query: QueryExploreEntriesDto) {
    return this.exploreService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exploreService.findById(id);
  }
}
