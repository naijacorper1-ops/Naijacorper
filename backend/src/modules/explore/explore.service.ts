import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateExploreEntryDto } from './dto/create-explore-entry.dto';
import { QueryExploreEntriesDto } from './dto/query-explore-entries.dto';

const PAGE_SIZE = 20;

@Injectable()
export class ExploreService {
  constructor(private prisma: PrismaService) {}

  async create(submittedById: string, dto: CreateExploreEntryDto) {
    const state = dto.state || (await this.getSubmitterState(submittedById));

    if (!state) {
      throw new BadRequestException(
        'State is required — set it in your profile or include it in this request',
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
      include: this.include(),
    });
  }

  async findAll(query: QueryExploreEntriesDto) {
    const where: Prisma.ExploreEntryWhereInput = {
      ...(query.category && { category: query.category }),
      ...(query.state && { state: query.state }),
    };

    const entries = await this.prisma.exploreEntry.findMany({
      where,
      take: PAGE_SIZE,
      ...(query.cursor && { skip: 1, cursor: { id: query.cursor } }),
      orderBy: { createdAt: 'desc' },
      include: this.include(),
    });

    const nextCursor = entries.length === PAGE_SIZE ? entries[entries.length - 1].id : null;

    return { entries, nextCursor };
  }

  async findById(id: string) {
    const entry = await this.prisma.exploreEntry.findUnique({
      where: { id },
      include: this.include(),
    });

    if (!entry) {
      throw new NotFoundException('Explore entry not found');
    }

    return entry;
  }

  private async getSubmitterState(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.state ?? null;
  }

  private include() {
    return {
      submittedBy: {
        select: { id: true, username: true, fullName: true },
      },
    };
  }
}
