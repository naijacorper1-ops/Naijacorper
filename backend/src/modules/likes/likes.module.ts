import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
