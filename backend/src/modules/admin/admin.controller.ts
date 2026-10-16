import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { ReportDecisionDto } from './dto/report-decision.dto';
import { VerificationDecisionDto } from './dto/verification-decision.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('verifications')
  listVerifications() {
    return this.adminService.listPendingVerifications();
  }

  @Patch('verifications/:id/decision')
  decideVerification(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: VerificationDecisionDto,
  ) {
    return this.adminService.decideVerification(admin.id, id, dto);
  }

  @Get('reports')
  listReports() {
    return this.adminService.listPendingReports();
  }

  @Patch('reports/:id/decision')
  decideReport(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: ReportDecisionDto,
  ) {
    return this.adminService.decideReport(admin.id, id, dto);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }

  @Patch('users/:id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.adminService.deactivateUser(id);
  }

  @Patch('users/:id/reactivate')
  reactivateUser(@Param('id') id: string) {
    return this.adminService.reactivateUser(id);
  }
}
