import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommentsModule } from '../comments/comments.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminContentService } from './admin-content.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';
import { AdminVerificationsService } from './admin-verifications.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    AuditModule,
    PostsModule,
    CommentsModule,
    GroupsModule,
    NotificationsModule,
    UploadsModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminStatsService,
    AdminUsersService,
    AdminVerificationsService,
    AdminReportsService,
    AdminContentService,
  ],
})
export class AdminModule {}
