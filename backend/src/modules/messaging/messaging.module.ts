import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, ModerationModule],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
