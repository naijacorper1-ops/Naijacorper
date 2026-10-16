import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { PostsService } from '../posts/posts.service';
import { FeedQueryDto } from './dto/feed-query.dto';

const PAGE_SIZE = 20;

@Injectable()
export class FeedService {
  constructor(
    private prisma: PrismaService,
    private postsService: PostsService,
    private moderationService: ModerationService,
  ) {}

  async getFeed(userId: string, query: FeedQueryDto) {
    const excludedAuthorIds = await this.moderationService.getExcludedAuthorIds(userId);
    const where = await this.buildWhere(userId, query, excludedAuthorIds);

    const posts = await this.prisma.post.findMany({
      where,
      take: PAGE_SIZE,
      ...(query.cursor && { skip: 1, cursor: { id: query.cursor } }),
      orderBy: { createdAt: 'desc' },
      include: this.postsService.include(),
    });

    const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1].id : null;

    return { posts, nextCursor };
  }

  private async buildWhere(
    userId: string,
    query: FeedQueryDto,
    excludedAuthorIds: string[],
  ): Promise<Prisma.PostWhereInput> {
    if (query.scope === 'STATE') {
      const state = query.state || (await this.getUserState(userId));

      return {
        ...(state && { author: { state } }),
        ...(excludedAuthorIds.length > 0 && { authorId: { notIn: excludedAuthorIds } }),
      };
    }

    if (query.scope === 'FOLLOWING') {
      const followingIds = await this.getFollowingIds(userId);
      const allowedIds = [...followingIds, userId].filter((id) => !excludedAuthorIds.includes(id));

      return { authorId: { in: allowedIds } };
    }

    return excludedAuthorIds.length > 0 ? { authorId: { notIn: excludedAuthorIds } } : {};
  }

  private async getUserState(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.state ?? null;
  }

  private async getFollowingIds(userId: string) {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    return follows.map((f) => f.followingId);
  }
}
