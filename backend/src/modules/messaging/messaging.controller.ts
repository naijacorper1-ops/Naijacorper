import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
  startConversation(@CurrentUser() user: { id: string }, @Param('userId') otherUserId: string) {
    return this.messagingService.getOrCreateConversation(user.id, otherUserId);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: { id: string }) {
    return this.messagingService.listConversations(user.id);
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagingService.getMessages(user.id, conversationId, cursor);
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @CurrentUser() user: { id: string },
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
