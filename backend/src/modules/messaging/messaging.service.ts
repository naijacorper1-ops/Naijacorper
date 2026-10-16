import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

const PAGE_SIZE = 30;

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

    const otherUser = await this.prisma.user.findUnique({ where: { id: otherUserId } });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    if (await this.moderationService.isBlocked(userId, otherUserId)) {
      throw new ForbiddenException('Cannot start a conversation with this user');
    }

    const [participantOneId, participantTwoId] = this.orderedPair(userId, otherUserId);

    const existing = await this.prisma.conversation.findUnique({
      where: { participantOneId_participantTwoId: { participantOneId, participantTwoId } },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: { participantOneId, participantTwoId },
    });
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ participantOneId: userId }, { participantTwoId: userId }] },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participantOne: { select: { id: true, username: true, fullName: true } },
        participantTwo: { select: { id: true, username: true, fullName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      otherParticipant:
        conversation.participantOneId === userId
          ? conversation.participantTwo
          : conversation.participantOne,
      lastMessage: conversation.messages[0] || null,
      lastMessageAt: conversation.lastMessageAt,
    }));
  }

  async getMessages(userId: string, conversationId: string, cursor?: string) {
    await this.assertParticipant(userId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      take: PAGE_SIZE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, username: true, fullName: true } } },
    });

    const nextCursor = messages.length === PAGE_SIZE ? messages[messages.length - 1].id : null;

    return { messages, nextCursor };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.assertParticipant(userId, conversationId);

    const recipientId =
      conversation.participantOneId === userId
        ? conversation.participantTwoId
        : conversation.participantOneId;

    if (await this.moderationService.isBlocked(userId, recipientId)) {
      throw new ForbiddenException('Cannot message this user');
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, content: dto.content },
        include: { sender: { select: { id: true, username: true, fullName: true } } },
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

  // Same trick as Follow's compound key — sort the pair so (A,B) and
  // (B,A) always resolve to the same conversation row.
  private orderedPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }
}
