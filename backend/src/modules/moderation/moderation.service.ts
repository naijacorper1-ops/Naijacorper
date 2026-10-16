import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  async createReport(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
  }

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: blockedId } });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (existing) {
      throw new ConflictException('Already blocked');
    }

    await this.prisma.block.create({ data: { blockerId, blockedId } });
    return { blocked: true };
  }

  async unblock(blockerId: string, blockedId: string) {
    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (existing) {
      await this.prisma.block.delete({ where: { id: existing.id } });
    }

    return { blocked: false };
  }

  async mute(muterId: string, mutedId: string) {
    if (muterId === mutedId) {
      throw new BadRequestException('You cannot mute yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: mutedId } });

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
    const existing = await this.prisma.mute.findUnique({
      where: { muterId_mutedId: { muterId, mutedId } },
    });

    if (existing) {
      await this.prisma.mute.delete({ where: { id: existing.id } });
    }

    return { muted: false };
  }

  // Used by FeedService to keep both directions of a block, plus
  // anyone this user has muted, out of their feed.
  async getExcludedAuthorIds(userId: string): Promise<string[]> {
    const [blocked, blockedBy, muted] = await Promise.all([
      this.prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
      this.prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
      this.prisma.mute.findMany({ where: { muterId: userId }, select: { mutedId: true } }),
    ]);

    return [
      ...blocked.map((b) => b.blockedId),
      ...blockedBy.map((b) => b.blockerId),
      ...muted.map((m) => m.mutedId),
    ];
  }

  // Used by MessagingService — either direction blocks messaging.
  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });

    return !!block;
  }

  private async assertTargetExists(targetType: ReportTargetType, targetId: string) {
    if (targetType === ReportTargetType.POST) {
      const post = await this.prisma.post.findUnique({ where: { id: targetId } });

      if (!post) {
        throw new NotFoundException('Reported post not found');
      }

      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetId } });

    if (!user) {
      throw new NotFoundException('Reported user not found');
    }
  }
}
