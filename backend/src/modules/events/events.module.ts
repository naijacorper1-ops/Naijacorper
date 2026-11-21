import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [ModerationModule, NotificationsModule, UploadsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
