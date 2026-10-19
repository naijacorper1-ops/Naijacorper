import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { ChangeRoleDto, QueryAdminUsersDto, SetVerificationDto } from './dto/admin-users.dto';

// What an admin sees about an account. Never the password hash.
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  verificationStatus: true,
  isVerified: true,
  emailVerified: true,
  isActive: true,
  state: true,
  bio: true,
  avatarUrl: true,
  createdAt: true,
  _count: { select: { posts: true, listings: true, followers: true, following: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async list(query: QueryAdminUsersDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.UserWhereInput>(query.cursor);

    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.verification && { verificationStatus: query.verification }),
      ...(query.status && { isActive: query.status === 'active' }),
      ...(query.q && {
        OR: [
          { username: { contains: query.q, mode: 'insensitive' } },
          { fullName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const rows = await this.prisma.user.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      select: ADMIN_USER_SELECT,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (u) => u.createdAt);

    return { users: items.map((u) => this.shape(u)), nextCursor };
  }

  async getOne(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...ADMIN_USER_SELECT,
        lga: true,
        batch: true,
        stream: true,
        ppa: true,
        nyscStage: true,
        interests: true,
        onboardingCompleted: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [reportsAgainst, pendingReportsAgainst, reportsFiled, latestVerification] =
      await Promise.all([
        this.prisma.report.count({ where: { targetType: 'USER', targetId: userId } }),
        this.prisma.report.count({
          where: { targetType: 'USER', targetId: userId, status: 'PENDING' },
        }),
        this.prisma.report.count({ where: { reporterId: userId } }),
        this.prisma.verificationDocument.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            documentType: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            reviewedAt: true,
          },
        }),
      ]);

    return { ...this.shape(user), reportsAgainst, pendingReportsAgainst, reportsFiled, latestVerification };
  }

  async deactivate(admin: AuthUser, userId: string, reason?: string) {
    const target = await this.loadTarget(userId);

    if (target.id === admin.id) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (target.role === UserRole.ADMIN) {
      throw new ForbiddenException('Remove the admin role first, then deactivate the account');
    }

    // Deactivating ends every session too. The access token stops working at
    // once because it is checked against the database on every request.
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    await this.auditService.record(admin, {
      action: AuditAction.USER_DEACTIVATED,
      targetType: 'USER',
      targetId: userId,
      reason,
      metadata: { username: target.username },
    });

    return { deactivated: true };
  }

  async reactivate(admin: AuthUser, userId: string, reason?: string) {
    const target = await this.loadTarget(userId);

    await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });

    await this.auditService.record(admin, {
      action: AuditAction.USER_REACTIVATED,
      targetType: 'USER',
      targetId: userId,
      reason,
      metadata: { username: target.username },
    });

    return { deactivated: false };
  }

  async changeRole(admin: AuthUser, userId: string, dto: ChangeRoleDto) {
    const target = await this.loadTarget(userId);

    if (target.id === admin.id) {
      throw new BadRequestException('You cannot change your own role');
    }

    if (target.role === dto.role) {
      return this.getOne(userId);
    }

    if (dto.role === UserRole.ADMIN) {
      if (!target.isActive || !target.emailVerified) {
        throw new BadRequestException(
          'Only an active account with a verified email can be made an admin',
        );
      }
    }

    await this.prisma.user.update({ where: { id: userId }, data: { role: dto.role } });

    await this.auditService.record(admin, {
      action: AuditAction.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: userId,
      reason: dto.reason,
      metadata: { username: target.username, from: target.role, to: dto.role },
    });

    return this.getOne(userId);
  }

  // Gives or takes away the verified badge by hand, without a document.
  async setVerification(admin: AuthUser, userId: string, dto: SetVerificationDto) {
    const target = await this.loadTarget(userId);
    const verified = dto.status === VerificationStatus.VERIFIED;

    await this.prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: dto.status, isVerified: verified },
    });

    await this.auditService.record(admin, {
      action: AuditAction.USER_VERIFICATION_CHANGED,
      targetType: 'USER',
      targetId: userId,
      reason: dto.reason,
      metadata: { username: target.username, to: dto.status },
    });

    return this.getOne(userId);
  }

  // Used by the report flow too.
  async loadTarget(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, isActive: true, emailVerified: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private shape<T extends { _count: { posts: number; listings: number; followers: number; following: number } }>(
    user: T,
  ) {
    const { _count, ...rest } = user;

    return {
      ...rest,
      postsCount: _count.posts,
      listingsCount: _count.listings,
      followersCount: _count.followers,
      followingCount: _count.following,
    };
  }
}
