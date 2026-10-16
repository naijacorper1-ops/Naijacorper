import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { PostsModule } from '../posts/posts.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [PostsModule, ModerationModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
