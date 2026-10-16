import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ExploreModule } from './modules/explore/explore.module';
import { FeedModule } from './modules/feed/feed.module';
import { FollowsModule } from './modules/follows/follows.module';
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
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
