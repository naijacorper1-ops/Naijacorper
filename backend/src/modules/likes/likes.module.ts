import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  imports: [NotificationsModule, ModerationModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
