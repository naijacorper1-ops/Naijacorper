import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { CreateExploreEntryDto } from './dto/create-explore-entry.dto';
import { QueryExploreEntriesDto } from './dto/query-explore-entries.dto';

const INCLUDE = {
  submittedBy: { select: PUBLIC_USER_SELECT },
} satisfies Prisma.ExploreEntryInclude;

@Injectable()
export class ExploreService {
  constructor(private prisma: PrismaService) {}

  async create(submittedById: string, dto: CreateExploreEntryDto) {
    const state = dto.state || (await this.getSubmitterState(submittedById));

    if (!state) {
      throw new BadRequestException(
        'State is required, set it in your profile or include it in this request',
      );
    }

    return this.prisma.exploreEntry.create({
      data: {
        submittedById,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        state,
        rating: dto.rating,
      },
      include: INCLUDE,
    });
  }

  async findAll(query: QueryExploreEntriesDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.ExploreEntryWhereInput>(query.cursor);

    const where: Prisma.ExploreEntryWhereInput = {
      submittedBy: { isActive: true },
      ...(query.category && { category: query.category }),
      ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const rows = await this.prisma.exploreEntry.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (e) => e.createdAt);

    return { entries: items, nextCursor };
  }

  async findById(id: string) {
    const entry = await this.prisma.exploreEntry.findFirst({
      where: { id, submittedBy: { isActive: true } },
      include: INCLUDE,
    });

    if (!entry) {
      throw new NotFoundException('Explore entry not found');
    }

    return entry;
  }

  async deleteOwn(userId: string, id: string) {
    const entry = await this.prisma.exploreEntry.findUnique({
      where: { id },
      select: { submittedById: true },
    });

    if (!entry) {
      throw new NotFoundException('Explore entry not found');
    }

    if (entry.submittedById !== userId) {
      throw new ForbiddenException('You can only delete your own entries');
    }

    await this.prisma.exploreEntry.delete({ where: { id } });
    return { success: true };
  }

  private async getSubmitterState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { state: true },
    });

    return user?.state ?? null;
  }
}
