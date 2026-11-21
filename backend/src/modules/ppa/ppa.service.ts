import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { decidePpaReviewing, deniedBody, loadPublisher } from '../../common/utils/publishing';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { QueryPpasDto, SuggestPpasDto } from './dto/query-ppas.dto';
import { SubmitPpaReviewDto } from './dto/submit-ppa-review.dto';
import { UpdatePpaReviewDto } from './dto/update-ppa-review.dto';
import { lockPpas, recomputePpaAggregates } from './ppa-aggregates';
import { cleanPpaName, makePpaNameKey } from './ppa-name';
import { summarisePpa } from './ppa-stats';

const HIGHLIGHT_LENGTH = 200;
const SUGGEST_LIMIT = 10;

const PPA_BASIC_SELECT = {
  id: true,
  name: true,
  state: true,
  lga: true,
  sector: true,
} satisfies Prisma.PpaSelect;

const REVIEW_INCLUDE = {
  author: { select: PUBLIC_USER_SELECT },
  ppa: { select: PPA_BASIC_SELECT },
} satisfies Prisma.PpaReviewInclude;

type ReviewRow = Prisma.PpaReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

export interface Highlight {
  content: string;
  createdAt: Date;
}

@Injectable()
export class PpaService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  // PPAs that have at least one review, most recently reviewed first.
  async findAll(viewer: AuthUser, query: QueryPpasDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.PpaWhereInput>(query.cursor, 'lastReviewedAt', 'desc');

    const and: Prisma.PpaWhereInput[] = [
      {
        reviewCount: { gt: 0 },
        lastReviewedAt: { not: null },
        ...(query.sector && { sector: query.sector }),
        ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
      },
    ];

    if (query.q) {
      and.push(this.nameFilter(query.q));
    }

    if (keyset) {
      and.push(keyset);
    }

    const rows = await this.prisma.ppa.findMany({
      where: { AND: and },
      orderBy: [{ lastReviewedAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (p) => p.lastReviewedAt as Date);
    const blockedIds = await this.moderationService.getBlockedIds(viewer.id);
    const highlights = await this.highlights(
      items.map((p) => p.id),
      blockedIds,
    );

    return {
      ppas: items.map((ppa) => ({
        ...this.presentPpa(ppa),
        highlight: highlights.get(ppa.id) ?? null,
      })),
      nextCursor,
    };
  }

  // For the "which PPA?" field when writing a review. Includes PPAs with no
  // reviews yet. Not paged: at most 10, best matches first.
  async suggest(query: SuggestPpasDto) {
    const rows = await this.prisma.ppa.findMany({
      where: {
        AND: [
          this.nameFilter(query.q),
          ...(query.state ? [{ state: { equals: query.state, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: [{ reviewCount: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      take: SUGGEST_LIMIT,
      select: { ...PPA_BASIC_SELECT, reviewCount: true },
    });

    return { ppas: rows };
  }

  // A PPA can be opened by id even with no reviews (for example straight after
  // its first reviewer deleted theirs), so old links keep working.
  async findById(viewer: AuthUser, id: string) {
    const ppa = await this.prisma.ppa.findUnique({ where: { id } });

    if (!ppa) {
      throw new NotFoundException('PPA not found');
    }

    const [distribution, mine] = await Promise.all([
      this.prisma.ppaReview.groupBy({
        by: ['overallRating'],
        where: { ppaId: id },
        _count: { _all: true },
      }),
      this.prisma.ppaReview.findUnique({
        where: { ppaId_authorId: { ppaId: id, authorId: viewer.id } },
        include: REVIEW_INCLUDE,
      }),
    ]);

    const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

    for (const row of distribution) {
      ratingDistribution[String(row.overallRating)] = row._count._all;
    }

    return {
      ...this.presentPpa(ppa),
      ratingDistribution,
      // The viewer's own review, so the app can offer "edit" instead of "write".
      myReview: mine ? this.presentReview(mine, viewer) : null,
    };
  }

  async findReviews(viewer: AuthUser, ppaId: string, query: PageQueryDto) {
    const exists = await this.prisma.ppa.findUnique({ where: { id: ppaId }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('PPA not found');
    }

    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const blockedIds = await this.moderationService.getBlockedIds(viewer.id);
    const keyset = keysetWhere<Prisma.PpaReviewWhereInput>(query.cursor);

    // A blocked person's review is only hidden when it is not anonymous.
    // Hiding an anonymous one would tell the blocker who wrote it.
    const where: Prisma.PpaReviewWhereInput = {
      ppaId,
      ...(blockedIds.length > 0 && {
        OR: [{ isAnonymous: true }, { authorId: { notIn: blockedIds } }],
      }),
    };

    const rows = await this.prisma.ppaReview.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: REVIEW_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (r) => r.createdAt);

    return { reviews: items.map((r) => this.presentReview(r, viewer)), nextCursor };
  }

  async findMine(viewer: AuthUser, query: PageQueryDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.PpaReviewWhereInput>(query.cursor);
    const where: Prisma.PpaReviewWhereInput = { authorId: viewer.id };

    const rows = await this.prisma.ppaReview.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: REVIEW_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (r) => r.createdAt);

    return { reviews: items.map((r) => this.presentReview(r, viewer)), nextCursor };
  }

  async submit(viewer: AuthUser, dto: SubmitPpaReviewDto) {
    await this.assertMayReview(viewer.id);

    const ppaId = await this.resolvePpa(viewer.id, dto);

    try {
      const review = await this.prisma.$transaction(
        async (tx) => {
          // One change to this PPA's reviews at a time, so the totals stay right.
          await lockPpas(tx, [ppaId]);

          const existing = await tx.ppaReview.findUnique({
            where: { ppaId_authorId: { ppaId, authorId: viewer.id } },
            select: { id: true },
          });

          if (existing) {
            throw new ConflictException('You have already reviewed this PPA. Edit your review instead.');
          }

          const created = await tx.ppaReview.create({
            data: {
              ppaId,
              authorId: viewer.id,
              overallRating: dto.overallRating,
              environment: dto.environment,
              learning: dto.learning,
              workload: dto.workload,
              staffRelationship: dto.staffRelationship,
              content: dto.content,
              isAnonymous: dto.isAnonymous ?? true,
            },
            include: REVIEW_INCLUDE,
          });

          await recomputePpaAggregates(tx, [ppaId]);

          return created;
        },
        { timeout: 15000 },
      );

      return this.presentReview(review, viewer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already reviewed this PPA. Edit your review instead.');
      }

      throw error;
    }
  }

  async update(viewer: AuthUser, reviewId: string, dto: UpdatePpaReviewDto) {
    // Someone else's review is a 404, not a 403. Which reviews are yours is
    // nobody else's business.
    const existing = await this.prisma.ppaReview.findUnique({
      where: { id: reviewId },
      select: { ppaId: true, authorId: true },
    });

    if (!existing || existing.authorId !== viewer.id) {
      throw new NotFoundException('Review not found');
    }

    await this.assertMayReview(viewer.id);

    const data: Prisma.PpaReviewUncheckedUpdateManyInput = {
      ...(dto.overallRating !== undefined && { overallRating: dto.overallRating }),
      ...(dto.environment !== undefined && { environment: dto.environment }),
      ...(dto.learning !== undefined && { learning: dto.learning }),
      ...(dto.workload !== undefined && { workload: dto.workload }),
      ...(dto.staffRelationship !== undefined && { staffRelationship: dto.staffRelationship }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.isAnonymous !== undefined && { isAnonymous: dto.isAnonymous }),
    };

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Send at least one field to change');
    }

    const review = await this.prisma.$transaction(
      async (tx) => {
        await lockPpas(tx, [existing.ppaId]);

        const updated = await tx.ppaReview.updateMany({
          where: { id: reviewId, authorId: viewer.id },
          data,
        });

        if (updated.count === 0) {
          throw new NotFoundException('Review not found');
        }

        await recomputePpaAggregates(tx, [existing.ppaId]);

        return tx.ppaReview.findUniqueOrThrow({ where: { id: reviewId }, include: REVIEW_INCLUDE });
      },
      { timeout: 15000 },
    );

    return this.presentReview(review, viewer);
  }

  async deleteOwn(viewer: AuthUser, reviewId: string) {
    const existing = await this.prisma.ppaReview.findUnique({
      where: { id: reviewId },
      select: { ppaId: true, authorId: true },
    });

    if (!existing || existing.authorId !== viewer.id) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.$transaction(
      async (tx) => {
        await lockPpas(tx, [existing.ppaId]);
        await tx.ppaReview.deleteMany({ where: { id: reviewId, authorId: viewer.id } });
        await recomputePpaAggregates(tx, [existing.ppaId]);
      },
      { timeout: 15000 },
    );

    return { success: true };
  }

  // Only verified serving and ex corps members (with a verified email) write
  // reviews. The reply carries a `code` the app can switch on.
  private async assertMayReview(userId: string) {
    const publisher = await loadPublisher(this.prisma, userId);

    if (!publisher) {
      throw new NotFoundException('User not found');
    }

    const decision = decidePpaReviewing(publisher);

    if (!decision.allowed) {
      throw new ForbiddenException(deniedBody(decision));
    }
  }

  // Either the PPA the reviewer picked, or the PPA with that name in that
  // state, created if this is the first review of it.
  private async resolvePpa(userId: string, dto: SubmitPpaReviewDto): Promise<string> {
    if (dto.ppaId) {
      if (dto.name || dto.state || dto.lga || dto.sector) {
        throw new BadRequestException('Send either ppaId, or name and state, not both');
      }

      const ppa = await this.prisma.ppa.findUnique({ where: { id: dto.ppaId }, select: { id: true } });

      if (!ppa) {
        throw new NotFoundException('PPA not found');
      }

      return ppa.id;
    }

    if (!dto.name || !dto.state) {
      throw new BadRequestException('Send either ppaId, or both name and state');
    }

    const name = cleanPpaName(dto.name);
    const nameKey = makePpaNameKey(name);

    if (!nameKey) {
      throw new BadRequestException('name must contain letters or numbers');
    }

    const where = { nameKey_state: { nameKey, state: dto.state } };
    const found = await this.prisma.ppa.findUnique({ where, select: { id: true } });

    if (found) {
      return found.id;
    }

    try {
      const created = await this.prisma.ppa.create({
        data: {
          name,
          nameKey,
          state: dto.state,
          lga: dto.lga,
          sector: dto.sector,
          createdById: userId,
        },
        select: { id: true },
      });

      return created.id;
    } catch (error) {
      // Somebody else created the same PPA a moment ago. Use theirs.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this.prisma.ppa.findUnique({ where, select: { id: true } });

        if (again) {
          return again.id;
        }
      }

      throw error;
    }
  }

  private nameFilter(q: string): Prisma.PpaWhereInput {
    const key = makePpaNameKey(q);

    return {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        ...(key ? [{ nameKey: { contains: key } }] : []),
      ],
    };
  }

  // The newest review's opening words for each PPA, in one query.
  private async highlights(ppaIds: string[], blockedIds: string[]): Promise<Map<string, Highlight>> {
    const map = new Map<string, Highlight>();

    if (ppaIds.length === 0) {
      return map;
    }

    const rows = await this.prisma.$queryRaw<{ ppaId: string; content: string; createdAt: Date }[]>`
      SELECT DISTINCT ON (r."ppaId") r."ppaId", r."content", r."createdAt"
      FROM "ppa_reviews" r
      WHERE r."ppaId" = ANY(${ppaIds}::text[])
        AND (r."isAnonymous" = true OR NOT (r."authorId" = ANY(${blockedIds}::text[])))
      ORDER BY r."ppaId", r."createdAt" DESC, r."id" DESC`;

    for (const row of rows) {
      const content =
        row.content.length > HIGHLIGHT_LENGTH
          ? `${row.content.slice(0, HIGHLIGHT_LENGTH).trimEnd()}...`
          : row.content;

      map.set(row.ppaId, { content, createdAt: row.createdAt });
    }

    return map;
  }

  private presentPpa(ppa: Prisma.PpaGetPayload<object>) {
    return {
      id: ppa.id,
      name: ppa.name,
      state: ppa.state,
      lga: ppa.lga,
      sector: ppa.sector,
      lastReviewedAt: ppa.lastReviewedAt,
      ...summarisePpa(ppa),
    };
  }

  // The author's id is never returned. The author object is only there when
  // the author chose to be named, and the author sees their own review
  // through isMine.
  private presentReview(row: ReviewRow, viewer: AuthUser) {
    const { authorId, author, ...rest } = row;

    return {
      ...rest,
      isMine: authorId === viewer.id,
      author: row.isAnonymous ? null : author,
    };
  }
}
