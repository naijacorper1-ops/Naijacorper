import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  conversationId?: string;
}

type PreferenceKey = 'likes' | 'comments' | 'follows' | 'messages';

const TYPE_TO_PREFERENCE_KEY: Record<NotificationType, PreferenceKey> = {
  LIKE: 'likes',
  COMMENT: 'comments',
  REPLY: 'comments',
  FOLLOW: 'follows',
  MESSAGE: 'messages',
};

const PAGE_SIZE = 30;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Called by Likes, Comments, Follows, and Messaging — never called
  // directly from a controller. Silently no-ops for self-actions and
  // for types the recipient has turned off, so callers don't need to
  // check either condition themselves.
  async create(input: CreateNotificationInput) {
    if (input.recipientId === input.actorId) {
      return null;
    }

    if (!(await this.isEnabled(input.recipientId, input.type))) {
      return null;
    }

    return this.prisma.notification.create({
      data: input,
      include: { actor: { select: { id: true, username: true, fullName: true } } },
    });
  }

  async findForUser(userId: string, cursor?: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      take: PAGE_SIZE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, username: true, fullName: true } } },
    });

    const nextCursor =
      notifications.length === PAGE_SIZE ? notifications[notifications.length - 1].id : null;

    return { notifications, nextCursor };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, read: false },
    });

    return { count };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.recipientId !== userId) {
      return { updated: false };
    }

    await this.prisma.notification.update({ where: { id }, data: { read: true } });
    return { updated: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });

    return { updated: true };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  private async isEnabled(userId: string, type: NotificationType) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return true;
    }

    const key = TYPE_TO_PREFERENCE_KEY[type];
    return preference[key];
  }
}
