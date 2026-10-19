import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FollowsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private moderationService: ModerationService,
  ) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, isActive: true },
    });

    if (!target || !target.isActive) {
      throw new NotFoundException('User not found');
    }

    await this.moderationService.assertNotBlocked(followerId, followingId);

    try {
      await this.prisma.follow.create({ data: { followerId, followingId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Already following this user');
      }
      throw error;
    }

    await this.notificationsService.create({
      recipientId: followingId,
      actorId: followerId,
      type: NotificationType.FOLLOW,
    });

    return { following: true };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId, followingId } });
    return { following: false };
  }
}
