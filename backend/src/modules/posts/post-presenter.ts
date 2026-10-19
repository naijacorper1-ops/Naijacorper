import { Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';

// What a post looks like everywhere it appears: feed, profile, hashtag page,
// group page, single post. The viewer's own like and poll vote are included
// so the frontend can show "liked" and "you voted" without extra requests.
export function postInclude(viewerId: string) {
  return {
    author: { select: PUBLIC_USER_SELECT },
    repostOf: {
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        createdAt: true,
        author: { select: PUBLIC_USER_SELECT },
      },
    },
    group: { select: { id: true, name: true, slug: true } },
    poll: {
      select: {
        id: true,
        expiresAt: true,
        options: {
          orderBy: { position: 'asc' as const },
          select: { id: true, text: true, voteCount: true },
        },
        votes: { where: { userId: viewerId }, select: { optionId: true }, take: 1 },
      },
    },
    likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
  } satisfies Prisma.PostInclude;
}

export type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

export function presentPost(post: PostRow) {
  const { likes, poll, ...rest } = post;

  return {
    ...rest,
    likedByMe: likes.length > 0,
    poll: poll
      ? {
          id: poll.id,
          expiresAt: poll.expiresAt,
          isClosed: poll.expiresAt.getTime() <= Date.now(),
          totalVotes: poll.options.reduce((sum, option) => sum + option.voteCount, 0),
          myOptionId: poll.votes[0]?.optionId ?? null,
          options: poll.options,
        }
      : null,
  };
}

// Posts shown in public lists. Group posts stay inside their group, and
// posts from deactivated accounts are hidden.
export function publicPostWhere(excludedAuthorIds: string[]): Prisma.PostWhereInput {
  return {
    groupId: null,
    author: { isActive: true },
    ...(excludedAuthorIds.length > 0 && { authorId: { notIn: excludedAuthorIds } }),
    AND: [visibleRepostWhere(excludedAuthorIds)],
  };
}

// A repost shows the original post inside it. If the original's author is
// deactivated, or blocked either way, the repost is hidden too, so their
// words cannot come back through someone else's post.
export function visibleRepostWhere(excludedAuthorIds: string[]): Prisma.PostWhereInput {
  return {
    OR: [
      { repostOfId: null },
      {
        repostOf: {
          is: {
            author: {
              isActive: true,
              ...(excludedAuthorIds.length > 0 && { id: { notIn: excludedAuthorIds } }),
            },
          },
        },
      },
    ],
  };
}
