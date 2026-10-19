import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { PrismaService } from '../../database/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

export interface CreateNotificationInput {
  recipientId: string;
  // Left out for notifications sent by the platform itself.
  actorId?: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  conversationId?: string;
  listingId?: string;
  message?: string;
}

type PreferenceKey = 'likes' | 'comments' | 'follows' | 'messages';

// System notifications (null) are not tied to a user's preferences. A user
// cannot switch off being told their listing was removed.
const TYPE_TO_PREFERENCE_KEY: Record<NotificationType, PreferenceKey | null> = {
  LIKE: 'likes',
  COMMENT: 'comments',
  REPLY: 'comments',
  FOLLOW: 'follows',
  MESSAGE: 'messages',
  VERIFICATION_APPROVED: null,
  VERIFICATION_REJECTED: null,
  LISTING_REMOVED: null,
  CONTENT_REMOVED: null,
};

const ACTOR_INCLUDE = { actor: { select: PUBLIC_USER_SELECT } } satisfies Prisma.NotificationInclude;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  // Called by Likes, Comments, Follows, Messaging and the admin tools, never
  // directly from a controller. It quietly does nothing for self-actions, for
  // types the recipient switched off and for repeats, so callers do not have
  // to check. A notification is a side effect: if it fails, the like or comment
  // that caused it must still succeed, so errors are logged and swallowed.
  async create(input: CreateNotificationInput) {
    try {
      if (input.actorId && input.recipientId === input.actorId) {
        return null;
      }

      if (!(await this.isEnabled(input.recipientId, input.type))) {
        return null;
      }

      if (await this.isRepeat(input)) {
        return null;
      }

      return await this.prisma.notification.create({
        data: input,
        include: ACTOR_INCLUDE,
      });
    } catch (error) {
      this.logger.warn(`Could not create a ${input.type} notification: ${String(error)}`);
      return null;
    }
  }

  async findForUser(userId: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const keyset = keysetWhere<Prisma.NotificationWhereInput>(cursor);
    const where: Prisma.NotificationWhereInput = { recipientId: userId };

    const rows = await this.prisma.notification.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: ACTOR_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (n) => n.createdAt);

    return { notifications: items, nextCursor };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, read: false },
    });

    return { count };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { read: true },
    });

    return { updated: result.count > 0 };
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
    const key = TYPE_TO_PREFERENCE_KEY[type];

    if (!key) {
      return true;
    }

    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    return preference ? preference[key] : true;
  }

  // Liking, unliking and liking again, or following and unfollowing in a loop,
  // used to create a new notification every time. A like or follow is only
  // announced once per day by the same person, and a chat only has one unread
  // "new message" notification per sender.
  private async isRepeat(input: CreateNotificationInput) {
    if (!input.actorId) {
      return false;
    }

    if (input.type === NotificationType.LIKE || input.type === NotificationType.FOLLOW) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: input.recipientId,
          actorId: input.actorId,
          type: input.type,
          postId: input.postId ?? null,
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });

      return !!existing;
    }

    if (input.type === NotificationType.MESSAGE) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: input.recipientId,
          actorId: input.actorId,
          type: NotificationType.MESSAGE,
          conversationId: input.conversationId ?? null,
          read: false,
        },
        select: { id: true },
      });

      return !!existing;
    }

    return false;
  }
}
