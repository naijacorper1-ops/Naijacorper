import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Opportunities and events are not open to everyone. This file is the one
// place that decides who may submit them, and whether what they submit goes
// live straight away or waits for an admin.
//
//   PUBLISH: goes live immediately.
//   SUBMIT:  saved as PENDING until an admin approves it.
//
// The functions are plain (no database, no request) so the rules can be
// tested on their own.

export interface Publisher {
  role: UserRole;
  isVerified: boolean;
  emailVerified: boolean;
  isActive: boolean;
}

export type PublishDecision =
  | { allowed: true; mode: 'PUBLISH' | 'SUBMIT' }
  | { allowed: false; code: PublishDeniedCode; message: string };

export type PublishDeniedCode = 'EMAIL_NOT_VERIFIED' | 'VERIFICATION_REQUIRED' | 'ROLE_NOT_ALLOWED';

const EMAIL_DENIED: PublishDecision = {
  allowed: false,
  code: 'EMAIL_NOT_VERIFIED',
  message: 'Verify your email address before doing this',
};

const VERIFICATION_DENIED: PublishDecision = {
  allowed: false,
  code: 'VERIFICATION_REQUIRED',
  message: 'Only NYSC-verified corps members can do this. Submit your NYSC verification first.',
};

const ROLE_DENIED: PublishDecision = {
  allowed: false,
  code: 'ROLE_NOT_ALLOWED',
  message: 'Your account type cannot do this',
};

const CORPS_MEMBER_ROLES: UserRole[] = [UserRole.SERVING_CORPER, UserRole.EX_CORPER];

// Admins, recruiters and businesses publish opportunities directly (recruiters
// and businesses need a verified email). Verified corps members may suggest
// one, which an admin approves first.
export function decideOpportunityPublishing(user: Publisher): PublishDecision {
  if (!user.isActive) {
    return ROLE_DENIED;
  }

  if (user.role === UserRole.ADMIN) {
    return { allowed: true, mode: 'PUBLISH' };
  }

  if (user.role === UserRole.RECRUITER || user.role === UserRole.BUSINESS) {
    return user.emailVerified ? { allowed: true, mode: 'PUBLISH' } : EMAIL_DENIED;
  }

  if (CORPS_MEMBER_ROLES.includes(user.role)) {
    if (!user.emailVerified) {
      return EMAIL_DENIED;
    }

    return user.isVerified ? { allowed: true, mode: 'SUBMIT' } : VERIFICATION_DENIED;
  }

  return ROLE_DENIED;
}

// Only admins publish events directly. Recruiters and businesses (verified
// email) and verified corps members submit them for approval.
export function decideEventPublishing(user: Publisher): PublishDecision {
  if (!user.isActive) {
    return ROLE_DENIED;
  }

  if (user.role === UserRole.ADMIN) {
    return { allowed: true, mode: 'PUBLISH' };
  }

  if (user.role === UserRole.RECRUITER || user.role === UserRole.BUSINESS) {
    return user.emailVerified ? { allowed: true, mode: 'SUBMIT' } : EMAIL_DENIED;
  }

  if (CORPS_MEMBER_ROLES.includes(user.role)) {
    if (!user.emailVerified) {
      return EMAIL_DENIED;
    }

    return user.isVerified ? { allowed: true, mode: 'SUBMIT' } : VERIFICATION_DENIED;
  }

  return ROLE_DENIED;
}

// PPA reviews: only verified serving or ex corps members with a verified email.
export function decidePpaReviewing(user: Publisher): PublishDecision {
  if (!user.isActive || !CORPS_MEMBER_ROLES.includes(user.role)) {
    return {
      allowed: false,
      code: 'ROLE_NOT_ALLOWED',
      message: 'Only serving and ex corps members can review a PPA',
    };
  }

  if (!user.emailVerified) {
    return EMAIL_DENIED;
  }

  return user.isVerified ? { allowed: true, mode: 'PUBLISH' } : VERIFICATION_DENIED;
}

// The reply for a "not allowed": 403 with a code the frontend can switch on.
export function deniedBody(decision: Extract<PublishDecision, { allowed: false }>) {
  return {
    statusCode: 403,
    error: 'Forbidden',
    code: decision.code,
    message: decision.message,
  };
}

// The few facts about a user the rules above need. Loaded fresh from the
// database, so a role change or a new verification counts immediately.
export async function loadPublisher(prisma: PrismaService, userId: string): Promise<Publisher | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isVerified: true, emailVerified: true, isActive: true },
  });
}
