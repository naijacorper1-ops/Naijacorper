import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole, Prisma } from '@prisma/client';
import { extractHashtags } from '../../common/utils/extract-hashtags';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreatePostDto } from './dto/create-post.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { postInclude, presentPost, visibleRepostWhere } from './post-presenter';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const content = dto.content;
    const mediaUrls = dto.mediaUrls ?? [];

    if (!content && mediaUrls.length === 0 && !dto.repostOfId) {
      throw new BadRequestException('A post needs text, a photo or video, or a post to repost');
    }

    if (dto.poll && !content) {
      throw new BadRequestException('A poll needs its question in the post content');
    }

    if (dto.poll && dto.repostOfId) {
      throw new BadRequestException('A repost cannot have a poll');
    }

    if (dto.groupId && dto.repostOfId) {
      throw new BadRequestException('Reposts cannot be made inside a group');
    }

    if (dto.groupId) {
      await this.assertGroupMember(authorId, dto.groupId);
    }

    // A repost always points at the original post, even if the post being
    // reposted is itself a plain repost. A quote post (a repost with its own
    // text) is treated as its own post and can be reposted as such.
    let repostOfId: string | undefined;

    if (dto.repostOfId) {
      const target = await this.prisma.post.findUnique({
        where: { id: dto.repostOfId },
        select: {
          id: true,
          content: true,
          repostOfId: true,
          groupId: true,
          authorId: true,
          author: { select: { isActive: true } },
        },
      });

      if (!target || !target.author.isActive) {
        throw new NotFoundException('Post to repost not found');
      }

      if (target.groupId) {
        throw new BadRequestException('Posts inside a group cannot be reposted');
      }

      await this.moderationService.assertNotBlocked(authorId, target.authorId);

      repostOfId = target.content == null && target.repostOfId ? target.repostOfId : target.id;

      // A plain repost points at the original post, so the original's author
      // must be active and not blocked either way, just like the target's.
      if (repostOfId !== target.id) {
        const original = await this.prisma.post.findUnique({
          where: { id: repostOfId },
          select: { authorId: true, author: { select: { isActive: true } } },
        });

        if (!original || !original.author.isActive) {
          throw new NotFoundException('Post to repost not found');
        }

        await this.moderationService.assertNotBlocked(authorId, original.authorId);
      }

      if (!content && mediaUrls.length === 0) {
        const already = await this.prisma.post.findFirst({
          where: { authorId, repostOfId, content: null },
          select: { id: true },
        });

        if (already) {
          throw new ConflictException('You have already reposted this');
        }
      }
    }

    const hashtagIds = await this.resolveHashtagIds(content);

    const [post] = await this.prisma.$transaction([
      this.prisma.post.create({
        data: {
          authorId,
          content: content ?? null,
          mediaUrls,
          repostOfId,
          groupId: dto.groupId,
          hashtags: { create: hashtagIds.map((hashtagId) => ({ hashtagId })) },
          ...(dto.poll && {
            poll: {
              create: {
                expiresAt: new Date(Date.now() + (dto.poll.durationHours ?? 24) * 60 * 60 * 1000),
                options: {
                  create: dto.poll.options.map((text, position) => ({ text, position })),
                },
              },
            },
          }),
        },
        select: { id: true },
      }),
      ...(repostOfId
        ? [
            this.prisma.post.update({
              where: { id: repostOfId },
              data: { repostCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    return this.findById(authorId, post.id);
  }

  async findById(viewerId: string, id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, author: { isActive: true }, AND: [visibleRepostWhere([])] },
      include: postInclude(viewerId),
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Someone who blocked you, or whom you blocked, is invisible to you,
    // and so is a repost of their post.
    if (
      (await this.moderationService.isBlocked(viewerId, post.authorId)) ||
      (post.repostOf && (await this.moderationService.isBlocked(viewerId, post.repostOf.author.id)))
    ) {
      throw new NotFoundException('Post not found');
    }

    return presentPost(post);
  }

  async deleteOwn(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, groupId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      // The owner of a group may remove other people's posts in that group.
      const isGroupOwner =
        !!post.groupId &&
        !!(await this.prisma.groupMember.findFirst({
          where: { groupId: post.groupId, userId, role: GroupMemberRole.OWNER },
          select: { id: true },
        }));

      if (!isGroupOwner) {
        throw new ForbiddenException('You can only delete your own posts');
      }
    }

    await this.removePost(postId);
    return { success: true };
  }

  // Deletes a post and keeps the numbers around it correct. Also used by the
  // admin tools, which skip the ownership check above.
  async removePost(postId: string) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { id: true, repostOfId: true },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // A plain repost has no text of its own. Once the original is gone it
      // would show up empty, so those reposts go with it. Quote posts keep
      // their own text and stay.
      await tx.post.deleteMany({ where: { repostOfId: postId, content: null } });
      await tx.post.delete({ where: { id: postId } });

      // The original loses one repost (this was a repost or a quote).
      if (post.repostOfId) {
        await tx.post.updateMany({
          where: { id: post.repostOfId, repostCount: { gt: 0 } },
          data: { repostCount: { decrement: 1 } },
        });
      }

      return { success: true };
    });
  }

  async vote(userId: string, postId: string, dto: VotePollDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorId: true,
        author: { select: { isActive: true } },
        poll: { select: { id: true, expiresAt: true, options: { select: { id: true } } } },
      },
    });

    if (!post || !post.poll || !post.author.isActive) {
      throw new NotFoundException('Poll not found');
    }

    await this.moderationService.assertNotBlocked(userId, post.authorId);

    if (post.poll.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This poll has ended');
    }

    if (!post.poll.options.some((option) => option.id === dto.optionId)) {
      throw new BadRequestException('That option does not belong to this poll');
    }

    try {
      // Both steps succeed together or neither does. The database allows one
      // vote per user per poll, so a double tap cannot count twice.
      await this.prisma.$transaction([
        this.prisma.pollVote.create({
          data: { pollId: post.poll.id, userId, optionId: dto.optionId },
        }),
        this.prisma.pollOption.update({
          where: { id: dto.optionId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already voted in this poll');
      }
      throw error;
    }

    return this.findById(userId, postId);
  }

  private async assertGroupMember(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });

    if (!member) {
      throw new ForbiddenException('Join the group before posting in it');
    }
  }

  // Creates any new hashtags (safe if two posts create the same one at the
  // same moment) and returns the ids of all the post's hashtags.
  private async resolveHashtagIds(content: string | undefined): Promise<string[]> {
    const tags = content ? extractHashtags(content) : [];

    if (tags.length === 0) {
      return [];
    }

    await this.prisma.hashtag.createMany({
      data: tags.map((tag) => ({ tag })),
      skipDuplicates: true,
    });

    const rows = await this.prisma.hashtag.findMany({
      where: { tag: { in: tags } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }
}
