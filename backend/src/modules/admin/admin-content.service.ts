import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, NotificationType, Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from '../../common/selects';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { CommentsService } from '../comments/comments.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PostsService } from '../posts/posts.service';
import {
  QueryAdminGroupsDto,
  QueryAdminListingsDto,
  QueryAdminPostsDto,
} from './dto/admin-content.dto';

const preview = (text: string | null | undefined) => (text ? text.slice(0, 200) : null);

const withReason = (what: string, reason?: string) =>
  reason ? `${what} Reason: ${reason}` : what;

// Everything an admin can do to posts, comments, listings, groups and
// explore entries. Each removal tells the owner and is written to the audit log.
@Injectable()
export class AdminContentService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private postsService: PostsService,
    private commentsService: CommentsService,
    private groupsService: GroupsService,
    private notificationsService: NotificationsService,
  ) {}

  // Posts

  async listPosts(query: QueryAdminPostsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.PostWhereInput>(query.cursor);
    const where: Prisma.PostWhereInput = {
      ...(query.authorId && { authorId: query.authorId }),
      ...(query.groupId && { groupId: query.groupId }),
      ...(query.q && { content: { contains: query.q, mode: 'insensitive' } }),
    };

    const rows = await this.prisma.post.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: { author: { select: PUBLIC_USER_SELECT }, group: { select: { id: true, name: true } } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (p) => p.createdAt);

    return { posts: items, nextCursor };
  }

  async getPost(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: PUBLIC_USER_SELECT },
        group: { select: { id: true, name: true } },
        repostOf: { select: { id: true, content: true, author: { select: PUBLIC_USER_SELECT } } },
        comments: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 50,
          include: { author: { select: PUBLIC_USER_SELECT } },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async removePost(admin: AuthUser, postId: string, reason?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, content: true, groupId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.postsService.removePost(postId);

    await this.notificationsService.create({
      recipientId: post.authorId,
      type: NotificationType.CONTENT_REMOVED,
      message: withReason('One of your posts was removed by a moderator.', reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.POST_REMOVED,
      targetType: 'POST',
      targetId: postId,
      reason,
      metadata: { authorId: post.authorId, groupId: post.groupId, contentPreview: preview(post.content) },
    });

    return { success: true };
  }

  // Comments

  async removeComment(admin: AuthUser, commentId: string, reason?: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, postId: true, content: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.commentsService.removeComment(commentId);

    await this.notificationsService.create({
      recipientId: comment.authorId,
      type: NotificationType.CONTENT_REMOVED,
      message: withReason('One of your comments was removed by a moderator.', reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.COMMENT_REMOVED,
      targetType: 'COMMENT',
      targetId: commentId,
      reason,
      metadata: {
        authorId: comment.authorId,
        postId: comment.postId,
        contentPreview: preview(comment.content),
      },
    });

    return { success: true };
  }

  // Listings

  async listListings(query: QueryAdminListingsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.ListingWhereInput>(query.cursor);
    const where: Prisma.ListingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.sellerId && { sellerId: query.sellerId }),
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
      include: { seller: { select: { ...PUBLIC_USER_SELECT, email: true, isActive: true } } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (l) => l.createdAt);

    return { listings: items, nextCursor };
  }

  async getListing(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { seller: { select: { ...PUBLIC_USER_SELECT, email: true, isActive: true } } },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async removeListing(admin: AuthUser, listingId: string, reason?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, title: true, status: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Only the first removal counts. The check is part of the update, so two
    // admins removing the same listing cannot both succeed.
    const removed = await this.prisma.listing.updateMany({
      where: { id: listingId, status: { not: ListingStatus.REMOVED } },
      data: {
        status: ListingStatus.REMOVED,
        removedReason: reason ?? 'Removed by a moderator',
        removedAt: new Date(),
        removedBy: admin.id,
      },
    });

    if (removed.count === 0) {
      throw new ConflictException('This listing has already been removed');
    }

    await this.notificationsService.create({
      recipientId: listing.sellerId,
      type: NotificationType.LISTING_REMOVED,
      listingId,
      message: withReason(`Your listing "${listing.title}" was removed by a moderator.`, reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.LISTING_REMOVED,
      targetType: 'LISTING',
      targetId: listingId,
      reason,
      metadata: { sellerId: listing.sellerId, title: listing.title },
    });

    return { success: true };
  }

  async restoreListing(admin: AuthUser, listingId: string, reason?: string) {
    const restored = await this.prisma.listing.updateMany({
      where: { id: listingId, status: ListingStatus.REMOVED },
      data: {
        status: ListingStatus.AVAILABLE,
        removedReason: null,
        removedAt: null,
        removedBy: null,
      },
    });

    if (restored.count === 0) {
      throw new NotFoundException('There is no removed listing with this id');
    }

    await this.auditService.record(admin, {
      action: AuditAction.LISTING_RESTORED,
      targetType: 'LISTING',
      targetId: listingId,
      reason,
    });

    return { success: true };
  }

  // Groups

  async listGroups(query: QueryAdminGroupsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const keyset = keysetWhere<Prisma.GroupWhereInput>(query.cursor);
    const where: Prisma.GroupWhereInput = {
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
    };

    const rows = await this.prisma.group.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      include: { createdBy: { select: PUBLIC_USER_SELECT } },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (g) => g.createdAt);

    return { groups: items, nextCursor };
  }

  async removeGroup(admin: AuthUser, groupId: string, reason?: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, createdById: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.groupsService.removeGroup(groupId);

    await this.notificationsService.create({
      recipientId: group.createdById,
      type: NotificationType.CONTENT_REMOVED,
      message: withReason(`Your group "${group.name}" was removed by a moderator.`, reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.GROUP_REMOVED,
      targetType: 'GROUP',
      targetId: groupId,
      reason,
      metadata: { name: group.name, createdById: group.createdById },
    });

    return { success: true };
  }

  // Explore entries

  async removeExploreEntry(admin: AuthUser, entryId: string, reason?: string) {
    const entry = await this.prisma.exploreEntry.findUnique({
      where: { id: entryId },
      select: { id: true, name: true, submittedById: true },
    });

    if (!entry) {
      throw new NotFoundException('Explore entry not found');
    }

    await this.prisma.exploreEntry.delete({ where: { id: entryId } });

    await this.notificationsService.create({
      recipientId: entry.submittedById,
      type: NotificationType.CONTENT_REMOVED,
      message: withReason(`Your Explore entry "${entry.name}" was removed by a moderator.`, reason),
    });

    await this.auditService.record(admin, {
      action: AuditAction.EXPLORE_ENTRY_REMOVED,
      targetType: 'EXPLORE_ENTRY',
      targetId: entryId,
      reason,
      metadata: { name: entry.name, submittedById: entry.submittedById },
    });

    return { success: true };
  }
}
