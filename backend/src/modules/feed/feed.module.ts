import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [ModerationModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
