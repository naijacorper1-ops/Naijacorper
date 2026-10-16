import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
