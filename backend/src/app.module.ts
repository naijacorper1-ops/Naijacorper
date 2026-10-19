import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RejectNullBytesMiddleware } from './common/middleware/reject-null-bytes.middleware';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ExploreModule } from './modules/explore/explore.module';
import { FeedModule } from './modules/feed/feed.module';
import { FollowsModule } from './modules/follows/follows.module';
import { GroupsModule } from './modules/groups/groups.module';
import { HashtagsModule } from './modules/hashtags/hashtags.module';
import { LikesModule } from './modules/likes/likes.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PostsModule } from './modules/posts/posts.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    // Limit is per endpoint, per IP. Sensitive auth routes set tighter limits with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OnboardingModule,
    PostsModule,
    LikesModule,
    CommentsModule,
    FollowsModule,
    FeedModule,
    UploadsModule,
    MessagingModule,
    MarketplaceModule,
    NotificationsModule,
    ExploreModule,
    ModerationModule,
    GroupsModule,
    HashtagsModule,
    AuditModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Turns database errors (duplicates, missing rows) into proper 4xx replies.
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RejectNullBytesMiddleware).forRoutes('*');
  }
}
