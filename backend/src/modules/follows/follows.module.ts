import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [NotificationsModule, ModerationModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
