import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { UploadsModule } from '../uploads/uploads.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [ModerationModule, UploadsModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
