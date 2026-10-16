import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { extractHashtags } from '../../common/utils/extract-hashtags';
import { PrismaService } from '../../database/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto) {
    if (!dto.content && !dto.repostOfId) {
      throw new BadRequestException('A post needs content, a repost target, or both');
    }

    if (dto.repostOfId) {
      const target = await this.prisma.post.findUnique({ where: { id: dto.repostOfId } });

      if (!target) {
        throw new NotFoundException('Post to repost not found');
      }
    }

    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: dto.content,
        mediaUrls: dto.mediaUrls || [],
        repostOfId: dto.repostOfId,
      },
    });

    if (dto.content) {
      await this.attachHashtags(post.id, dto.content);
    }

    if (dto.repostOfId) {
      await this.prisma.post.update({
        where: { id: dto.repostOfId },
        data: { repostCount: { increment: 1 } },
      });
    }

    return this.findById(post.id);
  }

  async findById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: this.include(),
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async deleteOwn(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new BadRequestException('You can only delete your own posts');
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  // For AdminController — skips the ownership check deleteOwn enforces.
  async adminDelete(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  // Shared with FeedService so a post looks the same everywhere it appears.
  include() {
    return {
      author: {
        select: { id: true, username: true, fullName: true, state: true, role: true },
      },
      repostOf: {
        include: {
          author: {
            select: { id: true, username: true, fullName: true },
          },
        },
      },
    };
  }

  private async attachHashtags(postId: string, content: string) {
    const tags = extractHashtags(content);

    for (const tag of tags) {
      const hashtag = await this.prisma.hashtag.upsert({
        where: { tag },
        update: {},
        create: { tag },
      });

      await this.prisma.postHashtag.create({
        data: { postId, hashtagId: hashtag.id },
      });
    }
  }
}
