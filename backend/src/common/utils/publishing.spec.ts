import { UserRole } from '@prisma/client';
import {
  Publisher,
  decideEventPublishing,
  decideOpportunityPublishing,
  decidePpaReviewing,
} from './publishing';

const user = (over: Partial<Publisher> = {}): Publisher => ({
  role: UserRole.SERVING_CORPER,
  isVerified: true,
  emailVerified: true,
  isActive: true,
  ...over,
});

describe('decideOpportunityPublishing', () => {
  it('lets an admin publish at once', () => {
    expect(decideOpportunityPublishing(user({ role: UserRole.ADMIN, isVerified: false }))).toEqual({
      allowed: true,
      mode: 'PUBLISH',
    });
  });

  it.each([UserRole.RECRUITER, UserRole.BUSINESS])('queues a %s with a verified email for approval', (role) => {
    expect(decideOpportunityPublishing(user({ role, isVerified: false }))).toEqual({
      allowed: true,
      mode: 'SUBMIT',
    });
  });

  it.each([UserRole.RECRUITER, UserRole.BUSINESS])('asks a %s to verify their email first', (role) => {
    expect(decideOpportunityPublishing(user({ role, emailVerified: false }))).toMatchObject({
      allowed: false,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it.each([UserRole.SERVING_CORPER, UserRole.EX_CORPER])('queues a verified %s for approval', (role) => {
    expect(decideOpportunityPublishing(user({ role }))).toEqual({ allowed: true, mode: 'SUBMIT' });
  });

  it('asks a corps member to verify their email first', () => {
    expect(decideOpportunityPublishing(user({ emailVerified: false }))).toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('asks a corps member without NYSC verification to verify', () => {
    expect(decideOpportunityPublishing(user({ isVerified: false }))).toMatchObject({
      allowed: false,
      code: 'VERIFICATION_REQUIRED',
    });
  });

  it('does not let a prospective corps member post', () => {
    expect(decideOpportunityPublishing(user({ role: UserRole.PROSPECTIVE_CORPER }))).toMatchObject({
      allowed: false,
      code: 'ROLE_NOT_ALLOWED',
    });
  });

  it('does not let a deactivated account post', () => {
    expect(decideOpportunityPublishing(user({ role: UserRole.ADMIN, isActive: false }))).toMatchObject({
      allowed: false,
      code: 'ROLE_NOT_ALLOWED',
    });
  });
});

describe('decideEventPublishing', () => {
  it('lets an admin publish at once', () => {
    expect(decideEventPublishing(user({ role: UserRole.ADMIN }))).toEqual({ allowed: true, mode: 'PUBLISH' });
  });

  it.each([UserRole.RECRUITER, UserRole.BUSINESS, UserRole.SERVING_CORPER, UserRole.EX_CORPER])(
    'queues an event from a verified %s for approval',
    (role) => {
      expect(decideEventPublishing(user({ role }))).toEqual({ allowed: true, mode: 'SUBMIT' });
    },
  );

  it('does not require NYSC verification from a recruiter or a business', () => {
    expect(decideEventPublishing(user({ role: UserRole.RECRUITER, isVerified: false }))).toEqual({
      allowed: true,
      mode: 'SUBMIT',
    });
  });

  it.each([UserRole.RECRUITER, UserRole.BUSINESS, UserRole.SERVING_CORPER])(
    'asks a %s to verify their email first',
    (role) => {
      expect(decideEventPublishing(user({ role, emailVerified: false }))).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
      });
    },
  );

  it('asks an unverified corps member to verify', () => {
    expect(decideEventPublishing(user({ role: UserRole.EX_CORPER, isVerified: false }))).toMatchObject({
      code: 'VERIFICATION_REQUIRED',
    });
  });

  it('does not let a prospective corps member create events', () => {
    expect(decideEventPublishing(user({ role: UserRole.PROSPECTIVE_CORPER }))).toMatchObject({
      code: 'ROLE_NOT_ALLOWED',
    });
  });
});

describe('decidePpaReviewing', () => {
  it.each([UserRole.SERVING_CORPER, UserRole.EX_CORPER])('lets a verified %s review', (role) => {
    expect(decidePpaReviewing(user({ role })).allowed).toBe(true);
  });

  it.each([UserRole.PROSPECTIVE_CORPER, UserRole.RECRUITER, UserRole.BUSINESS, UserRole.ADMIN])(
    'does not let a %s review',
    (role) => {
      expect(decidePpaReviewing(user({ role }))).toMatchObject({ allowed: false, code: 'ROLE_NOT_ALLOWED' });
    },
  );

  it('needs a verified email', () => {
    expect(decidePpaReviewing(user({ emailVerified: false }))).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });

  it('needs NYSC verification', () => {
    expect(decidePpaReviewing(user({ isVerified: false }))).toMatchObject({ code: 'VERIFICATION_REQUIRED' });
  });
});
