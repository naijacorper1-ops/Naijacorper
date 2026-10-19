import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, UserRole } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const REPLY_PREVIEW = 3;

const COMMENT_INCLUDE = {
  author: { select: PUBLIC_USER_SELECT },
} satisfies Prisma.CommentInclude;

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private moderationService: ModerationService,
  ) {}

  async create(authorId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, author: { select: { isActive: true } } },
    });

    if (!post || !post.author.isActive) {
      throw new NotFoundException('Post not found');
    }

    await this.moderationService.assertNotBlocked(authorId, post.authorId);

    let parentId: string | undefined;
    let parentAuthorId: string | undefined;

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, postId: true, parentId: true, authorId: true },
      });

      if (!parent || parent.postId !== postId) {
        throw new NotFoundException('Parent comment not found on this post');
      }

      await this.moderationService.assertNotBlocked(authorId, parent.authorId);

      // One level of nesting. Replying to a reply attaches to the top-level
      // comment, so every reply is shown under it (before, replies to replies
      // were saved but never displayed anywhere).
      parentId = parent.parentId ?? parent.id;
      parentAuthorId = parent.authorId;
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { postId, authorId, content: dto.content, parentId },
        include: COMMENT_INCLUDE,
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    await this.notificationsService.create({
      recipientId: parentAuthorId ?? post.authorId,
      actorId: authorId,
      type: parentAuthorId ? NotificationType.REPLY : NotificationType.COMMENT,
      postId,
      commentId: comment.id,
    });

    return { ...comment, replyCount: 0, replies: [] };
  }

  // Top-level comments, oldest first, each with its first few replies.
  async findForPost(viewerId: string, postId: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    await this.assertPostVisible(viewerId, postId);

    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const keyset = keysetWhere<Prisma.CommentWhereInput>(cursor, 'createdAt', 'asc');
    const where: Prisma.CommentWhereInput = {
      postId,
      parentId: null,
      author: { isActive: true },
      ...(blockedIds.length > 0 && { authorId: { notIn: blockedIds } }),
    };

    const rows = await this.prisma.comment.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: pageSize + 1,
      include: {
        ...COMMENT_INCLUDE,
        _count: { select: { replies: true } },
        replies: {
          where: {
            author: { isActive: true },
            ...(blockedIds.length > 0 && { authorId: { notIn: blockedIds } }),
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: REPLY_PREVIEW,
          include: COMMENT_INCLUDE,
        },
      },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (c) => c.createdAt);

    return {
      comments: items.map(({ _count, ...comment }) => ({
        ...comment,
        replyCount: _count.replies,
      })),
      nextCursor,
    };
  }

  // The rest of the replies under one comment.
  async findReplies(
    viewerId: string,
    postId: string,
    commentId: string,
    cursor?: string,
    pageSize = DEFAULT_PAGE_SIZE,
  ) {
    await this.assertPostVisible(viewerId, postId);

    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const keyset = keysetWhere<Prisma.CommentWhereInput>(cursor, 'createdAt', 'asc');
    const where: Prisma.CommentWhereInput = {
      postId,
      parentId: commentId,
      author: { isActive: true },
      ...(blockedIds.length > 0 && { authorId: { notIn: blockedIds } }),
    };

    const rows = await this.prisma.comment.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: pageSize + 1,
      include: COMMENT_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (c) => c.createdAt);

    return { comments: items, nextCursor };
  }

  // The comment's author, the post's author and admins may delete a comment.
  async deleteComment(user: AuthUser, postId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, post: { select: { authorId: true } } },
    });

    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('Comment not found');
    }

    const allowed =
      comment.authorId === user.id ||
      comment.post.authorId === user.id ||
      user.role === UserRole.ADMIN;

    if (!allowed) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    await this.removeComment(commentId);
    return { success: true };
  }

  // Deletes a comment (and its replies) and takes them off the post's count.
  // Also used by the admin tools.
  async removeComment(commentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { id: true, postId: true, _count: { select: { replies: true } } },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      await tx.comment.delete({ where: { id: commentId } });

      // Replies are deleted with their parent, so they leave the count too.
      await tx.post.updateMany({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 + comment._count.replies } },
      });

      return { postId: comment.postId, removedCount: 1 + comment._count.replies };
    });
  }

  private async assertPostVisible(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, author: { select: { isActive: true } } },
    });

    if (!post || !post.author.isActive) {
      throw new NotFoundException('Post not found');
    }

    if (await this.moderationService.isBlocked(viewerId, post.authorId)) {
      throw new NotFoundException('Post not found');
    }
  }
}
