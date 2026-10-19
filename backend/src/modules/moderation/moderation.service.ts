import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus, ReportTargetType } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { PrismaService } from '../../database/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  async createReport(reporterId: string, dto: CreateReportDto) {
    const { snapshot, ownerId } = await this.loadTarget(dto.targetType, dto.targetId);

    if (ownerId === reporterId) {
      throw new BadRequestException('You cannot report your own content');
    }

    const duplicate = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: ReportStatus.PENDING,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('You have already reported this and it is still being reviewed');
    }

    // The snapshot is a copy of what was reported. If the owner deletes it
    // afterwards, the admin can still see what the report was about.
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        snapshot,
      },
      select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true },
    });

    return report;
  }

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (existing) {
      throw new ConflictException('Already blocked');
    }

    // Blocking also ends any follow in either direction.
    await this.prisma.$transaction([
      this.prisma.block.create({ data: { blockerId, blockedId } }),
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
      }),
    ]);

    return { blocked: true };
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  async mute(muterId: string, mutedId: string) {
    if (muterId === mutedId) {
      throw new BadRequestException('You cannot mute yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: mutedId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.mute.findUnique({
      where: { muterId_mutedId: { muterId, mutedId } },
    });

    if (existing) {
      throw new ConflictException('Already muted');
    }

    await this.prisma.mute.create({ data: { muterId, mutedId } });
    return { muted: true };
  }

  async unmute(muterId: string, mutedId: string) {
    await this.prisma.mute.deleteMany({ where: { muterId, mutedId } });
    return { muted: false };
  }

  // The people this user has blocked, so the app can show an unblock list.
  async listBlocked(userId: string) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: { createdAt: true, blocked: { select: PUBLIC_USER_SELECT } },
    });

    return rows.map((row) => ({ ...row.blocked, blockedAt: row.createdAt }));
  }

  async listMuted(userId: string) {
    const rows = await this.prisma.mute.findMany({
      where: { muterId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: { createdAt: true, muted: { select: PUBLIC_USER_SELECT } },
    });

    return rows.map((row) => ({ ...row.muted, mutedAt: row.createdAt }));
  }

  // Blocks in both directions plus anyone this user has muted. Used to keep
  // those people's posts out of the feed.
  async getExcludedAuthorIds(userId: string): Promise<string[]> {
    const [blocked, muted] = await Promise.all([
      this.getBlockedIds(userId),
      this.prisma.mute.findMany({ where: { muterId: userId }, select: { mutedId: true } }),
    ]);

    return [...new Set([...blocked, ...muted.map((m) => m.mutedId)])];
  }

  // Only blocks, in both directions. A mute is private and one-sided, so it
  // should not hide someone from search, comments or follower lists.
  async getBlockedIds(userId: string): Promise<string[]> {
    const [blocked, blockedBy] = await Promise.all([
      this.prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
      this.prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
    ]);

    return [...new Set([...blocked.map((b) => b.blockedId), ...blockedBy.map((b) => b.blockerId)])];
  }

  // Either direction blocks messaging and other interaction.
  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
      select: { id: true },
    });

    return !!block;
  }

  // Used before liking, commenting, following, voting and so on.
  async assertNotBlocked(userAId: string, userBId: string) {
    if (userAId !== userBId && (await this.isBlocked(userAId, userBId))) {
      throw new ForbiddenException('You cannot interact with this user');
    }
  }

  // Finds what is being reported and copies the parts an admin needs.
  private async loadTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<{ snapshot: Prisma.InputJsonValue; ownerId: string | null }> {
    if (targetType === ReportTargetType.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
        select: {
          content: true,
          mediaUrls: true,
          repostOfId: true,
          groupId: true,
          authorId: true,
          author: { select: { username: true } },
        },
      });

      if (!post) {
        throw new NotFoundException('Reported post not found');
      }

      return {
        ownerId: post.authorId,
        snapshot: {
          content: post.content,
          mediaUrls: post.mediaUrls,
          repostOfId: post.repostOfId,
          groupId: post.groupId,
          authorId: post.authorId,
          authorUsername: post.author.username,
        },
      };
    }

    if (targetType === ReportTargetType.COMMENT) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          content: true,
          postId: true,
          authorId: true,
          author: { select: { username: true } },
        },
      });

      if (!comment) {
        throw new NotFoundException('Reported comment not found');
      }

      return {
        ownerId: comment.authorId,
        snapshot: {
          content: comment.content,
          postId: comment.postId,
          authorId: comment.authorId,
          authorUsername: comment.author.username,
        },
      };
    }

    if (targetType === ReportTargetType.LISTING) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: targetId },
        select: {
          title: true,
          description: true,
          price: true,
          category: true,
          imageUrls: true,
          status: true,
          sellerId: true,
          seller: { select: { username: true } },
        },
      });

      if (!listing) {
        throw new NotFoundException('Reported listing not found');
      }

      return {
        ownerId: listing.sellerId,
        snapshot: {
          title: listing.title,
          description: listing.description,
          price: listing.price,
          category: listing.category,
          imageUrls: listing.imageUrls,
          status: listing.status,
          sellerId: listing.sellerId,
          sellerUsername: listing.seller.username,
        },
      };
    }

    if (targetType === ReportTargetType.GROUP) {
      const group = await this.prisma.group.findUnique({
        where: { id: targetId },
        select: {
          name: true,
          slug: true,
          description: true,
          createdById: true,
          createdBy: { select: { username: true } },
        },
      });

      if (!group) {
        throw new NotFoundException('Reported group not found');
      }

      return {
        ownerId: group.createdById,
        snapshot: {
          name: group.name,
          slug: group.slug,
          description: group.description,
          createdById: group.createdById,
          createdByUsername: group.createdBy.username,
        },
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, fullName: true, bio: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('Reported user not found');
    }

    return {
      ownerId: user.id,
      snapshot: {
        username: user.username,
        fullName: user.fullName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
