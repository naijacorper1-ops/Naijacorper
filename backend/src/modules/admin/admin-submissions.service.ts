import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, NotificationType, OpportunityStatus, Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { lockPpas, recomputePpaAggregates } from '../ppa/ppa-aggregates';
import {
  QueryAdminEventsDto,
  QueryAdminOpportunitiesDto,
  QueryAdminPpaReviewsDto,
  SubmissionDecisionDto,
} from './dto/admin-submissions.dto';

const preview = (text: string | null | undefined) => (text ? text.slice(0, 200) : null);

const withReason = (what: string, reason?: string) => (reason ? `${what} Reason: ${reason}` : what);

// What an admin needs to know about the person behind a submission.
const ADMIN_USER_SELECT = { ...PUBLIC_USER_SELECT, email: true, isActive: true } satisfies Prisma.UserSelect;

// The approval queue and moderation for opportunities, events and PPA
// reviews. Every decision tells the person and is written to the audit log.
@Injectable()
export class AdminSubmissionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  // Opportunities

  async listOpportunities(query: QueryAdminOpportunitiesDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    // Oldest first for the queue, newest first for everything else.
    const direction = query.status === OpportunityStatus.PENDING ? 'asc' : 'desc';
    const keyset = keysetWhere<Prisma.OpportunityWhereInput>(query.cursor, 'createdAt', direction);
    const and: Prisma.OpportunityWhereInput[] = [
      {
        ...(query.status && { status: query.status }),
        ...(query.type && { type: query.type }),
        ...(query.postedById && { postedById: query.postedById }),
      },
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
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: pageSize + 1,
      include: { postedBy: { select: ADMIN_USER_SELECT } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (o) => o.createdAt);

    return { opportunities: items, nextCursor };
  }

  async getOpportunity(id: string) {
    const row = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { postedBy: { select: ADMIN_USER_SELECT } },
    });

    if (!row) {
      throw new NotFoundException('Opportunity not found');
    }

    return row;
  }

  async decideOpportunity(admin: AuthUser, id: string, dto: SubmissionDecisionDto) {
    this.assertReasonForRejection(dto);

    const item = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, postedById: true, title: true, status: true },
    });

    if (!item) {
      throw new NotFoundException('Opportunity not found');
    }

    const approve = dto.decision === 'APPROVE';

    // Only a pending post can be decided, and only once. The check is part of
    // the update, so two admins cannot both decide it.
    const claimed = await this.prisma.opportunity.updateMany({
      where: { id, status: OpportunityStatus.PENDING },
      data: {
        status: approve ? OpportunityStatus.OPEN : OpportunityStatus.REJECTED,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: approve ? null : dto.reason,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This opportunity is not waiting for review');
    }

    await this.notificationsService.create({
      recipientId: item.postedById,
      type: approve ? NotificationType.OPPORTUNITY_APPROVED : NotificationType.OPPORTUNITY_REJECTED,
      opportunityId: id,
      message: approve
        ? `Your opportunity "${item.title}" was approved and is now live.`
        : withReason(`Your opportunity "${item.title}" was not approved. Edit it and it will be reviewed again.`, dto.reason),
    });

    await this.auditService.record(admin, {
      action: approve ? AuditAction.OPPORTUNITY_APPROVED : AuditAction.OPPORTUNITY_REJECTED,
      targetType: 'OPPORTUNITY',
      targetId: id,
      reason: dto.reason,
      metadata: { postedById: item.postedById, title: item.title },
    });

    return this.getOpportunity(id);
  }

  async removeOpportunity(admin: AuthUser, id: string, reason?: string) {
    const item = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, postedById: true, title: true },
    });

    if (!item) {
      throw new NotFoundException('Opportunity not found');
    }

    const removed = await this.prisma.opportunity.updateMany({
      where: { id, status: { not: OpportunityStatus.REMOVED } },
      data: {
        status: OpportunityStatus.REMOVED,
        removedReason: reason ?? 'Removed by a moderator',
        removedAt: new Date(),
        removedBy: admin.id,
      },
    });

    if (removed.count === 0) {
      throw new ConflictException('This opportunity has already been removed');
    }

    await this.notificationsService.create({
      recipientId: item.postedById,
      type: NotificationType.CONTENT_REMOVED,
      opportunityId: id,
      message: withReason(`Your opportunity "${item.title}" was removed by a moderator.`, reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.OPPORTUNITY_REMOVED,
      targetType: 'OPPORTUNITY',
      targetId: id,
      reason,
      metadata: { postedById: item.postedById, title: item.title },
    });

    return { success: true };
  }

  // A restored opportunity is live again: restoring is the admin's approval.
  async restoreOpportunity(admin: AuthUser, id: string, reason?: string) {
    const restored = await this.prisma.opportunity.updateMany({
      where: { id, status: OpportunityStatus.REMOVED },
      data: {
        status: OpportunityStatus.OPEN,
        removedReason: null,
        removedAt: null,
        removedBy: null,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    if (restored.count === 0) {
      throw new NotFoundException('There is no removed opportunity with this id');
    }

    await this.auditService.record(admin, {
      action: AuditAction.OPPORTUNITY_RESTORED,
      targetType: 'OPPORTUNITY',
      targetId: id,
      reason,
    });

    return { success: true };
  }

  // Events

  async listEvents(query: QueryAdminEventsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const direction = query.status === EventStatus.PENDING ? 'asc' : 'desc';
    const keyset = keysetWhere<Prisma.EventWhereInput>(query.cursor, 'createdAt', direction);
    const and: Prisma.EventWhereInput[] = [
      {
        ...(query.status && { status: query.status }),
        ...(query.category && { category: query.category }),
        ...(query.createdById && { createdById: query.createdById }),
      },
    ];

    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { organizerName: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (keyset) {
      and.push(keyset);
    }

    const rows = await this.prisma.event.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: pageSize + 1,
      include: { createdBy: { select: ADMIN_USER_SELECT } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (e) => e.createdAt);

    return { events: items, nextCursor };
  }

  async getEvent(id: string) {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: { createdBy: { select: ADMIN_USER_SELECT } },
    });

    if (!row) {
      throw new NotFoundException('Event not found');
    }

    return row;
  }

  async decideEvent(admin: AuthUser, id: string, dto: SubmissionDecisionDto) {
    this.assertReasonForRejection(dto);

    const item = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, createdById: true, title: true, endsAt: true },
    });

    if (!item) {
      throw new NotFoundException('Event not found');
    }

    const approve = dto.decision === 'APPROVE';

    if (approve && item.endsAt.getTime() <= Date.now()) {
      throw new ConflictException('This event has already ended, so it cannot be approved. Reject it instead.');
    }

    const claimed = await this.prisma.event.updateMany({
      where: { id, status: EventStatus.PENDING },
      data: {
        status: approve ? EventStatus.PUBLISHED : EventStatus.REJECTED,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: approve ? null : dto.reason,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This event is not waiting for review');
    }

    await this.notificationsService.create({
      recipientId: item.createdById,
      type: approve ? NotificationType.EVENT_APPROVED : NotificationType.EVENT_REJECTED,
      eventId: id,
      message: approve
        ? `Your event "${item.title}" was approved and is now live.`
        : withReason(`Your event "${item.title}" was not approved. Edit it and it will be reviewed again.`, dto.reason),
    });

    await this.auditService.record(admin, {
      action: approve ? AuditAction.EVENT_APPROVED : AuditAction.EVENT_REJECTED,
      targetType: 'EVENT',
      targetId: id,
      reason: dto.reason,
      metadata: { createdById: item.createdById, title: item.title },
    });

    return this.getEvent(id);
  }

  // If people had already said they are going to a live event, they are told it
  // is off.
  async removeEvent(admin: AuthUser, id: string, reason?: string) {
    const item = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, createdById: true, title: true, status: true },
    });

    if (!item) {
      throw new NotFoundException('Event not found');
    }

    const removed = await this.prisma.event.updateMany({
      where: { id, status: { not: EventStatus.REMOVED } },
      data: {
        status: EventStatus.REMOVED,
        removedReason: reason ?? 'Removed by a moderator',
        removedAt: new Date(),
        removedBy: admin.id,
      },
    });

    if (removed.count === 0) {
      throw new ConflictException('This event has already been removed');
    }

    await this.notificationsService.create({
      recipientId: item.createdById,
      type: NotificationType.CONTENT_REMOVED,
      eventId: id,
      message: withReason(`Your event "${item.title}" was removed by a moderator.`, reason),
    });

    if (item.status === EventStatus.PUBLISHED) {
      const attendees = await this.prisma.eventRsvp.findMany({
        where: { eventId: id, userId: { not: item.createdById } },
        select: { userId: true },
      });

      await this.notificationsService.createMany(
        attendees.map((a) => ({
          recipientId: a.userId,
          type: NotificationType.EVENT_CANCELLED,
          eventId: id,
          message: `"${item.title}" is no longer available.`,
        })),
      );
    }

    await this.auditService.record(admin, {
      action: AuditAction.EVENT_REMOVED,
      targetType: 'EVENT',
      targetId: id,
      reason,
      metadata: { createdById: item.createdById, title: item.title, previousStatus: item.status },
    });

    return { success: true };
  }

  async restoreEvent(admin: AuthUser, id: string, reason?: string) {
    const restored = await this.prisma.event.updateMany({
      where: { id, status: EventStatus.REMOVED },
      data: {
        status: EventStatus.PUBLISHED,
        removedReason: null,
        removedAt: null,
        removedBy: null,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    if (restored.count === 0) {
      throw new NotFoundException('There is no removed event with this id');
    }

    await this.auditService.record(admin, {
      action: AuditAction.EVENT_RESTORED,
      targetType: 'EVENT',
      targetId: id,
      reason,
    });

    return { success: true };
  }

  // PPA reviews. Admins always see who wrote a review, even an anonymous one.

  async listPpaReviews(query: QueryAdminPpaReviewsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.PpaReviewWhereInput>(query.cursor);
    const where: Prisma.PpaReviewWhereInput = {
      ...(query.ppaId && { ppaId: query.ppaId }),
      ...(query.authorId && { authorId: query.authorId }),
      ...(query.q && { content: { contains: query.q, mode: 'insensitive' } }),
    };

    const rows = await this.prisma.ppaReview.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: {
        author: { select: ADMIN_USER_SELECT },
        ppa: { select: { id: true, name: true, state: true } },
      },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (r) => r.createdAt);

    return { reviews: items, nextCursor };
  }

  async getPpaReview(id: string) {
    const row = await this.prisma.ppaReview.findUnique({
      where: { id },
      include: {
        author: { select: ADMIN_USER_SELECT },
        ppa: { select: { id: true, name: true, state: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('Review not found');
    }

    return row;
  }

  async removePpaReview(admin: AuthUser, id: string, reason?: string) {
    const review = await this.prisma.ppaReview.findUnique({
      where: { id },
      select: {
        id: true,
        ppaId: true,
        authorId: true,
        content: true,
        overallRating: true,
        ppa: { select: { name: true } },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.$transaction(
      async (tx) => {
        await lockPpas(tx, [review.ppaId]);

        const deleted = await tx.ppaReview.deleteMany({ where: { id } });

        if (deleted.count === 0) {
          throw new NotFoundException('Review not found');
        }

        await recomputePpaAggregates(tx, [review.ppaId]);
      },
      { timeout: 15000 },
    );

    await this.notificationsService.create({
      recipientId: review.authorId,
      type: NotificationType.CONTENT_REMOVED,
      message: withReason(`Your review of "${review.ppa.name}" was removed by a moderator.`, reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.PPA_REVIEW_REMOVED,
      targetType: 'PPA_REVIEW',
      targetId: id,
      reason,
      metadata: {
        authorId: review.authorId,
        ppaId: review.ppaId,
        overallRating: review.overallRating,
        contentPreview: preview(review.content),
      },
    });

    return { success: true };
  }

  private assertReasonForRejection(dto: SubmissionDecisionDto) {
    if (dto.decision === 'REJECT' && (!dto.reason || dto.reason.length < 3)) {
      throw new BadRequestException('A reason (at least 3 characters) is required when rejecting');
    }
  }
}
