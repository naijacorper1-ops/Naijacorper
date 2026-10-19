import { Injectable } from '@nestjs/common';
import { ListingStatus, Prisma, ReportStatus, VerificationStatus } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { QueryAuditLogsDto } from './dto/admin-content.dto';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsService {
  constructor(private prisma: PrismaService) {}

  // The numbers for the admin dashboard's front page.
  async overview() {
    const now = Date.now();
    const since7 = new Date(now - 7 * DAY);
    const since30 = new Date(now - 30 * DAY);
    const since14 = new Date(now - 14 * DAY);

    const [
      usersTotal,
      usersActive,
      usersVerified,
      usersEmailUnverified,
      usersNew7,
      usersNew30,
      usersByRole,
      postsTotal,
      postsNew7,
      commentsTotal,
      listingsByStatus,
      listingsNew7,
      groupsTotal,
      exploreTotal,
      pendingReports,
      pendingVerifications,
      messages7,
      signupsByDay,
      postsByDay,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.user.count({ where: { emailVerified: false } }),
      this.prisma.user.count({ where: { createdAt: { gt: since7 } } }),
      this.prisma.user.count({ where: { createdAt: { gt: since30 } } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.post.count(),
      this.prisma.post.count({ where: { createdAt: { gt: since7 } } }),
      this.prisma.comment.count(),
      this.prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.listing.count({ where: { createdAt: { gt: since7 } } }),
      this.prisma.group.count(),
      this.prisma.exploreEntry.count(),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.verificationDocument.count({ where: { status: VerificationStatus.PENDING } }),
      this.prisma.message.count({ where: { createdAt: { gt: since7 } } }),
      this.prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM users WHERE "createdAt" > ${since14} GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM posts WHERE "createdAt" > ${since14} GROUP BY 1 ORDER BY 1`,
    ]);

    const listing = (status: ListingStatus) =>
      listingsByStatus.find((l) => l.status === status)?._count._all ?? 0;

    return {
      // Things that need an admin's attention right now.
      needsAttention: { pendingReports, pendingVerifications },
      users: {
        total: usersTotal,
        active: usersActive,
        deactivated: usersTotal - usersActive,
        verified: usersVerified,
        emailNotVerified: usersEmailUnverified,
        newLast7Days: usersNew7,
        newLast30Days: usersNew30,
        byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])),
      },
      posts: { total: postsTotal, newLast7Days: postsNew7 },
      comments: { total: commentsTotal },
      listings: {
        available: listing(ListingStatus.AVAILABLE),
        sold: listing(ListingStatus.SOLD),
        removed: listing(ListingStatus.REMOVED),
        newLast7Days: listingsNew7,
      },
      groups: { total: groupsTotal },
      explore: { total: exploreTotal },
      messages: { last7Days: messages7 },
      // One row per day (UTC) for the last 14 days, days with nothing are left out.
      signupsByDay: signupsByDay.map((r) => ({ day: r.day, count: r.count })),
      postsByDay: postsByDay.map((r) => ({ day: r.day, count: r.count })),
    };
  }

  async auditLogs(query: QueryAuditLogsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.AuditLogWhereInput>(query.cursor);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action && { action: query.action }),
      ...(query.adminId && { adminId: query.adminId }),
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
    };

    const rows = await this.prisma.auditLog.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (l) => l.createdAt);

    return { logs: items, nextCursor };
  }
}
