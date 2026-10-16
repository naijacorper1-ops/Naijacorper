import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PostsService } from '../posts/posts.service';
import { UsersService } from '../users/users.service';
import { ReportDecisionDto } from './dto/report-decision.dto';
import { VerificationDecisionDto } from './dto/verification-decision.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private postsService: PostsService,
    private usersService: UsersService,
  ) {}

  async listPendingVerifications() {
    return this.prisma.verificationDocument.findMany({
      where: { status: VerificationStatus.PENDING },
      include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async decideVerification(adminId: string, documentId: string, dto: VerificationDecisionDto) {
    const document = await this.prisma.verificationDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Verification document not found');
    }

    await this.prisma.verificationDocument.update({
      where: { id: documentId },
      data: { status: dto.decision, reviewedBy: adminId, reviewedAt: new Date() },
    });

    return this.usersService.updateById(document.userId, { verificationStatus: dto.decision });
  }

  async listPendingReports() {
    return this.prisma.report.findMany({
      where: { status: ReportStatus.PENDING },
      include: { reporter: { select: { id: true, username: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async decideReport(adminId: string, reportId: string, dto: ReportDecisionDto) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status, reviewedBy: adminId, reviewedAt: new Date() },
    });
  }

  async deletePost(postId: string) {
    return this.postsService.adminDelete(postId);
  }

  async deactivateUser(userId: string) {
    await this.usersService.setActive(userId, false);

    // Deactivating should end every existing session, not just block new logins.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    return { deactivated: true };
  }

  async reactivateUser(userId: string) {
    await this.usersService.setActive(userId, true);
    return { deactivated: false };
  }
}
