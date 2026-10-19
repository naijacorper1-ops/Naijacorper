import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LikesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private moderationService: ModerationService,
  ) {}

  async like(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, author: { select: { isActive: true } } },
    });

    if (!post || !post.author.isActive) {
      throw new NotFoundException('Post not found');
    }

    await this.moderationService.assertNotBlocked(userId, post.authorId);

    try {
      // The like and the counter change together or not at all. The database's
      // unique rule means two taps at once cannot both count.
      await this.prisma.$transaction([
        this.prisma.like.create({ data: { userId, postId } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Already liked');
      }
      throw error;
    }

    await this.notificationsService.create({
      recipientId: post.authorId,
      actorId: userId,
      type: NotificationType.LIKE,
      postId,
    });

    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.like.deleteMany({ where: { userId, postId } });

      // Only lower the counter if a like was really removed.
      if (removed.count > 0) {
        await tx.post.updateMany({
          where: { id: postId, likeCount: { gt: 0 } },
          data: { likeCount: { decrement: 1 } },
        });
      }
    });

    return { liked: false };
  }
}
