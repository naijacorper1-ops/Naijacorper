import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventFormat, EventStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { decideEventPublishing, deniedBody, loadPublisher } from '../../common/utils/publishing';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventsDto, QueryMyEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { assertValidTimes } from './event-times';

const MAX_PENDING_PER_USER = 10;
const MAX_LIVE_PER_USER = 30;

const INCLUDE = {
  createdBy: { select: PUBLIC_USER_SELECT },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof INCLUDE }>;

const REQUIRED = ['title', 'description', 'category', 'format'] as const;

const CLEARABLE = [
  'coverImageUrl',
  'organizerName',
  'state',
  'lga',
  'city',
  'venue',
  'registrationUrl',
  'meetingUrl',
] as const;

// Statuses the creator can still edit.
const EDITABLE: EventStatus[] = [EventStatus.PENDING, EventStatus.PUBLISHED, EventStatus.REJECTED];

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    private notificationsService: NotificationsService,
    private uploadsService: UploadsService,
  ) {}

  async create(user: AuthUser, dto: CreateEventDto) {
    const publisher = await loadPublisher(this.prisma, user.id);

    if (!publisher) {
      throw new NotFoundException('User not found');
    }

    const decision = decideEventPublishing(publisher);

    if (!decision.allowed) {
      throw new ForbiddenException(deniedBody(decision));
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    assertValidTimes(startsAt, endsAt);

    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('An event must start in the future');
    }

    const format = dto.format ?? EventFormat.PHYSICAL;
    this.assertPlace(format, dto.state);

    if (user.role !== UserRole.ADMIN) {
      await this.assertUnderLimits(user.id, true, true);
    }

    const created = await this.prisma.event.create({
      data: {
        createdById: user.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        coverImageUrl: dto.coverImageUrl,
        organizerName: dto.organizerName,
        startsAt,
        endsAt,
        format,
        state: dto.state,
        lga: dto.lga,
        city: dto.city,
        venue: dto.venue,
        registrationUrl: dto.registrationUrl,
        meetingUrl: dto.meetingUrl,
        status: decision.mode === 'PUBLISH' ? EventStatus.PUBLISHED : EventStatus.PENDING,
      },
      include: INCLUDE,
    });

    return this.present(created, user, false);
  }

  // The public list: published events from active organizers, minus ones from
  // people the viewer has blocked (or who blocked the viewer). Cancelled
  // events are not listed, but their link keeps working.
  async findAll(viewer: AuthUser, query: QueryEventsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const when = query.when ?? 'upcoming';
    const direction = when === 'upcoming' ? 'asc' : 'desc';
    const blockedIds = await this.moderationService.getBlockedIds(viewer.id);
    const keyset = keysetWhere<Prisma.EventWhereInput>(query.cursor, 'startsAt', direction);
    const now = new Date();

    const and: Prisma.EventWhereInput[] = [
      {
        status: EventStatus.PUBLISHED,
        createdBy: { isActive: true },
        ...(blockedIds.length > 0 && { createdById: { notIn: blockedIds } }),
        ...(query.category && { category: query.category }),
        ...(query.format && { format: query.format }),
        ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
        ...(when === 'upcoming' && { endsAt: { gt: now } }),
        ...(when === 'past' && { endsAt: { lte: now } }),
      },
    ];

    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { organizerName: { contains: query.q, mode: 'insensitive' } },
          { venue: { contains: query.q, mode: 'insensitive' } },
          { city: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (keyset) {
      and.push(keyset);
    }

    const rows = await this.prisma.event.findMany({
      where: { AND: and },
      orderBy: [{ startsAt: direction }, { id: direction }],
      take: pageSize + 1,
      include: INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (e) => e.startsAt);
    const going = await this.goingSet(viewer.id, items.map((e) => e.id));

    return { events: items.map((e) => this.present(e, viewer, going.has(e.id))), nextCursor };
  }

  // Everything the user created, in every status, newest first.
  async findMine(viewer: AuthUser, query: QueryMyEventsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.EventWhereInput>(query.cursor);
    const where: Prisma.EventWhereInput = {
      createdById: viewer.id,
      ...(query.status && { status: query.status }),
    };

    const rows = await this.prisma.event.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (e) => e.createdAt);
    const going = await this.goingSet(viewer.id, items.map((e) => e.id));

    return { events: items.map((e) => this.present(e, viewer, going.has(e.id))), nextCursor };
  }

  // Events the viewer said they are going to, most recent RSVP first. The
  // cursor follows the RSVP, not the event.
  async findGoing(viewer: AuthUser, query: PageQueryDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const blockedIds = await this.moderationService.getBlockedIds(viewer.id);
    const keyset = keysetWhere<Prisma.EventRsvpWhereInput>(query.cursor);
    const where: Prisma.EventRsvpWhereInput = {
      userId: viewer.id,
      event: {
        status: { in: [EventStatus.PUBLISHED, EventStatus.CANCELLED] },
        createdBy: { isActive: true },
        ...(blockedIds.length > 0 && { createdById: { notIn: blockedIds } }),
      },
    };

    const rows = await this.prisma.eventRsvp.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: { event: { include: INCLUDE } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (r) => r.createdAt);

    return { events: items.map((r) => this.present(r.event, viewer, true)), nextCursor };
  }

  async findById(viewer: AuthUser, id: string) {
    const row = await this.loadVisible(viewer, id);
    const going = await this.goingSet(viewer.id, [id]);

    return this.present(row, viewer, going.has(id));
  }

  async update(viewer: AuthUser, id: string, dto: UpdateEventDto) {
    const existing = await this.loadVisible(viewer, id);
    const isAdmin = viewer.role === UserRole.ADMIN;

    if (existing.createdById !== viewer.id && !isAdmin) {
      throw new ForbiddenException('You can only edit your own events');
    }

    if (!isAdmin) {
      if (existing.status === EventStatus.REMOVED) {
        throw new ForbiddenException('This event was removed by a moderator and cannot be edited');
      }

      if (!EDITABLE.includes(existing.status)) {
        throw new ConflictException('A cancelled event cannot be edited');
      }
    }

    const raw = dto as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    for (const key of [...REQUIRED, 'startsAt', 'endsAt']) {
      if (raw[key] === null) {
        throw new BadRequestException(`${key} cannot be empty`);
      }
    }

    for (const key of [...REQUIRED, ...CLEARABLE]) {
      if (raw[key] !== undefined) {
        data[key] = raw[key];
      }
    }

    const startsAt = raw.startsAt !== undefined ? new Date(raw.startsAt as string) : existing.startsAt;
    const endsAt = raw.endsAt !== undefined ? new Date(raw.endsAt as string) : existing.endsAt;

    if (raw.startsAt !== undefined || raw.endsAt !== undefined) {
      assertValidTimes(startsAt, endsAt);
    }

    if (raw.startsAt !== undefined) {
      // A start time that is not being changed may already have passed.
      if (startsAt.getTime() !== existing.startsAt.getTime() && startsAt.getTime() <= Date.now()) {
        throw new BadRequestException('An event must start in the future');
      }

      data.startsAt = startsAt;
    }

    if (raw.endsAt !== undefined) {
      data.endsAt = endsAt;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Send at least one field to change');
    }

    const format = (data.format as EventFormat | undefined) ?? existing.format;
    const state = 'state' in data ? (data.state as string | null) : existing.state;
    this.assertPlace(format, state);

    // Whatever a non-admin changes goes back to an admin before it is public
    // again. That includes editing a rejected event, which resubmits it.
    if (!isAdmin) {
      const publisher = await loadPublisher(this.prisma, viewer.id);

      if (!publisher) {
        throw new NotFoundException('User not found');
      }

      const decision = decideEventPublishing(publisher);

      if (!decision.allowed) {
        throw new ForbiddenException(deniedBody(decision));
      }

      if (existing.status !== EventStatus.PENDING) {
        await this.assertUnderLimits(viewer.id, true, existing.status === EventStatus.REJECTED);
      }

      data.status = decision.mode === 'PUBLISH' ? existing.status : EventStatus.PENDING;

      if (data.status === EventStatus.PENDING) {
        data.reviewedBy = null;
        data.reviewedAt = null;
        data.rejectionReason = null;
      }
    }

    const updated = await this.prisma.event.updateMany({
      where: { id, status: existing.status },
      data: data as Prisma.EventUncheckedUpdateManyInput,
    });

    if (updated.count === 0) {
      throw new ConflictException('This event just changed. Reload it and try again.');
    }

    // The old cover is deleted from storage once nothing uses it.
    if ('coverImageUrl' in data && existing.coverImageUrl && existing.coverImageUrl !== data.coverImageUrl) {
      await this.uploadsService.deleteByUrl(existing.coverImageUrl);
    }

    const fresh = await this.prisma.event.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    const going = await this.goingSet(viewer.id, [id]);

    return this.present(fresh, viewer, going.has(id));
  }

  // The organizer calls the event off. Everyone who said they are going is told.
  async cancel(viewer: AuthUser, id: string, dto: CancelEventDto) {
    const existing = await this.loadVisible(viewer, id);

    if (existing.createdById !== viewer.id) {
      throw new ForbiddenException('You can only cancel your own events');
    }

    if (existing.status !== EventStatus.PUBLISHED) {
      throw new ConflictException(
        existing.status === EventStatus.CANCELLED
          ? 'This event is already cancelled'
          : `Only a published event can be cancelled (this one is ${existing.status}). Delete it instead.`,
      );
    }

    if (existing.endsAt.getTime() <= Date.now()) {
      throw new ConflictException('This event has already ended');
    }

    const claimed = await this.prisma.event.updateMany({
      where: { id, status: EventStatus.PUBLISHED },
      data: { status: EventStatus.CANCELLED },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This event just changed. Reload it and try again.');
    }

    const attendees = await this.prisma.eventRsvp.findMany({
      where: { eventId: id, userId: { not: viewer.id } },
      select: { userId: true },
    });

    const message = dto.reason
      ? `"${existing.title}" was cancelled by the organizer. Reason: ${dto.reason}`
      : `"${existing.title}" was cancelled by the organizer.`;

    await this.notificationsService.createMany(
      attendees.map((a) => ({
        recipientId: a.userId,
        type: NotificationType.EVENT_CANCELLED,
        eventId: id,
        message,
      })),
    );

    const fresh = await this.prisma.event.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    const going = await this.goingSet(viewer.id, [id]);

    return this.present(fresh, viewer, going.has(id));
  }

  // Published events must be cancelled first, so the people who planned to go
  // are told. Removed events stay, so the moderation record is not lost.
  async deleteOwn(viewer: AuthUser, id: string) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: { createdById: true, status: true, coverImageUrl: true },
    });

    if (!existing || existing.createdById !== viewer.id) {
      throw new NotFoundException('Event not found');
    }

    if (existing.status === EventStatus.REMOVED) {
      throw new ForbiddenException('This event was removed by a moderator and cannot be deleted');
    }

    if (existing.status === EventStatus.PUBLISHED) {
      throw new ConflictException('Cancel a published event before deleting it');
    }

    const deleted = await this.prisma.event.deleteMany({
      where: { id, createdById: viewer.id, status: { not: EventStatus.PUBLISHED } },
    });

    if (deleted.count === 0) {
      throw new ConflictException('This event just changed. Reload it and try again.');
    }

    await this.uploadsService.deleteByUrl(existing.coverImageUrl);

    return { success: true };
  }

  async rsvp(viewer: AuthUser, id: string) {
    const event = await this.loadVisible(viewer, id);

    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictException('This event was cancelled');
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }

    if (event.endsAt.getTime() <= Date.now()) {
      throw new ConflictException('This event has already ended');
    }

    try {
      // The RSVP and the counter change together or not at all. The unique
      // rule on (event, user) means two taps at once cannot both count.
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.eventRsvp.create({ data: { eventId: id, userId: viewer.id } });

        return tx.event.update({
          where: { id },
          data: { rsvpCount: { increment: 1 } },
          select: { rsvpCount: true },
        });
      });

      return { going: true, rsvpCount: updated.rsvpCount };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You are already going to this event');
      }

      throw error;
    }
  }

  async cancelRsvp(viewer: AuthUser, id: string) {
    const exists = await this.prisma.event.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('Event not found');
    }

    const event = await this.prisma.$transaction(async (tx) => {
      const removed = await tx.eventRsvp.deleteMany({ where: { eventId: id, userId: viewer.id } });

      // Only lower the counter if an RSVP was really removed.
      if (removed.count > 0) {
        await tx.event.updateMany({
          where: { id, rsvpCount: { gt: 0 } },
          data: { rsvpCount: { decrement: 1 } },
        });
      }

      return tx.event.findUnique({ where: { id }, select: { rsvpCount: true } });
    });

    return { going: false, rsvpCount: event?.rsvpCount ?? 0 };
  }

  // The full list of who is going is for the organizer and admins only.
  // Everyone else gets the count (rsvpCount) and their own answer (viewerRsvp).
  async attendees(viewer: AuthUser, id: string, query: PageQueryDto) {
    const event = await this.loadVisible(viewer, id);

    if (event.createdById !== viewer.id && viewer.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the organizer can see who is going');
    }

    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.EventRsvpWhereInput>(query.cursor);
    const where: Prisma.EventRsvpWhereInput = { eventId: id, user: { isActive: true } };

    const rows = await this.prisma.eventRsvp.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: { user: { select: PUBLIC_USER_SELECT } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (r) => r.createdAt);

    return {
      attendees: items.map((r) => ({ user: r.user, rsvpAt: r.createdAt })),
      total: event.rsvpCount,
      nextCursor,
    };
  }

  // The organizer and admins see an event in any status. Everyone else only
  // sees published and cancelled events from active organizers they have not
  // blocked (and who have not blocked them). Anything else is a 404, so hidden
  // events cannot be found by guessing ids.
  private async loadVisible(viewer: AuthUser, id: string): Promise<EventRow> {
    const row = await this.prisma.event.findUnique({ where: { id }, include: INCLUDE });

    if (!row) {
      throw new NotFoundException('Event not found');
    }

    if (row.createdById === viewer.id || viewer.role === UserRole.ADMIN) {
      return row;
    }

    const isPublic = row.status === EventStatus.PUBLISHED || row.status === EventStatus.CANCELLED;

    if (!isPublic) {
      throw new NotFoundException('Event not found');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: row.createdById },
      select: { isActive: true },
    });

    if (!creator?.isActive || (await this.moderationService.isBlocked(viewer.id, row.createdById))) {
      throw new NotFoundException('Event not found');
    }

    return row;
  }

  // One query for a whole page, not one per event.
  private async goingSet(userId: string, eventIds: string[]): Promise<Set<string>> {
    if (eventIds.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.eventRsvp.findMany({
      where: { userId, eventId: { in: eventIds } },
      select: { eventId: true },
    });

    return new Set(rows.map((r) => r.eventId));
  }

  private assertPlace(format: EventFormat, state: string | null | undefined) {
    if (format !== EventFormat.VIRTUAL && !state) {
      throw new BadRequestException('state is required for physical and hybrid events');
    }
  }

  private async assertUnderLimits(userId: string, checkPending: boolean, checkLive: boolean) {
    const [pending, live] = await Promise.all([
      checkPending
        ? this.prisma.event.count({ where: { createdById: userId, status: EventStatus.PENDING } })
        : Promise.resolve(0),
      checkLive
        ? this.prisma.event.count({
            where: {
              createdById: userId,
              status: { in: [EventStatus.PENDING, EventStatus.PUBLISHED] },
              endsAt: { gt: new Date() },
            },
          })
        : Promise.resolve(0),
    ]);

    if (pending >= MAX_PENDING_PER_USER) {
      throw new ConflictException(
        `You already have ${MAX_PENDING_PER_USER} events waiting for review. Wait for those to be reviewed first.`,
      );
    }

    if (live >= MAX_LIVE_PER_USER) {
      throw new ConflictException(
        `You can have at most ${MAX_LIVE_PER_USER} upcoming events at a time. Cancel or delete some first.`,
      );
    }
  }

  // Review details (who decided, when) are never shown. The organizer and
  // admins see the reason an event was rejected or removed. "by ..." falls
  // back to the organizer's name when none was set.
  private present(row: EventRow, viewer: AuthUser, viewerRsvp: boolean) {
    const { reviewedBy, reviewedAt, removedBy, rejectionReason, removedReason, removedAt, ...rest } = row;
    const isMine = row.createdById === viewer.id;
    const isAdmin = viewer.role === UserRole.ADMIN;

    return {
      ...rest,
      organizerName: row.organizerName ?? row.createdBy.fullName,
      isMine,
      viewerRsvp,
      ...((isMine || isAdmin) && { rejectionReason, removedReason, removedAt, reviewedAt }),
    };
  }
}
