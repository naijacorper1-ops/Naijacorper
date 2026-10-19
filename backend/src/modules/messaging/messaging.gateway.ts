import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service';
import { SocketSendMessageDto } from './dto/socket-send-message.dto';
import { MessagingService } from './messaging.service';

// At most this many messages per connection in any 10 seconds.
const MAX_MESSAGES_PER_WINDOW = 20;
const WINDOW_MS = 10 * 1000;

// Allowed websites are set once for the whole app in main.ts (CorsIoAdapter),
// using the same FRONTEND_URL list as the REST API.
@WebSocketGateway({ namespace: '/messaging' })
export class MessagingGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  // Send times per user (not per connection), so opening many sockets does
  // not multiply the allowance.
  private recentSends = new Map<string, number[]>();

  constructor(
    private messagingService: MessagingService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  // Client connects with { auth: { token: '<access token>' } }, the same
  // access token used for REST calls, no separate socket auth.
  // This runs before the connection is accepted, so a client can never
  // send a message in the short gap before it is known who they are.
  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        const token = this.extractToken(client);

        const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
          secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        });

        // A valid token is not enough: the account must still exist and be active.
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, isActive: true },
        });

        if (!user || !user.isActive) {
          throw new Error('Inactive user');
        }

        client.data.userId = user.id;
        await client.join(this.userRoom(user.id));
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      throw new WsException('Not authenticated');
    }

    this.assertNotFlooding(userId);

    const dto = plainToInstance(SocketSendMessageDto, body);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    if (errors.length > 0) {
      throw new WsException('conversationId and content (1 to 2000 characters) are required');
    }

    try {
      const { message, recipientId } = await this.messagingService.sendMessage(
        userId,
        dto.conversationId,
        { content: dto.content },
      );

      this.notifyNewMessage(recipientId, message);
      return message;
    } catch (error) {
      // Turn REST-style errors (blocked, not a participant...) into a socket error.
      if (error instanceof HttpException) {
        throw new WsException(error.message);
      }
      throw error;
    }
  }

  // Called from MessagingController too, so a message sent over REST
  // still reaches the recipient live if they're connected.
  notifyNewMessage(recipientId: string, message: unknown) {
    this.server.to(this.userRoom(recipientId)).emit('newMessage', message);
  }

  private assertNotFlooding(userId: string) {
    const now = Date.now();

    // Keeps the map from growing forever with users who stopped chatting.
    if (this.recentSends.size > 10000) {
      for (const [id, times] of this.recentSends) {
        if (times.every((t) => now - t >= WINDOW_MS)) {
          this.recentSends.delete(id);
        }
      }
    }

    const recent = (this.recentSends.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);

    if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
      this.recentSends.set(userId, recent);
      throw new WsException('You are sending messages too fast');
    }

    recent.push(now);
    this.recentSends.set(userId, recent);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token || typeof token !== 'string') {
      throw new Error('No token provided');
    }

    return token.replace('Bearer ', '');
  }
}
