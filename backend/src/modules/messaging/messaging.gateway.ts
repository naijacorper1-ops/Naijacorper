import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';

@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private messagingService: MessagingService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Client connects with { auth: { token: '<access token>' } } — the
  // same access token used for REST calls, no separate socket auth.
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      client.data.userId = payload.sub;
      await client.join(this.userRoom(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; content: string },
  ) {
    const userId = client.data.userId as string;

    const { message, recipientId } = await this.messagingService.sendMessage(
      userId,
      body.conversationId,
      { content: body.content },
    );

    this.notifyNewMessage(recipientId, message);
    return message;
  }

  // Called from MessagingController too, so a message sent over REST
  // still reaches the recipient live if they're connected.
  notifyNewMessage(recipientId: string, message: unknown) {
    this.server.to(this.userRoom(recipientId)).emit('newMessage', message);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      throw new Error('No token provided');
    }

    return token.replace('Bearer ', '');
  }
}
