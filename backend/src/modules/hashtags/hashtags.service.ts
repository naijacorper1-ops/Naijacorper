import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { postInclude, presentPost, publicPostWhere } from '../posts/post-presenter';

// "#NYSC2026" and "nysc2026" are the same tag.
function normalizeTag(value: string) {
  const tag = value.replace(/^#/, '').toLowerCase();
  return /^[a-z0-9_]{1,50}$/.test(tag) ? tag : null;
}

@Injectable()
export class HashtagsService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  // The ten most used hashtags in the last 7 days (public posts only).
  async trending() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const groups = await this.prisma.postHashtag.groupBy({
      by: ['hashtagId'],
      where: { post: { createdAt: { gt: since }, groupId: null, author: { isActive: true } } },
      _count: { postId: true },
      orderBy: { _count: { postId: 'desc' } },
      take: 10,
    });

    if (groups.length === 0) {
      return { hashtags: [] };
    }

    const tags = await this.prisma.hashtag.findMany({
      where: { id: { in: groups.map((g) => g.hashtagId) } },
      select: { id: true, tag: true },
    });
    const tagById = new Map(tags.map((t) => [t.id, t.tag]));

    return {
      hashtags: groups
        .filter((g) => tagById.has(g.hashtagId))
        .map((g) => ({ tag: tagById.get(g.hashtagId) as string, postCount: g._count.postId })),
    };
  }

  // Suggestions while typing: hashtags that start with the text.
  async search(q: string) {
    const tag = normalizeTag(q);

    if (!tag) {
      return { hashtags: [] };
    }

    const rows = await this.prisma.hashtag.findMany({
      where: { tag: { startsWith: tag } },
      select: { tag: true },
      orderBy: { tag: 'asc' },
      take: 10,
    });

    return { hashtags: rows };
  }

  async postsFor(viewerId: string, rawTag: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const tag = normalizeTag(rawTag);

    if (!tag) {
      return { tag: rawTag, posts: [], nextCursor: null };
    }

    const excludedAuthorIds = await this.moderationService.getExcludedAuthorIds(viewerId);
    const keyset = keysetWhere<Prisma.PostWhereInput>(cursor);

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          publicPostWhere(excludedAuthorIds),
          { hashtags: { some: { hashtag: { tag } } } },
          ...(keyset ? [keyset] : []),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: postInclude(viewerId),
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (p) => p.createdAt);

    return { tag, posts: items.map(presentPost), nextCursor };
  }
}
