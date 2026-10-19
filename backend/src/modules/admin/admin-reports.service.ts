import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus, ReportTargetType, UserRole } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { AdminContentService } from './admin-content.service';
import { AdminUsersService } from './admin-users.service';
import { QueryReportsDto, ReportAction, ReportDecisionDto } from './dto/admin-reports.dto';

const REPORT_INCLUDE = {
  reporter: { select: PUBLIC_USER_SELECT },
} satisfies Prisma.ReportInclude;

type ReportRow = Prisma.ReportGetPayload<{ include: typeof REPORT_INCLUDE }>;

@Injectable()
export class AdminReportsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private contentService: AdminContentService,
    private usersService: AdminUsersService,
  ) {}

  // Each report comes with the reported item as it is now ("target", null if
  // it was deleted) and as it was when reported ("snapshot"), plus how many
  // reports that item has in total.
  async list(query: QueryReportsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const status = query.status ?? 'PENDING';
    // Oldest first for the queue, newest first for history.
    const direction = status === 'PENDING' ? 'asc' : 'desc';
    const keyset = keysetWhere<Prisma.ReportWhereInput>(query.cursor, 'createdAt', direction);

    const where: Prisma.ReportWhereInput = {
      ...(status !== 'ALL' && { status: status as ReportStatus }),
      ...(query.targetType && { targetType: query.targetType }),
    };

    const rows = await this.prisma.report.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: pageSize + 1,
      include: REPORT_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (r) => r.createdAt);

    return { reports: await this.enrich(items), nextCursor };
  }

  async getOne(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id }, include: REPORT_INCLUDE });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const [enriched] = await this.enrich([report]);
    return enriched;
  }

  async decide(admin: AuthUser, reportId: string, dto: ReportDecisionDto) {
    const action: ReportAction = dto.action ?? 'NONE';

    if (dto.status === ReportStatus.DISMISSED && action !== 'NONE') {
      throw new BadRequestException('A dismissed report cannot have an action');
    }

    const report = await this.prisma.report.findUnique({ where: { id: reportId } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (action === 'REMOVE_CONTENT' && report.targetType === ReportTargetType.USER) {
      throw new BadRequestException('A user is not content. Use DEACTIVATE_USER instead.');
    }

    // Close the report first. Only one admin can win this step, so the action
    // below cannot run twice for the same report.
    const claimed = await this.prisma.report.updateMany({
      where: { id: reportId, status: ReportStatus.PENDING },
      data: {
        status: dto.status,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        actionTaken: action,
        resolutionNote: dto.note,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This report has already been decided');
    }

    try {
      await this.performAction(admin, report.targetType, report.targetId, action, dto.note);
    } catch (error) {
      // The action failed, so the report goes back in the queue.
      await this.prisma.report.updateMany({
        where: { id: reportId },
        data: {
          status: ReportStatus.PENDING,
          reviewedBy: null,
          reviewedAt: null,
          actionTaken: null,
          resolutionNote: null,
        },
      });
      throw error;
    }

    // Other people reported the same thing. They are settled together.
    await this.prisma.report.updateMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        status: ReportStatus.PENDING,
        id: { not: reportId },
      },
      data: {
        status: dto.status,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        actionTaken: action,
        resolutionNote: `Settled together with report ${reportId}`,
      },
    });

    await this.auditService.record(admin, {
      action: AuditAction.REPORT_RESOLVED,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: dto.note,
      metadata: { reportId, status: dto.status, action },
    });

    return this.getOne(reportId);
  }

  private async performAction(
    admin: AuthUser,
    targetType: ReportTargetType,
    targetId: string,
    action: ReportAction,
    note?: string,
  ) {
    if (action === 'NONE') {
      return;
    }

    if (action === 'REMOVE_CONTENT') {
      try {
        if (targetType === ReportTargetType.POST) {
          await this.contentService.removePost(admin, targetId, note);
        } else if (targetType === ReportTargetType.COMMENT) {
          await this.contentService.removeComment(admin, targetId, note);
        } else if (targetType === ReportTargetType.LISTING) {
          await this.contentService.removeListing(admin, targetId, note);
        } else if (targetType === ReportTargetType.GROUP) {
          await this.contentService.removeGroup(admin, targetId, note);
        }
      } catch (error) {
        // Already gone (deleted by its owner) or already removed: nothing to do.
        if (error instanceof NotFoundException || error instanceof ConflictException) {
          return;
        }
        throw error;
      }

      return;
    }

    // DEACTIVATE_USER: find who owns the reported item.
    const ownerId = await this.findOwnerId(targetType, targetId);

    if (!ownerId) {
      throw new BadRequestException('The reported item no longer exists, so there is no owner to deactivate');
    }

    const owner = await this.usersService.loadTarget(ownerId);

    if (owner.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin accounts cannot be deactivated from a report');
    }

    if (owner.isActive) {
      await this.usersService.deactivate(admin, ownerId, note);
    }
  }

  private async findOwnerId(targetType: ReportTargetType, targetId: string): Promise<string | null> {
    switch (targetType) {
      case ReportTargetType.POST:
        return (await this.prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } }))?.authorId ?? null;
      case ReportTargetType.COMMENT:
        return (await this.prisma.comment.findUnique({ where: { id: targetId }, select: { authorId: true } }))?.authorId ?? null;
      case ReportTargetType.LISTING:
        return (await this.prisma.listing.findUnique({ where: { id: targetId }, select: { sellerId: true } }))?.sellerId ?? null;
      case ReportTargetType.GROUP:
        return (await this.prisma.group.findUnique({ where: { id: targetId }, select: { createdById: true } }))?.createdById ?? null;
      case ReportTargetType.USER:
        return (await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }))?.id ?? null;
    }
  }

  // Looks up all reported items of a page in one query per type (not one per report).
  private async enrich(reports: ReportRow[]) {
    const idsOf = (type: ReportTargetType) => [
      ...new Set(reports.filter((r) => r.targetType === type).map((r) => r.targetId)),
    ];

    const [posts, comments, listings, groups, users, counts] = await Promise.all([
      this.prisma.post.findMany({
        where: { id: { in: idsOf('POST') } },
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          groupId: true,
          createdAt: true,
          author: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.comment.findMany({
        where: { id: { in: idsOf('COMMENT') } },
        select: {
          id: true,
          content: true,
          postId: true,
          createdAt: true,
          author: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.listing.findMany({
        where: { id: { in: idsOf('LISTING') } },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          status: true,
          imageUrls: true,
          removedReason: true,
          seller: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.group.findMany({
        where: { id: { in: idsOf('GROUP') } },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          memberCount: true,
          createdBy: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.user.findMany({
        where: { id: { in: idsOf('USER') } },
        select: { ...PUBLIC_USER_SELECT, email: true, bio: true, isActive: true, createdAt: true },
      }),
      this.prisma.report.groupBy({
        by: ['targetType', 'targetId'],
        where: { targetId: { in: reports.map((r) => r.targetId) } },
        _count: { _all: true },
      }),
    ]);

    const live = new Map<string, unknown>();
    posts.forEach((p) => live.set(`POST:${p.id}`, p));
    comments.forEach((c) => live.set(`COMMENT:${c.id}`, c));
    listings.forEach((l) => live.set(`LISTING:${l.id}`, l));
    groups.forEach((g) => live.set(`GROUP:${g.id}`, g));
    users.forEach((u) => live.set(`USER:${u.id}`, u));

    const totals = new Map(counts.map((c) => [`${c.targetType}:${c.targetId}`, c._count._all]));

    return reports.map((report) => {
      const key = `${report.targetType}:${report.targetId}`;
      const target = live.get(key) ?? null;

      return {
        ...report,
        target,
        targetExists: target !== null,
        totalReportsOnTarget: totals.get(key) ?? 1,
      };
    });
  }
}
