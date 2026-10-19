import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingCategory, ListingStatus, Prisma, ReportTargetType } from '@prisma/client';
import { PUBLIC_USER_SELECT, SELLER_SELECT } from '../../common/selects';
import { isOurCloudinaryUrl } from '../../common/validators/cloudinary-url.validator';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto, QueryMyListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';

// One seller cannot fill the marketplace with an unlimited number of ads.
const MAX_ACTIVE_LISTINGS_PER_SELLER = 20;

const LISTING_INCLUDE = {
  seller: { select: SELLER_SELECT },
} satisfies Prisma.ListingInclude;

type ListingRow = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
  ) {}

  async create(sellerId: string, dto: CreateListingDto) {
    const imageUrls = dto.imageUrls ?? [];

    this.assertHasImages(dto.category, imageUrls);

    await this.assertUnderListingLimit(sellerId);

    const state = dto.state || (await this.getSellerState(sellerId));

    const listing = await this.prisma.listing.create({
      data: {
        sellerId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        category: dto.category,
        state,
        imageUrls,
      },
      include: LISTING_INCLUDE,
    });

    return this.present(listing, sellerId);
  }

  // The public marketplace: available listings from active sellers, minus
  // sellers the viewer has blocked (or who blocked the viewer).
  async findAll(viewerId: string, query: QueryListingsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const blockedIds = await this.moderationService.getBlockedIds(viewerId);
    const keyset = keysetWhere<Prisma.ListingWhereInput>(query.cursor);

    const priceFilter: Prisma.IntFilter | undefined =
      query.minPrice !== undefined || query.maxPrice !== undefined
        ? { gte: query.minPrice, lte: query.maxPrice }
        : undefined;

    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.AVAILABLE,
      seller: { isActive: true },
      ...(blockedIds.length > 0 && { sellerId: { notIn: blockedIds } }),
      ...(query.category && { category: query.category }),
      ...(query.state && { state: { equals: query.state, mode: 'insensitive' } }),
      ...(priceFilter && { price: priceFilter }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const rows = await this.prisma.listing.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: LISTING_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (l) => l.createdAt);

    return { listings: items.map((l) => this.present(l, viewerId)), nextCursor };
  }

  // The seller's own listings, including sold ones and ones an admin removed
  // (with the reason, so the seller knows why).
  async findMine(sellerId: string, query: QueryMyListingsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.ListingWhereInput>(query.cursor);
    const where: Prisma.ListingWhereInput = {
      sellerId,
      ...(query.status && { status: query.status }),
    };

    const rows = await this.prisma.listing.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: LISTING_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (l) => l.createdAt);

    return { listings: items.map((l) => this.present(l, sellerId)), nextCursor };
  }

  async findById(viewerId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: LISTING_INCLUDE,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== viewerId) {
      // Removed listings, listings of deactivated sellers and listings of
      // blocked sellers are invisible to everyone but the seller.
      const hidden =
        listing.status === ListingStatus.REMOVED ||
        !(await this.isSellerActive(listing.sellerId)) ||
        (await this.moderationService.isBlocked(viewerId, listing.sellerId));

      if (hidden) {
        throw new NotFoundException('Listing not found');
      }
    }

    return this.present(listing, viewerId);
  }

  // Basic seller info for buyers: the profile badge, member since, and how
  // many things they have sold.
  async getSeller(viewerId: string, username: string) {
    const seller = await this.findVisibleSeller(viewerId, username);

    const [activeListings, soldListings] = await Promise.all([
      this.prisma.listing.count({ where: { sellerId: seller.id, status: ListingStatus.AVAILABLE } }),
      this.prisma.listing.count({ where: { sellerId: seller.id, status: ListingStatus.SOLD } }),
    ]);

    return { ...seller, activeListings, soldListings };
  }

  async findBySeller(viewerId: string, username: string, query: QueryMyListingsDto) {
    const seller = await this.findVisibleSeller(viewerId, username);
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.ListingWhereInput>(query.cursor);
    // Visitors can see what is for sale or already sold, never removed ones.
    const where: Prisma.ListingWhereInput = {
      sellerId: seller.id,
      status: query.status === ListingStatus.SOLD ? ListingStatus.SOLD : ListingStatus.AVAILABLE,
    };

    const rows = await this.prisma.listing.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: LISTING_INCLUDE,
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (l) => l.createdAt);

    return { listings: items.map((l) => this.present(l, viewerId)), nextCursor };
  }

  async updateOwn(sellerId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.assertOwner(sellerId, id);
    this.assertNotRemoved(listing.status);

    // The result must still be a valid listing: changing only the category
    // (say to PHONES) must not leave a photo-less item.
    if (dto.imageUrls !== undefined || dto.category !== undefined) {
      this.assertHasImages(dto.category ?? listing.category, dto.imageUrls ?? listing.imageUrls);
    }

    if (dto.imageUrls !== undefined) {
      const isNew = (url: string) => !listing.imageUrls.includes(url);

      if (dto.imageUrls.filter(isNew).some((url) => !isOurCloudinaryUrl(url, 'listings'))) {
        throw new BadRequestException(
          'imageUrls must only contain files uploaded through our upload endpoints',
        );
      }
    }

    return this.saveUnlessRemoved(sellerId, id, {
      title: dto.title,
      description: dto.description,
      price: dto.price,
      category: dto.category,
      state: dto.state,
      imageUrls: dto.imageUrls,
    });
  }

  async updateStatus(sellerId: string, id: string, dto: UpdateListingStatusDto) {
    const listing = await this.assertOwner(sellerId, id);
    this.assertNotRemoved(listing.status);

    // Putting a sold item back on sale counts toward the limit again,
    // otherwise sold listings could be revived without end.
    if (dto.status === ListingStatus.AVAILABLE && listing.status !== ListingStatus.AVAILABLE) {
      await this.assertUnderListingLimit(sellerId);
    }

    return this.saveUnlessRemoved(sellerId, id, { status: dto.status });
  }

  // The write only goes through if a moderator has not removed the listing in
  // the meantime, so a seller's late edit can never bring a removed listing back.
  private async saveUnlessRemoved(sellerId: string, id: string, data: Prisma.ListingUpdateManyMutationInput) {
    const result = await this.prisma.listing.updateMany({
      where: { id, status: { not: ListingStatus.REMOVED } },
      data,
    });

    if (result.count === 0) {
      this.assertNotRemoved(ListingStatus.REMOVED);
    }

    const updated = await this.prisma.listing.findUniqueOrThrow({
      where: { id },
      include: LISTING_INCLUDE,
    });

    return this.present(updated, sellerId);
  }

  async deleteOwn(sellerId: string, id: string) {
    const listing = await this.assertOwner(sellerId, id);

    // A seller cannot erase a listing that moderators removed, the record
    // has to stay for the admins.
    this.assertNotRemoved(listing.status);

    await this.prisma.listing.delete({ where: { id } });
    return { success: true };
  }

  async report(reporterId: string, listingId: string, reason: string) {
    return this.moderationService.createReport(reporterId, {
      targetType: ReportTargetType.LISTING,
      targetId: listingId,
      reason,
    });
  }

  private async assertOwner(sellerId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only manage your own listings');
    }

    return listing;
  }

  private async assertUnderListingLimit(sellerId: string) {
    const activeCount = await this.prisma.listing.count({
      where: { sellerId, status: ListingStatus.AVAILABLE },
    });

    if (activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
      throw new BadRequestException(
        `You can have at most ${MAX_ACTIVE_LISTINGS_PER_SELLER} active listings. Mark some as sold or delete them first.`,
      );
    }
  }

  private assertNotRemoved(status: ListingStatus) {
    if (status === ListingStatus.REMOVED) {
      throw new ForbiddenException(
        'This listing was removed by a moderator and can no longer be changed',
      );
    }
  }

  private assertHasImages(category: ListingCategory, imageUrls: string[]) {
    if (imageUrls.length === 0 && category !== ListingCategory.SERVICES) {
      throw new BadRequestException(
        'Add at least one photo of the item (upload it with POST /uploads/listing-image first)',
      );
    }
  }

  private async findVisibleSeller(viewerId: string, username: string) {
    const seller = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, isActive: true },
      select: { ...SELLER_SELECT, bio: true },
    });

    if (!seller || (await this.moderationService.isBlocked(viewerId, seller.id))) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }

  private async isSellerActive(sellerId: string) {
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { isActive: true },
    });

    return !!seller?.isActive;
  }

  private async getSellerState(sellerId: string) {
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { state: true },
    });

    return seller?.state ?? null;
  }

  // The removal reason is only shown to the seller. Who removed it is
  // never shown.
  private present(listing: ListingRow, viewerId: string) {
    const { removedBy, removedReason, removedAt, ...rest } = listing;
    const isMine = listing.sellerId === viewerId;

    return {
      ...rest,
      isMine,
      ...(isMine && listing.status === ListingStatus.REMOVED && { removedReason, removedAt }),
    };
  }
}
