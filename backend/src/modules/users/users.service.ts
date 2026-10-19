import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { postInclude, presentPost, visibleRepostWhere } from '../posts/post-presenter';
import { UploadsService } from '../uploads/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Everything about yourself. passwordHash is never selected.
const ME_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  verificationStatus: true,
  isVerified: true,
  emailVerified: true,
  bio: true,
  avatarUrl: true,
  nyscStage: true,
  state: true,
  lga: true,
  batch: true,
  stream: true,
  ppa: true,
  interests: true,
  onboardingCompleted: true,
  createdAt: true,
  _count: { select: { followers: true, following: true } },
} satisfies Prisma.UserSelect;

// What other people may see on a profile. LGA, PPA, email and verification
// status are private.
const PROFILE_SELECT = {
  ...PUBLIC_USER_SELECT,
  bio: true,
  batch: true,
  stream: true,
  interests: true,
  createdAt: true,
  _count: { select: { followers: true, following: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    private uploadsService: UploadsService,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateById(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async getMe(userId: string) {
    const [user, postsCount] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: ME_SELECT }),
      this.prisma.post.count({ where: { authorId: userId, groupId: null } }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...rest } = user;

    return {
      ...rest,
      followersCount: _count.followers,
      followingCount: _count.following,
      postsCount,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: { equals: dto.username, mode: 'insensitive' }, NOT: { id: userId } },
        select: { id: true },
      });

      if (taken) {
        throw new ConflictException('That username is already taken');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: dto.username,
        fullName: dto.fullName,
        state: dto.state,
        // An empty bio clears it.
        bio: dto.bio === undefined ? undefined : dto.bio === '' ? null : dto.bio,
      },
    });

    return this.getMe(userId);
  }

  async setAvatar(userId: string, file: Express.Multer.File | undefined) {
    const { url } = await this.uploadsService.uploadAvatar(file);

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });

    // The old picture is no longer used by anything, so it is deleted.
    await this.uploadsService.deleteByUrl(current?.avatarUrl);

    return { avatarUrl: url };
  }

  async removeAvatar(userId: string) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await this.uploadsService.deleteByUrl(current?.avatarUrl);

    return { avatarUrl: null };
  }

  async getPublicProfile(viewerId: string, username: string) {
    const { id } = await this.findVisibleUser(viewerId, username);

    const user = await this.prisma.user.findUnique({ where: { id }, select: PROFILE_SELECT });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [postsCount, following, followsYou, blocked, muted] = await Promise.all([
      this.prisma.post.count({ where: { authorId: user.id, groupId: null } }),
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
        select: { id: true },
      }),
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: user.id, followingId: viewerId } },
        select: { id: true },
      }),
      this.prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: user.id } },
        select: { id: true },
      }),
      this.prisma.mute.findUnique({
        where: { muterId_mutedId: { muterId: viewerId, mutedId: user.id } },
        select: { id: true },
      }),
    ]);

    const { _count, ...rest } = user;

    return {
      ...rest,
      followersCount: _count.followers,
      followingCount: _count.following,
      postsCount,
      isMe: user.id === viewerId,
      isFollowing: !!following,
      followsYou: !!followsYou,
      isBlocked: !!blocked,
      isMuted: !!muted,
    };
  }

  async listPosts(viewerId: string, username: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const user = await this.findVisibleUser(viewerId, username);
    const keyset = keysetWhere<Prisma.PostWhereInput>(cursor);
    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const where: Prisma.PostWhereInput = {
      authorId: user.id,
      groupId: null,
      AND: [visibleRepostWhere(blockedIds)],
    };

    const rows = await this.prisma.post.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: postInclude(viewerId),
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (p) => p.createdAt);

    return { posts: items.map(presentPost), nextCursor };
  }

  async listFollowers(viewerId: string, username: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const user = await this.findVisibleUser(viewerId, username);

    return this.followList(viewerId, cursor, pageSize, { followingId: user.id }, 'follower');
  }

  async listFollowing(viewerId: string, username: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const user = await this.findVisibleUser(viewerId, username);

    return this.followList(viewerId, cursor, pageSize, { followerId: user.id }, 'following');
  }

  // Finds people whose username starts with, or contains, the search text,
  // or whose name contains it. Prefix matches come first. Results are the top
  // 20, so the app should ask people to type more if the person is not there.
  async search(viewerId: string, q: string) {
    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const base: Prisma.UserWhereInput = {
      isActive: true,
      ...(blockedIds.length > 0 && { id: { notIn: blockedIds } }),
    };

    const prefix = await this.prisma.user.findMany({
      where: { ...base, username: { startsWith: q, mode: 'insensitive' } },
      select: PUBLIC_USER_SELECT,
      orderBy: { username: 'asc' },
      take: 20,
    });

    let users = prefix;

    if (prefix.length < 20) {
      const rest = await this.prisma.user.findMany({
        where: {
          ...base,
          id: { notIn: [...blockedIds, ...prefix.map((u) => u.id)] },
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: PUBLIC_USER_SELECT,
        orderBy: { username: 'asc' },
        take: 20 - prefix.length,
      });

      users = [...prefix, ...rest];
    }

    return { users: await this.withFollowFlag(viewerId, users) };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        passwordHash: true,
        avatarUrl: true,
        verificationDocuments: {
          where: { publicId: { not: null } },
          select: { publicId: true, resourceType: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be deleted here');
    }

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);

    if (!valid) {
      throw new BadRequestException('Password is incorrect');
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Likes, comments, votes, reposts and group joins disappear with the
        // account, but the totals stored on other people's posts, polls and
        // groups would keep counting them. Note what is affected first, then
        // recount those rows after the deletion.
        const [liked, commented, reposted, voted, joined] = await Promise.all([
          tx.like.findMany({ where: { userId }, select: { postId: true } }),
          tx.comment.findMany({ where: { authorId: userId }, select: { postId: true } }),
          tx.post.findMany({
            where: { authorId: userId, repostOfId: { not: null } },
            select: { repostOfId: true },
          }),
          tx.pollVote.findMany({ where: { userId }, select: { optionId: true } }),
          tx.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
        ]);

        // A plain repost of this person's post would turn into an empty post
        // once the original is gone, so those go too (quote posts stay).
        await tx.post.deleteMany({ where: { content: null, repostOf: { authorId: userId } } });

        // Posts, comments, likes, listings, messages, follows and sessions all
        // go with the account (the database is set up to cascade).
        await tx.user.delete({ where: { id: userId } });

        const postIds = [
          ...new Set([
            ...liked.map((l) => l.postId),
            ...commented.map((c) => c.postId),
            ...reposted.map((r) => r.repostOfId as string),
          ]),
        ];
        const optionIds = [...new Set(voted.map((v) => v.optionId))];
        const groupIds = [...new Set(joined.map((g) => g.groupId))];

        if (postIds.length > 0) {
          await tx.$executeRaw`
            UPDATE "posts" p SET
              "likeCount" = (SELECT count(*) FROM "likes" l WHERE l."postId" = p."id"),
              "commentCount" = (SELECT count(*) FROM "comments" c WHERE c."postId" = p."id"),
              "repostCount" = (SELECT count(*) FROM "posts" r WHERE r."repostOfId" = p."id")
            WHERE p."id" = ANY(${postIds}::text[])`;
        }

        if (optionIds.length > 0) {
          await tx.$executeRaw`
            UPDATE "poll_options" o SET
              "voteCount" = (SELECT count(*) FROM "poll_votes" v WHERE v."optionId" = o."id")
            WHERE o."id" = ANY(${optionIds}::text[])`;
        }

        if (groupIds.length > 0) {
          await tx.$executeRaw`
            UPDATE "groups" g SET
              "memberCount" = (SELECT count(*) FROM "group_members" m WHERE m."groupId" = g."id")
            WHERE g."id" = ANY(${groupIds}::text[])`;
        }
      },
      { timeout: 30000 },
    );

    // Files are cleaned up afterwards; a failure here does not undo the deletion.
    await this.uploadsService.deleteByUrl(user.avatarUrl);

    for (const doc of user.verificationDocuments) {
      if (doc.publicId) {
        await this.uploadsService.deleteDocument({
          publicId: doc.publicId,
          resourceType: doc.resourceType,
        });
      }
    }

    return { success: true };
  }

  // The user must exist, be active, and must not have blocked the viewer.
  // Someone you blocked is still visible to you, so you can unblock them.
  private async findVisibleUser(viewerId: string, username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, isActive: true },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id !== viewerId) {
      const blockedByThem = await this.prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: viewerId } },
        select: { id: true },
      });

      if (blockedByThem) {
        throw new NotFoundException('User not found');
      }
    }

    return user;
  }

  private async followList(
    viewerId: string,
    cursor: string | undefined,
    pageSize: number,
    edge: { followingId: string } | { followerId: string },
    side: 'follower' | 'following',
  ) {
    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const keyset = keysetWhere<Prisma.FollowWhereInput>(cursor);
    const where: Prisma.FollowWhereInput = {
      ...edge,
      [side]: {
        isActive: true,
        ...(blockedIds.length > 0 && { id: { notIn: blockedIds } }),
      },
    };

    const rows = await this.prisma.follow.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      select: {
        id: true,
        createdAt: true,
        follower: { select: PUBLIC_USER_SELECT },
        following: { select: PUBLIC_USER_SELECT },
      },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (row) => row.createdAt);
    const users = items.map((row) => ({ ...row[side], followedAt: row.createdAt }));

    return { users: await this.withFollowFlag(viewerId, users), nextCursor };
  }

  // Adds "isFollowing" (does the viewer follow this person) to each user.
  private async withFollowFlag<T extends { id: string }>(viewerId: string, users: T[]) {
    if (users.length === 0) {
      return [];
    }

    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    });

    const followed = new Set(follows.map((f) => f.followingId));

    return users.map((user) => ({ ...user, isFollowing: followed.has(user.id) }));
  }
}
