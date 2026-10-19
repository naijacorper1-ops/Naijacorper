import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Every admin action that changes something is recorded here.
export const AuditAction = {
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_VERIFICATION_CHANGED: 'USER_VERIFICATION_CHANGED',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  VERIFICATION_REJECTED: 'VERIFICATION_REJECTED',
  VERIFICATION_DOCUMENT_VIEWED: 'VERIFICATION_DOCUMENT_VIEWED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  POST_REMOVED: 'POST_REMOVED',
  COMMENT_REMOVED: 'COMMENT_REMOVED',
  LISTING_REMOVED: 'LISTING_REMOVED',
  LISTING_RESTORED: 'LISTING_RESTORED',
  GROUP_REMOVED: 'GROUP_REMOVED',
  EXPLORE_ENTRY_REMOVED: 'EXPLORE_ENTRY_REMOVED',
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntryInput {
  action: AuditActionName;
  targetType?: string;
  targetId?: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(admin: { id: string; username: string }, entry: AuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminUsername: admin.username,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: entry.reason ?? undefined,
        metadata: entry.metadata,
      },
    });
  }
}
