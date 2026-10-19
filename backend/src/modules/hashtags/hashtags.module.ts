import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { HashtagsController } from './hashtags.controller';
import { HashtagsService } from './hashtags.service';

@Module({
  imports: [ModerationModule],
  controllers: [HashtagsController],
  providers: [HashtagsService],
})
export class HashtagsModule {}
