import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';

const PAGE_SIZE = 20;

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async create(sellerId: string, dto: CreateListingDto) {
    const state = dto.state || (await this.getSellerState(sellerId));

    return this.prisma.listing.create({
      data: {
        sellerId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        category: dto.category,
        state,
        imageUrls: dto.imageUrls || [],
      },
      include: this.include(),
    });
  }

  async findAll(query: QueryListingsDto) {
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.AVAILABLE,
      ...(query.category && { category: query.category }),
      ...(query.state && { state: query.state }),
    };

    const listings = await this.prisma.listing.findMany({
      where,
      take: PAGE_SIZE,
      ...(query.cursor && { skip: 1, cursor: { id: query.cursor } }),
      orderBy: { createdAt: 'desc' },
      include: this.include(),
    });

    const nextCursor = listings.length === PAGE_SIZE ? listings[listings.length - 1].id : null;

    return { listings, nextCursor };
  }

  async findById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: this.include(),
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async updateOwn(sellerId: string, id: string, dto: UpdateListingDto) {
    await this.assertOwner(sellerId, id);

    return this.prisma.listing.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        category: dto.category,
        state: dto.state,
        imageUrls: dto.imageUrls,
      },
      include: this.include(),
    });
  }

  async updateStatus(sellerId: string, id: string, dto: UpdateListingStatusDto) {
    await this.assertOwner(sellerId, id);

    return this.prisma.listing.update({
      where: { id },
      data: { status: dto.status },
      include: this.include(),
    });
  }

  async deleteOwn(sellerId: string, id: string) {
    await this.assertOwner(sellerId, id);
    await this.prisma.listing.delete({ where: { id } });
    return { success: true };
  }

  private async assertOwner(sellerId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new BadRequestException('You can only manage your own listings');
    }

    return listing;
  }

  private async getSellerState(sellerId: string) {
    const seller = await this.prisma.user.findUnique({ where: { id: sellerId } });
    return seller?.state ?? null;
  }

  private include() {
    return {
      seller: {
        select: { id: true, username: true, fullName: true, state: true },
      },
    };
  }
}
