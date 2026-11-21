import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpportunityStatus, Prisma, UserRole } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { decideOpportunityPublishing, deniedBody, loadPublisher } from '../../common/utils/publishing';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import {
  QueryMyOpportunitiesDto,
  QueryOpportunitiesDto,
  UpdateOpportunityStatusDto,
} from './dto/query-opportunities.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { parseDeadline } from './opportunity-dates';

// Nobody can queue up an unlimited number of submissions for the admins.
const MAX_PENDING_PER_USER = 10;
const MAX_LIVE_PER_USER = 50;

const INCLUDE = {
  postedBy: { select: PUBLIC_USER_SELECT },
} satisfies Prisma.OpportunityInclude;

type OpportunityRow = Prisma.OpportunityGetPayload<{ include: typeof INCLUDE }>;

// Fields that can be cleared by sending null.
const CLEARABLE = [
  'state',
  'city',
  'employmentType',
  'compensationMin',
  'compensationMax',
  'compensationNote',
  'duration',
  'applyUrl',
  'applyEmail',
] as const;

const REQUIRED = ['type', 'title', 'organization', 'description', 'mode', 'country'] as const;

@Injectable()
export class OpportunitiesService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  async create(user: AuthUser, dto: CreateOpportunityDto) {
    const publisher = await loadPublisher(this.prisma, user.id);

    if (!publisher) {
      throw new NotFoundException('User not found');
    }

    const decision = decideOpportunityPublishing(publisher);

    if (!decision.allowed) {
      throw new ForbiddenException(deniedBody(decision));
    }

    this.assertCompensation(dto.compensationMin, dto.compensationMax);

    const deadline = dto.deadline ? parseDeadline(dto.deadline) : undefined;

    if (deadline && deadline.getTime() <= Date.now()) {
      throw new BadRequestException('The deadline must be in the future');
    }

    // Admins are not limited. Everyone else cannot flood the review queue.
    if (user.role !== UserRole.ADMIN) {
      await this.assertUnderLimits(user.id, decision.mode === 'SUBMIT');
    }

    const created = await this.prisma.opportunity.create({
      data: {
        postedById: user.id,
        type: dto.type,
        title: dto.title,
        organization: dto.organization,
        description: dto.description,
        mode: dto.mode,
        state: dto.state,
        city: dto.city,
        country: dto.country,
        employmentType: dto.employmentType,
        compensationMin: dto.compensationMin,
        compensationMax: dto.compensationMax,
        compensationNote: dto.compensationNote,
        duration: dto.duration,
        deadline,
        applyUrl: dto.applyUrl,
        applyEmail: dto.applyEmail,
        status: decision.mode === 'PUBLISH' ? OpportunityStatus.OPEN : OpportunityStatus.PENDING,
      },
      include: INCLUDE,
    });

    return this.present(created, user);
  }

  // The public list: open opportunities from active posters, minus posters the
  // viewer has blocked (or who blocked the viewer), minus ones whose deadline
  // has passed. Newest first.
  async findAll(viewer: AuthUser, query: QueryOpportunitiesDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const blockedIds = await this.moderationService.getBlockedIds(viewer.id);
    const keyset = keysetWhere<Prisma.OpportunityWhereInput>(query.cursor);

    const and: Prisma.OpportunityWhereInput[] = [
      {
        status: OpportunityStatus.OPEN,
        postedBy: { isActive: true },
        ...(blockedIds.length > 0 && { postedById: { notIn: blockedIds } }),
        ...(query.type && { type: query.type }),
        ...(query.mode && { mode: query.mode }),
        ...(query.employmentType && { employmentType: query.employmentType }),
        ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
      },
      { OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
    ];

    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { organization: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (keyset) {
      and.push(keyset);
    }

    const rows = await this.prisma.opportunity.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (o) => o.createdAt);

    return { opportunities: items.map((o) => this.present(o, viewer)), nextCursor };
  }

  // Everything the user posted, in every status, with the reason if it was
  // rejected or removed.
  async findMine(viewer: AuthUser, query: QueryMyOpportunitiesDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.OpportunityWhereInput>(query.cursor);
    const where: Prisma.OpportunityWhereInput = {
      postedById: viewer.id,
      ...(query.status && { status: query.status }),
    };

    const rows = await this.prisma.opportunity.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (o) => o.createdAt);

    return { opportunities: items.map((o) => this.present(o, viewer)), nextCursor };
  }

  async findById(viewer: AuthUser, id: string) {
    const row = await this.loadVisible(viewer, id);
    return this.present(row, viewer);
  }

  async update(viewer: AuthUser, id: string, dto: UpdateOpportunityDto) {
    const existing = await this.loadVisible(viewer, id);
    const isAdmin = viewer.role === UserRole.ADMIN;
    const isOwner = existing.postedById === viewer.id;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only edit your own opportunities');
    }

    if (existing.status === OpportunityStatus.REMOVED && !isAdmin) {
      throw new ForbiddenException('This opportunity was removed by a moderator and cannot be edited');
    }

    const raw = dto as Record<string, unknown>;
    const data: Prisma.OpportunityUncheckedUpdateManyInput = {};

    for (const key of REQUIRED) {
      if (raw[key] === null) {
        throw new BadRequestException(`${key} cannot be empty`);
      }
    }

    // Plain fields: set when sent, cleared when null.
    const plain = [...REQUIRED, ...CLEARABLE] as const;
    const target = data as Record<string, unknown>;

    for (const key of plain) {
      if (raw[key] !== undefined) {
        target[key] = raw[key];
      }
    }

    if (raw.deadline !== undefined) {
      if (raw.deadline === null) {
        data.deadline = null;
      } else {
        const deadline = parseDeadline(raw.deadline as string);

        // A deadline that is not being changed may already be in the past.
        const unchanged = existing.deadline && existing.deadline.getTime() === deadline.getTime();

        if (!unchanged && deadline.getTime() <= Date.now()) {
          throw new BadRequestException('The deadline must be in the future');
        }

        data.deadline = deadline;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Send at least one field to change');
    }

    const min = 'compensationMin' in data ? (data.compensationMin as number | null) : existing.compensationMin;
    const max = 'compensationMax' in data ? (data.compensationMax as number | null) : existing.compensationMax;
    this.assertCompensation(min, max);

    // Everything a non-admin posts needs approval, so an edit goes back to the
    // queue, and so does editing a rejected post (that is how it is
    // resubmitted). Admin edits never re-queue.
    if (!isAdmin) {
      const publisher = await loadPublisher(this.prisma, viewer.id);

      if (!publisher) {
        throw new NotFoundException('User not found');
      }

      const decision = decideOpportunityPublishing(publisher);

      if (!decision.allowed) {
        throw new ForbiddenException(deniedBody(decision));
      }

      const requeue = decision.mode === 'SUBMIT' || existing.status === OpportunityStatus.REJECTED;

      if (requeue) {
        // A post that is already pending or open is not new to the totals.
        if (existing.status !== OpportunityStatus.PENDING) {
          await this.assertUnderLimits(
            viewer.id,
            true,
            existing.status !== OpportunityStatus.OPEN,
          );
        }

        data.status = OpportunityStatus.PENDING;
        data.reviewedBy = null;
        data.reviewedAt = null;
        data.rejectionReason = null;
      }
    }

    // The status is part of the condition, so an edit cannot undo an admin
    // removing or rejecting this post at the same moment.
    const updated = await this.prisma.opportunity.updateMany({
      where: { id, status: existing.status },
      data,
    });

    if (updated.count === 0) {
      throw new ConflictException('This opportunity just changed. Reload it and try again.');
    }

    const fresh = await this.prisma.opportunity.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    return this.present(fresh, viewer);
  }

  // Close an open opportunity or open a closed one again. No re-review, the
  // content did not change.
  async setStatus(viewer: AuthUser, id: string, dto: UpdateOpportunityStatusDto) {
    const existing = await this.loadVisible(viewer, id);

    if (existing.postedById !== viewer.id) {
      throw new ForbiddenException('You can only change your own opportunities');
    }

    const from =
      dto.status === 'CLOSED' ? OpportunityStatus.OPEN : OpportunityStatus.CLOSED;

    if (existing.status !== from) {
      throw new ConflictException(
        dto.status === 'CLOSED'
          ? `Only an open opportunity can be closed (this one is ${existing.status})`
          : `Only a closed opportunity can be opened again (this one is ${existing.status})`,
      );
    }

    const updated = await this.prisma.opportunity.updateMany({
      where: { id, status: from },
      data: { status: dto.status },
    });

    if (updated.count === 0) {
      throw new ConflictException('This opportunity just changed. Reload it and try again.');
    }

    const fresh = await this.prisma.opportunity.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    return this.present(fresh, viewer);
  }

  async deleteOwn(viewer: AuthUser, id: string) {
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { postedById: true, status: true },
    });

    if (!existing || existing.postedById !== viewer.id) {
      throw new NotFoundException('Opportunity not found');
    }

    // Removed posts stay, so the moderation record is not lost.
    if (existing.status === OpportunityStatus.REMOVED) {
      throw new ForbiddenException('This opportunity was removed by a moderator and cannot be deleted');
    }

    await this.prisma.opportunity.deleteMany({ where: { id, postedById: viewer.id } });
    return { success: true };
  }

  // The owner and admins see a post in any status. Everyone else only sees
  // open and closed posts from active posters they have not blocked (and who
  // have not blocked them). Anything else is a 404, so hidden posts cannot be
  // found by guessing ids.
  private async loadVisible(viewer: AuthUser, id: string): Promise<OpportunityRow> {
    const row = await this.prisma.opportunity.findUnique({ where: { id }, include: INCLUDE });

    if (!row) {
      throw new NotFoundException('Opportunity not found');
    }

    if (row.postedById === viewer.id || viewer.role === UserRole.ADMIN) {
      return row;
    }

    const isPublic = row.status === OpportunityStatus.OPEN || row.status === OpportunityStatus.CLOSED;

    if (!isPublic || !(await this.isPosterActive(row.postedById))) {
      throw new NotFoundException('Opportunity not found');
    }

    if (await this.moderationService.isBlocked(viewer.id, row.postedById)) {
      throw new NotFoundException('Opportunity not found');
    }

    return row;
  }

  private async isPosterActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    return !!user?.isActive;
  }

  private assertCompensation(min: number | null | undefined, max: number | null | undefined) {
    if (min != null && max != null && min > max) {
      throw new BadRequestException('compensationMin cannot be more than compensationMax');
    }
  }

  // checkPending: this post will wait for an admin, so it counts against the
  // review queue limit. checkLive: this post adds to the open and pending total.
  private async assertUnderLimits(userId: string, checkPending: boolean, checkLive = true) {
    const [pending, live] = await Promise.all([
      checkPending
        ? this.prisma.opportunity.count({ where: { postedById: userId, status: OpportunityStatus.PENDING } })
        : Promise.resolve(0),
      this.prisma.opportunity.count({
        where: {
          postedById: userId,
          status: { in: [OpportunityStatus.PENDING, OpportunityStatus.OPEN] },
        },
      }),
    ]);

    if (pending >= MAX_PENDING_PER_USER) {
      throw new ConflictException(
        `You already have ${MAX_PENDING_PER_USER} posts waiting for review. Wait for those to be reviewed first.`,
      );
    }

    if (checkLive && live >= MAX_LIVE_PER_USER) {
      throw new ConflictException(
        `You can have at most ${MAX_LIVE_PER_USER} open or pending opportunities. Close some first.`,
      );
    }
  }

  // Review details (who decided, when) are never shown. The poster and admins
  // see the reason a post was rejected or removed.
  private present(row: OpportunityRow, viewer: AuthUser) {
    const { reviewedBy, reviewedAt, removedBy, rejectionReason, removedReason, removedAt, ...rest } = row;
    const isMine = row.postedById === viewer.id;
    const isAdmin = viewer.role === UserRole.ADMIN;

    return {
      ...rest,
      isMine,
      ...((isMine || isAdmin) && { rejectionReason, removedReason, removedAt, reviewedAt }),
    };
  }
}
