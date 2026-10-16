import { Injectable, NotFoundException } from '@nestjs/common';
import { Comment, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(authorId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let parentComment: Comment | null = null;

    if (dto.parentId) {
      parentComment = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });

      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException('Parent comment not found on this post');
      }
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { postId, authorId, content: dto.content, parentId: dto.parentId },
        include: { author: { select: { id: true, username: true, fullName: true } } },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    if (parentComment) {
      await this.notificationsService.create({
        recipientId: parentComment.authorId,
        actorId: authorId,
        type: NotificationType.REPLY,
        postId,
        commentId: comment.id,
      });
    } else {
      await this.notificationsService.create({
        recipientId: post.authorId,
        actorId: authorId,
        type: NotificationType.COMMENT,
        postId,
        commentId: comment.id,
      });
    }

    return comment;
  }

  async findForPost(postId: string) {
    return this.prisma.comment.findMany({
      where: { postId, parentId: null },
      include: {
        author: { select: { id: true, username: true, fullName: true } },
        replies: {
          include: { author: { select: { id: true, username: true, fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
