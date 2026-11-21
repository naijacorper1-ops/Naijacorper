import { EventStatus, NotificationType, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { TestContext, TestUser, auth, cloudinaryUrl, createContext, inDays } from './helpers';

const HOUR = 60 * 60 * 1000;

const body = (over: Record<string, unknown> = {}) => {
  const start = inDays(7);

  return {
    title: 'Abeokuta Corpers Meetup',
    description: 'A friendly meetup for corps members around Abeokuta.',
    category: 'MEETUP',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 3 * HOUR).toISOString(),
    format: 'PHYSICAL',
    state: 'Ogun',
    venue: 'Cultural Centre, Kuto',
    ...over,
  };
};

describe('Events', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let recruiter: TestUser;
  let business: TestUser;
  let corper: TestUser;
  let viewer: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    ctx = await createContext();
    await ctx.reset();
    admin = await ctx.makeUser({ role: UserRole.ADMIN });
    recruiter = await ctx.makeUser({ role: UserRole.RECRUITER, isVerified: false });
    business = await ctx.makeUser({ role: UserRole.BUSINESS, isVerified: false });
    corper = await ctx.makeUser({ role: UserRole.SERVING_CORPER });
    viewer = await ctx.makeUser({ role: UserRole.PROSPECTIVE_CORPER, isVerified: false });
    other = await ctx.makeUser({ role: UserRole.EX_CORPER });
  });

  afterAll(async () => {
    await ctx.close();
  });

  const post = (user: TestUser, data: Record<string, unknown> = body()) =>
    ctx.http().post('/api/v1/events').set(auth(user)).send(data);

  const list = (user: TestUser, query = '') => ctx.http().get(`/api/v1/events${query}`).set(auth(user));

  const get = (user: TestUser, id: string) => ctx.http().get(`/api/v1/events/${id}`).set(auth(user));

  const decide = (id: string, data: Record<string, unknown>) =>
    ctx.http().patch(`/api/v1/admin/events/${id}/decision`).set(auth(admin)).send(data);

  // An event that is live, created by `by` (an admin publishes directly).
  const publish = async (by: TestUser, over: Record<string, unknown> = {}) => {
    const id = (await post(by, body(over)).expect(201)).body.id as string;

    if (by.id !== admin.id) {
      await decide(id, { decision: 'APPROVE' }).expect(200);
    }

    return id;
  };

  // The API refuses events that start in the past, so a past event is written directly.
  const createPastEvent = (over: Record<string, unknown> = {}) =>
    ctx.prisma.event.create({
      data: {
        createdById: admin.id,
        title: 'Past event',
        description: 'This event already happened a while ago.',
        category: 'MEETUP',
        startsAt: new Date(Date.now() - 3 * 24 * HOUR),
        endsAt: new Date(Date.now() - 3 * 24 * HOUR + 2 * HOUR),
        format: 'PHYSICAL',
        state: 'Lagos',
        status: EventStatus.PUBLISHED,
        ...over,
      },
    });

  describe('who may create', () => {
    it('needs a login', async () => {
      await ctx.http().post('/api/v1/events').send(body()).expect(401);
      await ctx.http().get('/api/v1/events').expect(401);
    });

    it('refuses a prospective corps member', async () => {
      const res = await post(viewer).expect(403);
      expect(res.body.code).toBe('ROLE_NOT_ALLOWED');
    });

    it('refuses an unverified email, whoever it is', async () => {
      for (const role of [UserRole.SERVING_CORPER, UserRole.RECRUITER, UserRole.BUSINESS]) {
        const user = await ctx.makeUser({ role, emailVerified: false });
        const res = await post(user).expect(403);
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
      }
    });

    it('refuses a corps member who is not NYSC verified', async () => {
      const user = await ctx.makeUser({ isVerified: false });
      const res = await post(user).expect(403);
      expect(res.body.code).toBe('VERIFICATION_REQUIRED');
    });

    it('queues events from corps members, recruiters and businesses for approval', async () => {
      for (const user of [corper, other, recruiter, business]) {
        const res = await post(user).expect(201);
        expect(res.body.status).toBe('PENDING');
        expect(res.body.isMine).toBe(true);
        expect(res.body.viewerRsvp).toBe(false);
        expect(res.body.rsvpCount).toBe(0);
      }
    });

    it('publishes an admin\'s event straight away', async () => {
      const res = await post(admin).expect(201);
      expect(res.body.status).toBe('PUBLISHED');
    });

    it('shows the creator\'s name as the organizer unless another is given', async () => {
      const plain = await post(admin).expect(201);
      const named = await post(admin, body({ organizerName: 'NYSC Ogun State' })).expect(201);

      expect(plain.body.organizerName).toBe(`Full ${admin.username}`);
      expect(named.body.organizerName).toBe('NYSC Ogun State');
    });
  });

  describe('validation', () => {
    it('rejects bad input with a 400', async () => {
      await post(admin, body({ title: 'x' })).expect(400);
      await post(admin, body({ category: 'PARTY' })).expect(400);
      await post(admin, body({ state: 'Atlantis' })).expect(400);
      await post(admin, body({ startsAt: 'tomorrow' })).expect(400);
      await post(admin, body({ registrationUrl: 'http://insecure.example.com' })).expect(400);
      await post(admin, body({ meetingUrl: 'javascript:alert(1)' })).expect(400);
      await post(admin, body({ startsAt: undefined })).expect(400);
    });

    it('rejects fields it does not know, such as setting its own status or count', async () => {
      await post(admin, body({ status: 'PUBLISHED' })).expect(400);
      await post(admin, body({ rsvpCount: 500 })).expect(400);
      await post(admin, body({ createdById: corper.id })).expect(400);
    });

    it('checks the times', async () => {
      const past = inDays(-1).toISOString();
      await post(admin, body({ startsAt: past, endsAt: inDays(1).toISOString() })).expect(400);
      await post(admin, body({ endsAt: inDays(6).toISOString() })).expect(400);
      await post(admin, body({ endsAt: inDays(60).toISOString() })).expect(400);
    });

    it('needs a state for physical and hybrid events, but not virtual ones', async () => {
      await post(admin, body({ state: undefined })).expect(400);
      await post(admin, body({ state: undefined, format: 'HYBRID' })).expect(400);
      await post(admin, body({ state: undefined, format: 'VIRTUAL', meetingUrl: 'https://meet.example.com/abc' })).expect(201);
    });

    it('only accepts cover images from our own event folder', async () => {
      await post(admin, body({ coverImageUrl: 'https://evil.example.com/cover.jpg' })).expect(400);
      await post(admin, body({ coverImageUrl: cloudinaryUrl('posts') })).expect(400);
      const ok = await post(admin, body({ coverImageUrl: cloudinaryUrl('events') })).expect(201);
      expect(ok.body.coverImageUrl).toBe(cloudinaryUrl('events'));
    });
  });

  describe('visibility', () => {
    let pending: string;
    let live: string;

    beforeAll(async () => {
      pending = (await post(corper, body({ title: 'Pending visibility event' })).expect(201)).body.id;
      live = await publish(corper, { title: 'Live visibility event' });
    });

    it('keeps pending events out of the public list and hides them from others', async () => {
      const res = await list(viewer, '?q=visibility').expect(200);
      const ids = res.body.events.map((e: { id: string }) => e.id);

      expect(ids).toContain(live);
      expect(ids).not.toContain(pending);

      await get(viewer, pending).expect(404);
      await get(other, pending).expect(404);
    });

    it('shows a pending event to its creator and to an admin', async () => {
      expect((await get(corper, pending).expect(200)).body.status).toBe('PENDING');
      expect((await get(admin, pending).expect(200)).body.status).toBe('PENDING');
    });

    it('lists the creator\'s own events in every status under /mine', async () => {
      const res = await ctx.http().get('/api/v1/events/mine').set(auth(corper)).expect(200);
      const ids = res.body.events.map((e: { id: string }) => e.id);

      expect(ids).toEqual(expect.arrayContaining([pending, live]));
      expect(res.body).toHaveProperty('nextCursor');

      const onlyPending = await ctx.http().get('/api/v1/events/mine?status=PENDING').set(auth(corper)).expect(200);
      expect(onlyPending.body.events.every((e: { status: string }) => e.status === 'PENDING')).toBe(true);
    });

    it('never shows review details or the creator\'s email', async () => {
      const res = await get(viewer, live).expect(200);

      for (const key of ['reviewedBy', 'reviewedAt', 'removedBy', 'rejectionReason', 'removedReason']) {
        expect(res.body).not.toHaveProperty(key);
      }

      expect(res.body.isMine).toBe(false);
      expect(res.body.createdBy).not.toHaveProperty('email');
    });

    it('hides events from an organizer who has blocked the viewer, and from a deactivated one', async () => {
      const blocker = await ctx.makeUser({ role: UserRole.ADMIN });
      const blocked = await ctx.makeUser({ role: UserRole.EX_CORPER });
      const id = (await post(blocker, body({ title: 'Blocker only event' })).expect(201)).body.id;

      await ctx.http().post(`/api/v1/users/${blocker.id}/block`).set(auth(blocked)).expect(201);
      expect((await list(blocked, '?q=Blocker%20only').expect(200)).body.events).toHaveLength(0);
      await get(blocked, id).expect(404);

      const gone = await ctx.makeUser({ role: UserRole.ADMIN });
      await post(gone, body({ title: 'Deactivated organizer event' })).expect(201);
      await ctx.prisma.user.update({ where: { id: gone.id }, data: { isActive: false } });
      expect((await list(viewer, '?q=Deactivated%20organizer').expect(200)).body.events).toHaveLength(0);
    });
  });

  describe('listing, filters and paging', () => {
    beforeAll(async () => {
      await post(admin, body({ title: 'Tech talk in Lagos', category: 'TECH', state: 'Lagos', startsAt: inDays(3).toISOString(), endsAt: inDays(3.1).toISOString() })).expect(201);
      await post(admin, body({ title: 'Virtual career clinic', category: 'CAREER', format: 'VIRTUAL', state: undefined, startsAt: inDays(5).toISOString(), endsAt: inDays(5.1).toISOString() })).expect(201);
      await createPastEvent({ title: 'Old networking night', category: 'NETWORKING' });
    });

    it('lists upcoming events soonest first by default, without past ones', async () => {
      const res = await list(viewer).expect(200);
      const events = res.body.events as { startsAt: string; title: string }[];

      expect(events.length).toBeGreaterThan(2);
      expect(events.map((e) => e.title)).not.toContain('Old networking night');

      const times = events.map((e) => new Date(e.startsAt).getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('lists past events most recent first, and all events together', async () => {
      const past = await list(viewer, '?when=past').expect(200);
      expect(past.body.events.map((e: { title: string }) => e.title)).toEqual(['Old networking night']);

      const all = await list(viewer, '?when=all&pageSize=50').expect(200);
      const times = all.body.events.map((e: { startsAt: string }) => new Date(e.startsAt).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
      expect(all.body.events.map((e: { title: string }) => e.title)).toContain('Old networking night');
    });

    it('filters by category, state, format and search text', async () => {
      expect((await list(viewer, '?category=TECH').expect(200)).body.events).toHaveLength(1);
      expect((await list(viewer, '?state=lagos').expect(200)).body.events.map((e: { title: string }) => e.title)).toEqual(['Tech talk in Lagos']);
      const virtual = (await list(viewer, '?format=VIRTUAL').expect(200)).body.events;
      expect(virtual.length).toBeGreaterThan(0);
      expect(virtual.every((e: { format: string }) => e.format === 'VIRTUAL')).toBe(true);
      expect(virtual.map((e: { title: string }) => e.title)).toContain('Virtual career clinic');
      expect((await list(viewer, '?q=clinic').expect(200)).body.events).toHaveLength(1);
    });

    it('rejects unknown values and parameters', async () => {
      await list(viewer, '?when=tomorrow').expect(400);
      await list(viewer, '?category=PARTY').expect(400);
      await list(viewer, '?state=Atlantis').expect(400);
      await list(viewer, '?cursor=garbage').expect(400);
      await list(viewer, '?sort=popular').expect(400);
    });

    it('pages both directions without repeating or skipping a row', async () => {
      for (const when of ['upcoming', 'all']) {
        const seen: string[] = [];
        let cursor: string | null = null;

        for (let i = 0; i < 30; i += 1) {
          const res: { body: { events: { id: string }[]; nextCursor: string | null } } = await list(
            viewer,
            `?when=${when}&pageSize=2${cursor ? `&cursor=${cursor}` : ''}`,
          ).expect(200);

          seen.push(...res.body.events.map((e) => e.id));
          cursor = res.body.nextCursor;

          if (!cursor) {
            break;
          }
        }

        const everything = await list(viewer, `?when=${when}&pageSize=50`).expect(200);
        expect(everything.body.nextCursor).toBeNull();
        expect(seen).toEqual(everything.body.events.map((e: { id: string }) => e.id));
        expect(seen.length).toBeGreaterThan(2);
      }
    });
  });

  describe('RSVP', () => {
    let eventId: string;

    beforeAll(async () => {
      eventId = await publish(recruiter, { title: 'RSVP event' });
    });

    it('records an RSVP, counts it and shows the viewer their own answer', async () => {
      const res = await ctx.http().post(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer)).expect(201);
      expect(res.body).toEqual({ going: true, rsvpCount: 1 });

      const mine = await get(viewer, eventId).expect(200);
      expect(mine.body.viewerRsvp).toBe(true);
      expect(mine.body.rsvpCount).toBe(1);

      const someoneElse = await get(other, eventId).expect(200);
      expect(someoneElse.body.viewerRsvp).toBe(false);
      expect(someoneElse.body.rsvpCount).toBe(1);

      const inList = await list(viewer, '?q=RSVP%20event').expect(200);
      expect(inList.body.events[0].viewerRsvp).toBe(true);
      expect(inList.body.events[0].rsvpCount).toBe(1);
    });

    it('does not count the same person twice', async () => {
      await ctx.http().post(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer)).expect(409);
      expect((await get(viewer, eventId)).body.rsvpCount).toBe(1);
    });

    it('lists the events I am going to', async () => {
      const res = await ctx.http().get('/api/v1/events/going').set(auth(viewer)).expect(200);
      expect(res.body.events.map((e: { id: string }) => e.id)).toEqual([eventId]);
      expect(res.body.events[0].viewerRsvp).toBe(true);

      const none = await ctx.http().get('/api/v1/events/going').set(auth(other)).expect(200);
      expect(none.body.events).toEqual([]);
    });

    it('cancels an RSVP, and cancelling again changes nothing', async () => {
      const first = await ctx.http().delete(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer)).expect(200);
      expect(first.body).toEqual({ going: false, rsvpCount: 0 });

      const second = await ctx.http().delete(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer)).expect(200);
      expect(second.body).toEqual({ going: false, rsvpCount: 0 });
    });

    it('keeps the count right when the same person taps many times at once', async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => ctx.http().post(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer))),
      );

      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
      expect((await get(viewer, eventId)).body.rsvpCount).toBe(1);
      await ctx.http().delete(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer)).expect(200);
    });

    it('keeps the count right when many people RSVP at once, and when they leave at once', async () => {
      const crowd = await Promise.all(Array.from({ length: 10 }, () => ctx.makeUser()));

      const joined = await Promise.all(
        crowd.map((u) => ctx.http().post(`/api/v1/events/${eventId}/rsvp`).set(auth(u))),
      );
      expect(joined.every((r) => r.status === 201)).toBe(true);
      expect(await ctx.prisma.eventRsvp.count({ where: { eventId } })).toBe(10);
      expect((await get(viewer, eventId)).body.rsvpCount).toBe(10);

      await Promise.all(crowd.map((u) => ctx.http().delete(`/api/v1/events/${eventId}/rsvp`).set(auth(u))));
      expect(await ctx.prisma.eventRsvp.count({ where: { eventId } })).toBe(0);
      expect((await get(viewer, eventId)).body.rsvpCount).toBe(0);
    });

    it('does not allow RSVPs to hidden, finished or missing events', async () => {
      const pending = (await post(corper, body({ title: 'Pending no rsvp' })).expect(201)).body.id;
      await ctx.http().post(`/api/v1/events/${pending}/rsvp`).set(auth(viewer)).expect(404);

      const past = await createPastEvent();
      await ctx.http().post(`/api/v1/events/${past.id}/rsvp`).set(auth(viewer)).expect(409);

      await ctx.http().post('/api/v1/events/nope/rsvp').set(auth(viewer)).expect(404);
      await ctx.http().delete('/api/v1/events/nope/rsvp').set(auth(viewer)).expect(404);
    });

    it('shows the full attendee list to the organizer and admins only', async () => {
      await ctx.http().post(`/api/v1/events/${eventId}/rsvp`).set(auth(viewer)).expect(201);
      await ctx.http().post(`/api/v1/events/${eventId}/rsvp`).set(auth(other)).expect(201);

      await ctx.http().get(`/api/v1/events/${eventId}/attendees`).set(auth(viewer)).expect(403);
      await ctx.http().get(`/api/v1/events/${eventId}/attendees`).set(auth(corper)).expect(403);

      const asOrganizer = await ctx.http().get(`/api/v1/events/${eventId}/attendees`).set(auth(recruiter)).expect(200);
      expect(asOrganizer.body.total).toBe(2);
      expect(asOrganizer.body.attendees.map((a: { user: { username: string } }) => a.user.username).sort()).toEqual(
        [viewer.username, other.username].sort(),
      );
      expect(asOrganizer.body.attendees[0]).toHaveProperty('rsvpAt');
      expect(asOrganizer.body.attendees[0].user).not.toHaveProperty('email');

      await ctx.http().get(`/api/v1/events/${eventId}/attendees`).set(auth(admin)).expect(200);

      const paged = await ctx.http().get(`/api/v1/events/${eventId}/attendees?pageSize=1`).set(auth(admin)).expect(200);
      expect(paged.body.attendees).toHaveLength(1);
      expect(paged.body.nextCursor).not.toBeNull();
    });

    it('never puts the attendee list in the public event', async () => {
      const res = await get(corper, eventId).expect(200);
      expect(res.body).not.toHaveProperty('rsvps');
      expect(res.body).not.toHaveProperty('attendees');
    });
  });

  describe('approval', () => {
    it('is an admin-only queue', async () => {
      await ctx.http().get('/api/v1/admin/events?status=PENDING').set(auth(corper)).expect(403);

      const res = await ctx.http().get('/api/v1/admin/events?status=PENDING').set(auth(admin)).expect(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      expect(res.body.events.every((e: { status: string }) => e.status === 'PENDING')).toBe(true);
      expect(res.body.events[0].createdBy).toHaveProperty('email');
    });

    it('approves, publishes, tells the organizer and writes the audit log', async () => {
      const id = (await post(corper, body({ title: 'To be approved' })).expect(201)).body.id;
      const res = await decide(id, { decision: 'APPROVE' }).expect(200);

      expect(res.body.status).toBe('PUBLISHED');
      expect((await get(viewer, id).expect(200)).body.status).toBe('PUBLISHED');

      const note = await ctx.prisma.notification.findFirst({ where: { recipientId: corper.id, eventId: id } });
      expect(note?.type).toBe(NotificationType.EVENT_APPROVED);

      const audit = await ctx.prisma.auditLog.findFirst({ where: { targetId: id, action: 'EVENT_APPROVED' } });
      expect(audit?.adminId).toBe(admin.id);
    });

    it('cannot decide the same event twice', async () => {
      const id = (await post(corper, body({ title: 'Decided once' })).expect(201)).body.id;
      const [a, b] = await Promise.all([decide(id, { decision: 'APPROVE' }), decide(id, { decision: 'APPROVE' })]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });

    it('needs a reason to reject, and shows it to the organizer only', async () => {
      const id = (await post(corper, body({ title: 'To be rejected' })).expect(201)).body.id;

      await decide(id, { decision: 'REJECT' }).expect(400);
      await decide(id, { decision: 'REJECT', reason: 'Not an NYSC related event' }).expect(200);

      const mine = await get(corper, id).expect(200);
      expect(mine.body.status).toBe('REJECTED');
      expect(mine.body.rejectionReason).toBe('Not an NYSC related event');

      await get(viewer, id).expect(404);

      const note = await ctx.prisma.notification.findFirst({ where: { recipientId: corper.id, eventId: id } });
      expect(note?.type).toBe(NotificationType.EVENT_REJECTED);
    });

    it('will not approve an event that has already ended', async () => {
      const past = await createPastEvent({ status: EventStatus.PENDING, createdById: corper.id });
      await decide(past.id, { decision: 'APPROVE' }).expect(409);
      await decide(past.id, { decision: 'REJECT', reason: 'Already over' }).expect(200);
    });

    it('does not decide something that is not pending', async () => {
      const id = await publish(admin, { title: 'Already live' });
      await decide(id, { decision: 'APPROVE' }).expect(409);
      await decide('nope', { decision: 'APPROVE' }).expect(404);
    });
  });

  describe('editing', () => {
    it('sends an edited, live event back for review', async () => {
      const id = await publish(corper, { title: 'Edit me' });
      const res = await ctx.http().patch(`/api/v1/events/${id}`).set(auth(corper)).send({ title: 'Edited title' }).expect(200);

      expect(res.body.title).toBe('Edited title');
      expect(res.body.status).toBe('PENDING');
      await get(viewer, id).expect(404);
    });

    it('does the same for recruiters and businesses', async () => {
      for (const user of [recruiter, business]) {
        const id = await publish(user, { title: `Edit ${user.username}` });
        const res = await ctx.http().patch(`/api/v1/events/${id}`).set(auth(user)).send({ venue: 'New venue' }).expect(200);
        expect(res.body.status).toBe('PENDING');
      }
    });

    it('lets a rejected event be corrected and resubmitted', async () => {
      const id = (await post(corper, body({ title: 'Fix me' })).expect(201)).body.id;
      await decide(id, { decision: 'REJECT', reason: 'Add a venue' }).expect(200);

      const res = await ctx.http().patch(`/api/v1/events/${id}`).set(auth(corper)).send({ venue: 'Now with a venue' }).expect(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.rejectionReason).toBeNull();
    });

    it('does not re-queue an admin\'s edit', async () => {
      const id = await publish(corper, { title: 'Admin edits this' });
      const res = await ctx.http().patch(`/api/v1/events/${id}`).set(auth(admin)).send({ title: 'Fixed by admin' }).expect(200);
      expect(res.body.status).toBe('PUBLISHED');
    });

    it('only lets the organizer (or an admin) edit', async () => {
      const id = await publish(recruiter, { title: 'Not yours' });
      await ctx.http().patch(`/api/v1/events/${id}`).set(auth(corper)).send({ title: 'Hijack' }).expect(403);

      const hidden = (await post(corper, body({ title: 'Hidden edit' })).expect(201)).body.id;
      await ctx.http().patch(`/api/v1/events/${hidden}`).set(auth(other)).send({ title: 'Hijack' }).expect(404);
    });

    it('keeps the time rules when editing', async () => {
      const id = (await post(admin, body({ title: 'Time rules' })).expect(201)).body.id;
      const patch = (data: Record<string, unknown>) =>
        ctx.http().patch(`/api/v1/events/${id}`).set(auth(admin)).send(data);

      await patch({ startsAt: inDays(-2).toISOString() }).expect(400);
      await patch({ endsAt: inDays(1).toISOString() }).expect(400);
      await patch({ startsAt: inDays(9).toISOString(), endsAt: inDays(9.1).toISOString() }).expect(200);
    });

    it('keeps the place rule when switching format', async () => {
      const id = (await post(admin, body({ title: 'Place rules', format: 'VIRTUAL', state: undefined })).expect(201)).body.id;
      const patch = (data: Record<string, unknown>) =>
        ctx.http().patch(`/api/v1/events/${id}`).set(auth(admin)).send(data);

      await patch({ format: 'PHYSICAL' }).expect(400);
      await patch({ format: 'PHYSICAL', state: 'Oyo' }).expect(200);
      await patch({ state: null }).expect(400);
    });

    it('clears an optional field with null, and rejects empty or unknown input', async () => {
      const id = (await post(admin, body({ title: 'Clear me', venue: 'Somewhere' })).expect(201)).body.id;
      const patch = (data: Record<string, unknown>) =>
        ctx.http().patch(`/api/v1/events/${id}`).set(auth(admin)).send(data);

      expect((await patch({ venue: null }).expect(200)).body.venue).toBeNull();
      await patch({}).expect(400);
      await patch({ title: null }).expect(400);
      await patch({ status: 'PUBLISHED' }).expect(400);
    });

    it('cannot change an event that was cancelled or removed', async () => {
      const id = await publish(corper, { title: 'Cancel then edit' });
      await ctx.http().post(`/api/v1/events/${id}/cancel`).set(auth(corper)).send({}).expect(201);
      await ctx.http().patch(`/api/v1/events/${id}`).set(auth(corper)).send({ title: 'Too late' }).expect(409);

      const removed = await publish(corper, { title: 'Remove then edit' });
      await ctx.http().patch(`/api/v1/admin/events/${removed}/remove`).set(auth(admin)).send({ reason: 'Not allowed' }).expect(200);
      await ctx.http().patch(`/api/v1/events/${removed}`).set(auth(corper)).send({ title: 'Sneaky' }).expect(403);
    });
  });

  describe('cancelling and deleting', () => {
    it('cancels a live event, tells everyone going and keeps the link working', async () => {
      const id = await publish(recruiter, { title: 'Will be cancelled' });
      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(viewer)).expect(201);
      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(other)).expect(201);

      await ctx.http().post(`/api/v1/events/${id}/cancel`).set(auth(corper)).send({}).expect(403);

      const res = await ctx.http().post(`/api/v1/events/${id}/cancel`).set(auth(recruiter)).send({ reason: 'Venue unavailable' }).expect(201);
      expect(res.body.status).toBe('CANCELLED');

      const notes = await ctx.prisma.notification.findMany({ where: { eventId: id, type: NotificationType.EVENT_CANCELLED } });
      expect(notes.map((n) => n.recipientId).sort()).toEqual([viewer.id, other.id].sort());
      expect(notes[0].message).toContain('Venue unavailable');

      expect((await get(viewer, id).expect(200)).body.status).toBe('CANCELLED');
      expect((await list(viewer, '?q=Will%20be%20cancelled').expect(200)).body.events).toHaveLength(0);

      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(corper)).expect(409);
      await ctx.http().post(`/api/v1/events/${id}/cancel`).set(auth(recruiter)).send({}).expect(409);

      // Still in the list of events the attendee said they were going to.
      const going = await ctx.http().get('/api/v1/events/going').set(auth(viewer)).expect(200);
      expect(going.body.events.map((e: { id: string }) => e.id)).toContain(id);
    });

    it('cannot cancel an event that is not live or has ended', async () => {
      const pending = (await post(corper, body({ title: 'Pending cancel' })).expect(201)).body.id;
      await ctx.http().post(`/api/v1/events/${pending}/cancel`).set(auth(corper)).send({}).expect(409);

      const past = await createPastEvent({ createdById: corper.id });
      await ctx.http().post(`/api/v1/events/${past.id}/cancel`).set(auth(corper)).send({}).expect(409);
    });

    it('deletes unpublished and cancelled events, but not live ones', async () => {
      const pending = (await post(corper, body({ title: 'Delete pending' })).expect(201)).body.id;
      await ctx.http().delete(`/api/v1/events/${pending}`).set(auth(other)).expect(404);
      await ctx.http().delete(`/api/v1/events/${pending}`).set(auth(corper)).expect(200);
      await get(admin, pending).expect(404);

      const live = await publish(corper, { title: 'Delete live' });
      await ctx.http().delete(`/api/v1/events/${live}`).set(auth(corper)).expect(409);

      await ctx.http().post(`/api/v1/events/${live}/cancel`).set(auth(corper)).send({}).expect(201);
      await ctx.http().delete(`/api/v1/events/${live}`).set(auth(corper)).expect(200);
    });

    it('removes the RSVPs with the event', async () => {
      const id = (await post(corper, body({ title: 'Delete with rsvps' })).expect(201)).body.id;
      await decide(id, { decision: 'APPROVE' }).expect(200);
      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(viewer)).expect(201);
      await ctx.http().post(`/api/v1/events/${id}/cancel`).set(auth(corper)).send({}).expect(201);
      await ctx.http().delete(`/api/v1/events/${id}`).set(auth(corper)).expect(200);

      expect(await ctx.prisma.eventRsvp.count({ where: { eventId: id } })).toBe(0);
    });
  });

  describe('moderation', () => {
    it('removes a live event, tells the organizer and the people going, and can restore it', async () => {
      const id = await publish(corper, { title: 'Removable event' });
      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(viewer)).expect(201);

      await ctx.http().patch(`/api/v1/admin/events/${id}/remove`).set(auth(corper)).send({ reason: 'x' }).expect(403);
      await ctx.http().patch(`/api/v1/admin/events/${id}/remove`).set(auth(admin)).send({}).expect(400);
      await ctx.http().patch(`/api/v1/admin/events/${id}/remove`).set(auth(admin)).send({ reason: 'Misleading event' }).expect(200);
      await ctx.http().patch(`/api/v1/admin/events/${id}/remove`).set(auth(admin)).send({ reason: 'Misleading event' }).expect(409);

      await get(other, id).expect(404);
      const owner = await get(corper, id).expect(200);
      expect(owner.body.status).toBe('REMOVED');
      expect(owner.body.removedReason).toBe('Misleading event');
      await ctx.http().delete(`/api/v1/events/${id}`).set(auth(corper)).expect(403);

      const toOrganizer = await ctx.prisma.notification.findFirst({ where: { recipientId: corper.id, eventId: id, type: NotificationType.CONTENT_REMOVED } });
      expect(toOrganizer?.message).toContain('Misleading event');
      const toAttendee = await ctx.prisma.notification.findFirst({ where: { recipientId: viewer.id, eventId: id } });
      expect(toAttendee?.type).toBe(NotificationType.EVENT_CANCELLED);

      const audit = await ctx.prisma.auditLog.findFirst({ where: { targetId: id, action: 'EVENT_REMOVED' } });
      expect(audit?.reason).toBe('Misleading event');

      await ctx.http().patch(`/api/v1/admin/events/${id}/restore`).set(auth(admin)).send({}).expect(200);
      expect((await get(other, id).expect(200)).body.status).toBe('PUBLISHED');
      await ctx.http().patch(`/api/v1/admin/events/${id}/restore`).set(auth(admin)).send({}).expect(404);
    });

    it('lets a user report a live event, and an admin remove it from the report', async () => {
      const id = await publish(corper, { title: 'Reportable event' });

      const report = await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'EVENT', targetId: id, reason: 'Fake event' }).expect(201);
      await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'EVENT', targetId: id, reason: 'Again' }).expect(409);
      await ctx.http().post('/api/v1/reports').set(auth(corper)).send({ targetType: 'EVENT', targetId: id, reason: 'Mine' }).expect(400);

      const queue = await ctx.http().get('/api/v1/admin/reports?targetType=EVENT').set(auth(admin)).expect(200);
      const entry = queue.body.reports.find((r: { id: string }) => r.id === report.body.id);
      expect(entry.targetExists).toBe(true);
      expect(entry.target.title).toBe('Reportable event');

      await ctx.http().patch(`/api/v1/admin/reports/${report.body.id}/decision`).set(auth(admin)).send({ status: 'REVIEWED', action: 'REMOVE_CONTENT', note: 'Confirmed' }).expect(200);
      expect((await ctx.prisma.event.findUnique({ where: { id } }))?.status).toBe('REMOVED');
    });

    it('does not let anyone report an event that is not public', async () => {
      const id = (await post(corper, body({ title: 'Pending report' })).expect(201)).body.id;
      await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'EVENT', targetId: id, reason: 'Probe' }).expect(404);
    });
  });

  describe('deleting an account', () => {
    it('takes the person\'s RSVPs off the count of other people\'s events', async () => {
      const leaver = await ctx.makeUser({ passwordHash: await argon2.hash('Passw0rd!Passw0rd') });
      const id = await publish(admin, { title: 'Leaver RSVP event' });

      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(leaver)).expect(201);
      await ctx.http().post(`/api/v1/events/${id}/rsvp`).set(auth(viewer)).expect(201);
      expect((await get(admin, id)).body.rsvpCount).toBe(2);

      await ctx.http().delete('/api/v1/users/me').set(auth(leaver)).send({ password: 'Passw0rd!Passw0rd' }).expect(200);

      expect((await get(admin, id)).body.rsvpCount).toBe(1);
      expect(await ctx.prisma.eventRsvp.count({ where: { eventId: id } })).toBe(1);
    });

    it('deletes the person\'s own events with the account', async () => {
      const leaver = await ctx.makeUser({ role: UserRole.RECRUITER, passwordHash: await argon2.hash('Passw0rd!Passw0rd') });
      const id = await publish(leaver, { title: 'Leaver own event' });

      await ctx.http().delete('/api/v1/users/me').set(auth(leaver)).send({ password: 'Passw0rd!Passw0rd' }).expect(200);
      await get(admin, id).expect(404);
    });
  });
});
