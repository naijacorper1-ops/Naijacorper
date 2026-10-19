import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { postInclude, presentPost, publicPostWhere } from '../posts/post-presenter';
import { FeedQueryDto } from './dto/feed-query.dto';

@Injectable()
export class FeedService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  async getFeed(userId: string, query: FeedQueryDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const excludedAuthorIds = await this.moderationService.getExcludedAuthorIds(userId);
    const scopeWhere = await this.scopeWhere(userId, query);
    const keyset = keysetWhere<Prisma.PostWhereInput>(query.cursor);

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [publicPostWhere(excludedAuthorIds), scopeWhere, ...(keyset ? [keyset] : [])],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: postInclude(userId),
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (post) => post.createdAt);

    return { posts: items.map(presentPost), nextCursor };
  }

  // The most engaged-with posts of the last 3 days. A short list (top 20),
  // not a paged one, because it is ranked by likes and comments, not by time.
  async getTrending(userId: string) {
    const excludedAuthorIds = await this.moderationService.getExcludedAuthorIds(userId);

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          publicPostWhere(excludedAuthorIds),
          { createdAt: { gt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
          { OR: [{ likeCount: { gt: 0 } }, { commentCount: { gt: 0 } }] },
        ],
      },
      orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      include: postInclude(userId),
    });

    return { posts: rows.map(presentPost) };
  }

  private async scopeWhere(userId: string, query: FeedQueryDto): Promise<Prisma.PostWhereInput> {
    if (query.scope === 'STATE') {
      const state = query.state || (await this.getUserState(userId));

      // Older accounts may have a state typed in a different case, so the
      // match ignores case.
      return state ? { author: { state: { equals: state, mode: 'insensitive' } } } : {};
    }

    if (query.scope === 'FOLLOWING') {
      return {
        OR: [{ authorId: userId }, { author: { followers: { some: { followerId: userId } } } }],
      };
    }

    return {};
  }

  private async getUserState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { state: true },
    });

    return user?.state ?? null;
  }
}
