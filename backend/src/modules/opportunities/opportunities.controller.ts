import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import {
  QueryMyOpportunitiesDto,
  QueryOpportunitiesDto,
  UpdateOpportunityStatusDto,
} from './dto/query-opportunities.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { OpportunitiesService } from './opportunities.service';

@UseGuards(JwtAuthGuard)
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private opportunitiesService: OpportunitiesService) {}

  // Who may post, and whether it goes live at once or waits for an admin, is
  // decided in the service (see common/utils/publishing.ts). The 403 carries a
  // `code`: EMAIL_NOT_VERIFIED, VERIFICATION_REQUIRED or ROLE_NOT_ALLOWED.
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryOpportunitiesDto) {
    return this.opportunitiesService.findAll(user, query);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser, @Query() query: QueryMyOpportunitiesDto) {
    return this.opportunitiesService.findMine(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.opportunitiesService.findById(user, id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunitiesService.update(user, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityStatusDto,
  ) {
    return this.opportunitiesService.setStatus(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.opportunitiesService.deleteOwn(user, id);
  }
}
