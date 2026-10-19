import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, NotificationType, Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

const MESSAGE_SENDER_INCLUDE = {
  sender: { select: PUBLIC_USER_SELECT },
} satisfies Prisma.MessageInclude;

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private moderationService: ModerationService,
  ) {}

  async getOrCreateConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot message yourself');
    }

    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, isActive: true },
    });

    if (!otherUser || !otherUser.isActive) {
      throw new NotFoundException('User not found');
    }

    if (await this.moderationService.isBlocked(userId, otherUserId)) {
      throw new ForbiddenException('Cannot start a conversation with this user');
    }

    const [participantOneId, participantTwoId] = this.orderedPair(userId, otherUserId);
    const key = { participantOneId_participantTwoId: { participantOneId, participantTwoId } };

    const existing = await this.prisma.conversation.findUnique({ where: key });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.conversation.create({
        data: { participantOneId, participantTwoId },
      });
    } catch (error) {
      // Both people opened the chat at the same moment and the other request
      // won. Return the conversation it created.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.conversation.findUniqueOrThrow({ where: key });
      }
      throw error;
    }
  }

  async listConversations(userId: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const keyset = keysetWhere<Prisma.ConversationWhereInput>(cursor, 'lastMessageAt');
    const where: Prisma.ConversationWhereInput = {
      OR: [{ participantOneId: userId }, { participantTwoId: userId }],
    };

    const rows = await this.prisma.conversation.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: {
        participantOne: { select: PUBLIC_USER_SELECT },
        participantTwo: { select: PUBLIC_USER_SELECT },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (c) => c.lastMessageAt);

    // How many messages from the other person have not been read yet.
    const unread = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: items.map((c) => c.id) },
        senderId: { not: userId },
        readAt: null,
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(unread.map((u) => [u.conversationId, u._count._all]));

    return {
      conversations: items.map((conversation) => ({
        id: conversation.id,
        otherParticipant:
          conversation.participantOneId === userId
            ? conversation.participantTwo
            : conversation.participantOne,
        lastMessage: conversation.messages[0] || null,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: unreadByConversation.get(conversation.id) ?? 0,
      })),
      nextCursor,
    };
  }

  async unreadTotal(userId: string) {
    const count = await this.prisma.message.count({
      where: {
        senderId: { not: userId },
        readAt: null,
        conversation: { OR: [{ participantOneId: userId }, { participantTwoId: userId }] },
      },
    });

    return { count };
  }

  async getMessages(userId: string, conversationId: string, cursor?: string, pageSize = 30) {
    await this.assertParticipant(userId, conversationId);

    const keyset = keysetWhere<Prisma.MessageWhereInput>(cursor);
    const where: Prisma.MessageWhereInput = { conversationId };

    const rows = await this.prisma.message.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: MESSAGE_SENDER_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (m) => m.createdAt);

    return { messages: items, nextCursor };
  }

  // Marks everything the other person sent in this conversation as read.
  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);

    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    // The "new message" notification for this chat is no longer news.
    await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        type: NotificationType.MESSAGE,
        conversationId,
        read: false,
      },
      data: { read: true },
    });

    return { updated: result.count };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.assertParticipant(userId, conversationId);

    const recipientId =
      conversation.participantOneId === userId
        ? conversation.participantTwoId
        : conversation.participantOneId;

    // The socket connection can outlive a deactivation, so this is checked
    // here as well as when the connection is opened.
    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } }),
      this.prisma.user.findUnique({ where: { id: recipientId }, select: { isActive: true } }),
    ]);

    if (!sender?.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    if (!recipient?.isActive) {
      throw new ForbiddenException('Cannot message this user');
    }

    if (await this.moderationService.isBlocked(userId, recipientId)) {
      throw new ForbiddenException('Cannot message this user');
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, content: dto.content },
        include: MESSAGE_SENDER_INCLUDE,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    await this.notificationsService.create({
      recipientId,
      actorId: userId,
      type: NotificationType.MESSAGE,
      conversationId,
    });

    return { message, recipientId };
  }

  private async assertParticipant(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participantOneId !== userId && conversation.participantTwoId !== userId) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    return conversation;
  }

  // Sort the pair so (A,B) and (B,A) always resolve to the same conversation row.
  private orderedPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }
}
