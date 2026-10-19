import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(
    private messagingService: MessagingService,
    private messagingGateway: MessagingGateway,
  ) {}

  @Post('conversations/:userId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  startConversation(@CurrentUser() user: AuthUser, @Param('userId') otherUserId: string) {
    return this.messagingService.getOrCreateConversation(user.id, otherUserId);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.messagingService.listConversations(user.id, query.cursor, query.pageSize);
  }

  // Total unread messages, for the badge on the inbox icon.
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.messagingService.unreadTotal(user.id);
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.messagingService.getMessages(user.id, conversationId, query.cursor, query.pageSize);
  }

  @Patch('conversations/:conversationId/read')
  markRead(@CurrentUser() user: AuthUser, @Param('conversationId') conversationId: string) {
    return this.messagingService.markRead(user.id, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const { message, recipientId } = await this.messagingService.sendMessage(
      user.id,
      conversationId,
      dto,
    );

    this.messagingGateway.notifyNewMessage(recipientId, message);
    return message;
  }
}
