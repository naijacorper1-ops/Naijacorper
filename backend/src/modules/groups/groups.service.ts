import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole, Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { postInclude, presentPost } from '../posts/post-presenter';
import { UploadsService } from '../uploads/uploads.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { QueryGroupsDto } from './dto/query-groups.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

const MAX_GROUPS_CREATED_PER_USER = 10;

function groupInclude(viewerId: string) {
  return {
    createdBy: { select: PUBLIC_USER_SELECT },
    members: { where: { userId: viewerId }, select: { role: true }, take: 1 },
  } satisfies Prisma.GroupInclude;
}

type GroupRow = Prisma.GroupGetPayload<{ include: ReturnType<typeof groupInclude> }>;

// "Lagos Corpers 2026!" becomes "lagos-corpers-2026".
function slugify(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    private uploadsService: UploadsService,
  ) {}

  async create(userId: string, dto: CreateGroupDto) {
    const slug = slugify(dto.name);

    if (slug.length < 3) {
      throw new BadRequestException('The group name must contain at least 3 letters or numbers');
    }

    // A name that turns into an id-looking slug could be confused with a
    // real group id when someone opens a group by id or slug.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug)) {
      throw new BadRequestException('Please choose a different group name');
    }

    const created = await this.prisma.group.count({ where: { createdById: userId } });

    if (created >= MAX_GROUPS_CREATED_PER_USER) {
      throw new BadRequestException(`You can create at most ${MAX_GROUPS_CREATED_PER_USER} groups`);
    }

    const taken = await this.prisma.group.findUnique({ where: { slug }, select: { id: true } });

    if (taken) {
      throw new ConflictException('A group with a similar name already exists');
    }

    // The creator becomes the owner and the first member in the same step.
    // If two people pick the same name at the same moment, the database's
    // unique rule on the slug rejects the second one (the global filter
    // answers 409).
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        state: dto.state,
        createdById: userId,
        members: { create: { userId, role: GroupMemberRole.OWNER } },
      },
      include: groupInclude(userId),
    });

    return this.present(group);
  }

  async findAll(viewerId: string, query: QueryGroupsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.GroupWhereInput>(query.cursor);
    const where: Prisma.GroupWhereInput = {
      createdBy: { isActive: true },
      ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
    };

    const rows = await this.prisma.group.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: groupInclude(viewerId),
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (g) => g.createdAt);

    return { groups: items.map((g) => this.present(g)), nextCursor };
  }

  async findMine(viewerId: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const keyset = keysetWhere<Prisma.GroupMemberWhereInput>(cursor, 'joinedAt');
    const where: Prisma.GroupMemberWhereInput = {
      userId: viewerId,
      group: { createdBy: { isActive: true } },
    };

    const rows = await this.prisma.groupMember.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: { group: { include: groupInclude(viewerId) } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (m) => m.joinedAt);

    return { groups: items.map((m) => this.present(m.group)), nextCursor };
  }

  async findOne(viewerId: string, idOrSlug: string) {
    const found = await this.resolve(idOrSlug);

    const group = await this.prisma.group.findUnique({
      where: { id: found.id },
      include: groupInclude(viewerId),
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.present(group);
  }

  async join(userId: string, idOrSlug: string) {
    const group = await this.resolve(idOrSlug);

    try {
      await this.prisma.$transaction([
        this.prisma.groupMember.create({ data: { groupId: group.id, userId } }),
        this.prisma.group.update({
          where: { id: group.id },
          data: { memberCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You are already a member of this group');
      }
      throw error;
    }

    return { joined: true };
  }

  async leave(userId: string, idOrSlug: string) {
    const group = await this.resolve(idOrSlug);

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
      select: { role: true },
    });

    if (member?.role === GroupMemberRole.OWNER) {
      throw new BadRequestException('The owner cannot leave the group. Delete the group instead.');
    }

    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.groupMember.deleteMany({ where: { groupId: group.id, userId } });

      if (removed.count > 0) {
        await tx.group.updateMany({
          where: { id: group.id, memberCount: { gt: 0 } },
          data: { memberCount: { decrement: 1 } },
        });
      }
    });

    return { joined: false };
  }

  async listMembers(viewerId: string, idOrSlug: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const group = await this.resolve(idOrSlug);
    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const keyset = keysetWhere<Prisma.GroupMemberWhereInput>(cursor, 'joinedAt');
    const where: Prisma.GroupMemberWhereInput = {
      groupId: group.id,
      user: {
        isActive: true,
        ...(blockedIds.length > 0 && { id: { notIn: blockedIds } }),
      },
    };

    const rows = await this.prisma.groupMember.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      select: { id: true, role: true, joinedAt: true, user: { select: PUBLIC_USER_SELECT } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (m) => m.joinedAt);

    return {
      members: items.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })),
      nextCursor,
    };
  }

  async listPosts(viewerId: string, idOrSlug: string, cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
    const group = await this.resolve(idOrSlug);
    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const keyset = keysetWhere<Prisma.PostWhereInput>(cursor);
    const where: Prisma.PostWhereInput = {
      groupId: group.id,
      author: { isActive: true },
      ...(blockedIds.length > 0 && { authorId: { notIn: blockedIds } }),
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

  async update(userId: string, idOrSlug: string, dto: UpdateGroupDto) {
    const group = await this.assertOwner(userId, idOrSlug);

    await this.prisma.group.update({
      where: { id: group.id },
      data: {
        state: dto.state,
        description: dto.description === undefined ? undefined : dto.description || null,
      },
    });

    return this.findOne(userId, group.id);
  }

  async setAvatar(userId: string, idOrSlug: string, file: Express.Multer.File | undefined) {
    const group = await this.assertOwner(userId, idOrSlug);
    const { url } = await this.uploadsService.uploadGroupAvatar(file);

    await this.prisma.group.update({ where: { id: group.id }, data: { avatarUrl: url } });
    await this.uploadsService.deleteByUrl(group.avatarUrl);

    return { avatarUrl: url };
  }

  async deleteOwn(userId: string, idOrSlug: string) {
    const group = await this.assertOwner(userId, idOrSlug);

    await this.removeGroup(group.id);
    return { success: true };
  }

  // Deletes the group with its members and posts. Also used by the admin tools.
  async removeGroup(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, avatarUrl: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.prisma.group.delete({ where: { id: groupId } });
    await this.uploadsService.deleteByUrl(group.avatarUrl);

    return { success: true };
  }

  // An id is tried first, then the slug. A group whose name looks like another
  // group's id could otherwise make the two ambiguous. Groups whose creator
  // has been deactivated are treated as gone, like in the group list.
  private async resolve(idOrSlug: string) {
    const select = { id: true, avatarUrl: true };
    const alive = { createdBy: { isActive: true } };

    const group =
      (await this.prisma.group.findFirst({ where: { id: idOrSlug, ...alive }, select })) ??
      (await this.prisma.group.findFirst({
        where: { slug: idOrSlug.toLowerCase(), ...alive },
        select,
      }));

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  private async assertOwner(userId: string, idOrSlug: string) {
    const group = await this.resolve(idOrSlug);

    const owner = await this.prisma.groupMember.findFirst({
      where: { groupId: group.id, userId, role: GroupMemberRole.OWNER },
      select: { id: true },
    });

    if (!owner) {
      throw new ForbiddenException('Only the owner of the group can do this');
    }

    return group;
  }

  private present(group: GroupRow) {
    const { members, ...rest } = group;

    return {
      ...rest,
      isMember: members.length > 0,
      myRole: members[0]?.role ?? null,
    };
  }
}
