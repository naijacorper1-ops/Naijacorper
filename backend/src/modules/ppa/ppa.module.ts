import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { PpaController } from './ppa.controller';
import { PpaService } from './ppa.service';

@Module({
  imports: [ModerationModule],
  controllers: [PpaController],
  providers: [PpaService],
})
export class PpaModule {}
