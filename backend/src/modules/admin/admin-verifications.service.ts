import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, VerificationStatus } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user';
import { DEFAULT_PAGE_SIZE, keysetWhere, sliceWithCursor } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';
import { QueryVerificationsDto, VerificationDecisionDto } from './dto/admin-verifications.dto';

const LINK_LIFETIME_SECONDS = 10 * 60;

@Injectable()
export class AdminVerificationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private uploadsService: UploadsService,
    private notificationsService: NotificationsService,
  ) {}

  // The review queue. Pending requests come oldest first so nobody waits
  // forever; history (approved, rejected) comes newest first.
  async list(query: QueryVerificationsDto) {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const status = query.status ?? 'PENDING';
    const direction = status === 'PENDING' ? 'asc' : 'desc';
    const keyset = keysetWhere<Prisma.VerificationDocumentWhereInput>(
      query.cursor,
      'createdAt',
      direction,
    );

    const where: Prisma.VerificationDocumentWhereInput =
      status === 'ALL' ? {} : { status: status as VerificationStatus };

    const rows = await this.prisma.verificationDocument.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: pageSize + 1,
      select: {
        id: true,
        documentType: true,
        note: true,
        status: true,
        rejectionReason: true,
        reviewedAt: true,
        reviewedBy: true,
        createdAt: true,
        publicId: true,
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            role: true,
            state: true,
            emailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    const { items, nextCursor } = sliceWithCursor(rows, pageSize, (d) => d.createdAt);

    return {
      verifications: items.map(({ publicId, ...doc }) => ({
        ...doc,
        // false for very old requests or ones already decided (the file is
        // deleted after a decision).
        hasDocument: !!publicId,
      })),
      nextCursor,
    };
  }

  // A fresh link, valid for 10 minutes. Opening a document is itself
  // written to the audit log.
  async getDocumentLink(admin: AuthUser, id: string) {
    const doc = await this.prisma.verificationDocument.findUnique({
      where: { id },
      select: { id: true, userId: true, publicId: true, resourceType: true, format: true },
    });

    if (!doc) {
      throw new NotFoundException('Verification request not found');
    }

    if (!doc.publicId) {
      throw new NotFoundException(
        'There is no file for this request (it was already decided, or it is an old request).',
      );
    }

    await this.auditService.record(admin, {
      action: AuditAction.VERIFICATION_DOCUMENT_VIEWED,
      targetType: 'VERIFICATION',
      targetId: id,
      metadata: { userId: doc.userId },
    });

    return {
      url: this.uploadsService.signedDocumentUrl({
        publicId: doc.publicId,
        resourceType: doc.resourceType,
        format: doc.format,
      }),
      expiresInSeconds: LINK_LIFETIME_SECONDS,
    };
  }

  async decide(admin: AuthUser, id: string, dto: VerificationDecisionDto) {
    if (dto.decision === VerificationStatus.REJECTED && !dto.reason) {
      throw new BadRequestException('A reason is required when rejecting, the user will see it');
    }

    const doc = await this.prisma.verificationDocument.findUnique({
      where: { id },
      select: { id: true, userId: true, publicId: true, resourceType: true },
    });

    if (!doc) {
      throw new NotFoundException('Verification request not found');
    }

    const approved = dto.decision === VerificationStatus.VERIFIED;

    // Only one admin can decide a request. The second one gets a 409.
    const claimed = await this.prisma.verificationDocument.updateMany({
      where: { id, status: VerificationStatus.PENDING },
      data: {
        status: dto.decision,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: approved ? null : dto.reason,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('This request has already been decided');
    }

    await this.prisma.user.update({
      where: { id: doc.userId },
      data: { verificationStatus: dto.decision, isVerified: approved },
    });

    // The ID or letter is only needed for the decision. Once it is made, the
    // file is deleted from storage and its reference cleared.
    if (doc.publicId) {
      const deleted = await this.uploadsService.deleteDocument({
        publicId: doc.publicId,
        resourceType: doc.resourceType,
      });

      if (deleted) {
        await this.prisma.verificationDocument.update({
          where: { id },
          data: { publicId: null, purgedAt: new Date() },
        });
      }
    }

    await this.notificationsService.create({
      recipientId: doc.userId,
      type: approved
        ? NotificationType.VERIFICATION_APPROVED
        : NotificationType.VERIFICATION_REJECTED,
      message: approved
        ? 'Your NYSC verification was approved. You now have the verified badge.'
        : `Your NYSC verification was not approved: ${dto.reason}`,
    });

    await this.auditService.record(admin, {
      action: approved ? AuditAction.VERIFICATION_APPROVED : AuditAction.VERIFICATION_REJECTED,
      targetType: 'USER',
      targetId: doc.userId,
      reason: dto.reason,
      metadata: { verificationId: id },
    });

    return { id, status: dto.decision };
  }
}
