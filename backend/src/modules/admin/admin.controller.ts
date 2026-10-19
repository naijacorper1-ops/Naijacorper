import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user';
import { AdminContentService } from './admin-content.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';
import { AdminVerificationsService } from './admin-verifications.service';
import {
  QueryAdminGroupsDto,
  QueryAdminListingsDto,
  QueryAdminPostsDto,
  QueryAuditLogsDto,
} from './dto/admin-content.dto';
import { QueryReportsDto, ReportDecisionDto } from './dto/admin-reports.dto';
import { ChangeRoleDto, QueryAdminUsersDto, SetVerificationDto } from './dto/admin-users.dto';
import { QueryVerificationsDto, VerificationDecisionDto } from './dto/admin-verifications.dto';
import { OptionalReasonDto, RequiredReasonDto } from './dto/reason.dto';

// Every route here needs an ADMIN account. The role is read from the
// database on each request, so removing someone's admin role (or
// deactivating them) takes effect immediately.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private statsService: AdminStatsService,
    private usersService: AdminUsersService,
    private verificationsService: AdminVerificationsService,
    private reportsService: AdminReportsService,
    private contentService: AdminContentService,
  ) {}

  // Dashboard

  @Get('stats')
  stats() {
    return this.statsService.overview();
  }

  @Get('audit-logs')
  auditLogs(@Query() query: QueryAuditLogsDto) {
    return this.statsService.auditLogs(query);
  }

  // Users

  @Get('users')
  listUsers(@Query() query: QueryAdminUsersDto) {
    return this.usersService.list(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.usersService.getOne(id);
  }

  @Patch('users/:id/deactivate')
  deactivateUser(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.usersService.deactivate(admin, id, dto.reason);
  }

  @Patch('users/:id/reactivate')
  reactivateUser(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.usersService.reactivate(admin, id, dto.reason);
  }

  @Patch('users/:id/role')
  changeRole(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.usersService.changeRole(admin, id, dto);
  }

  @Patch('users/:id/verification')
  setVerification(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetVerificationDto,
  ) {
    return this.usersService.setVerification(admin, id, dto);
  }

  // Verification requests

  @Get('verifications')
  listVerifications(@Query() query: QueryVerificationsDto) {
    return this.verificationsService.list(query);
  }

  // A fresh link to the uploaded document, valid for 10 minutes.
  @Get('verifications/:id/document')
  getDocument(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.verificationsService.getDocumentLink(admin, id);
  }

  @Patch('verifications/:id/decision')
  decideVerification(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: VerificationDecisionDto,
  ) {
    return this.verificationsService.decide(admin, id, dto);
  }

  // Reports

  @Get('reports')
  listReports(@Query() query: QueryReportsDto) {
    return this.reportsService.list(query);
  }

  @Get('reports/:id')
  getReport(@Param('id') id: string) {
    return this.reportsService.getOne(id);
  }

  @Patch('reports/:id/decision')
  decideReport(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: ReportDecisionDto) {
    return this.reportsService.decide(admin, id, dto);
  }

  // Posts and comments

  @Get('posts')
  listPosts(@Query() query: QueryAdminPostsDto) {
    return this.contentService.listPosts(query);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.contentService.getPost(id);
  }

  @Delete('posts/:id')
  deletePost(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.contentService.removePost(admin, id, dto.reason);
  }

  @Delete('comments/:id')
  deleteComment(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.contentService.removeComment(admin, id, dto.reason);
  }

  // Marketplace

  @Get('listings')
  listListings(@Query() query: QueryAdminListingsDto) {
    return this.contentService.listListings(query);
  }

  @Get('listings/:id')
  getListing(@Param('id') id: string) {
    return this.contentService.getListing(id);
  }

  @Patch('listings/:id/remove')
  removeListing(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RequiredReasonDto) {
    return this.contentService.removeListing(admin, id, dto.reason);
  }

  @Patch('listings/:id/restore')
  restoreListing(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.contentService.restoreListing(admin, id, dto.reason);
  }

  // Groups and Explore

  @Get('groups')
  listGroups(@Query() query: QueryAdminGroupsDto) {
    return this.contentService.listGroups(query);
  }

  @Delete('groups/:id')
  deleteGroup(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.contentService.removeGroup(admin, id, dto.reason);
  }

  @Delete('explore/:id')
  deleteExploreEntry(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: OptionalReasonDto) {
    return this.contentService.removeExploreEntry(admin, id, dto.reason);
  }
}
