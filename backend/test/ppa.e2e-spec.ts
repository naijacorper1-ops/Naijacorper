import { NotificationType, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { TestContext, TestUser, auth, createContext } from './helpers';

const review = (over: Record<string, unknown> = {}) => ({
  name: 'Paystack',
  state: 'Lagos',
  overallRating: 5,
  environment: 'EXCELLENT',
  learning: 'HIGH',
  workload: 'MODERATE',
  staffRelationship: 'GOOD',
  content: 'Great place to serve. I learned a lot about building payment systems.',
  ...over,
});

describe('PPA reviews', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let viewer: TestUser;
  let recruiter: TestUser;
  let paystackId: string;

  beforeAll(async () => {
    ctx = await createContext();
    await ctx.reset();
    admin = await ctx.makeUser({ role: UserRole.ADMIN });
    alice = await ctx.makeUser({ role: UserRole.SERVING_CORPER });
    bob = await ctx.makeUser({ role: UserRole.EX_CORPER });
    viewer = await ctx.makeUser({ role: UserRole.PROSPECTIVE_CORPER, isVerified: false });
    recruiter = await ctx.makeUser({ role: UserRole.RECRUITER });
  });

  afterAll(async () => {
    await ctx.close();
  });

  const submit = (user: TestUser, data: Record<string, unknown> = review()) =>
    ctx.http().post('/api/v1/ppas/reviews').set(auth(user)).send(data);

  const getPpa = (user: TestUser, id: string) => ctx.http().get(`/api/v1/ppas/${id}`).set(auth(user));

  const reviewsOf = (user: TestUser, id: string, query = '') =>
    ctx.http().get(`/api/v1/ppas/${id}/reviews${query}`).set(auth(user));

  // The totals must always equal what the review rows add up to.
  const expectTotalsMatchRows = async (ppaId: string) => {
    const rows = await ctx.prisma.ppaReview.findMany({ where: { ppaId } });
    const ppa = await ctx.prisma.ppa.findUniqueOrThrow({ where: { id: ppaId } });
    const rate = { POOR: 1, FAIR: 2, GOOD: 3, EXCELLENT: 4 } as Record<string, number>;
    const level = { LOW: 1, MODERATE: 2, HIGH: 3 } as Record<string, number>;
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((n, r) => n + f(r), 0);

    expect(ppa.reviewCount).toBe(rows.length);
    expect(ppa.ratingSum).toBe(sum((r) => r.overallRating));
    expect(ppa.environmentSum).toBe(sum((r) => rate[r.environment]));
    expect(ppa.learningSum).toBe(sum((r) => level[r.learning]));
    expect(ppa.workloadSum).toBe(sum((r) => level[r.workload]));
    expect(ppa.staffSum).toBe(sum((r) => rate[r.staffRelationship]));
    expect(ppa.lastReviewedAt?.getTime() ?? null).toBe(
      rows.length ? Math.max(...rows.map((r) => r.createdAt.getTime())) : null,
    );
  };

  describe('who may review', () => {
    it('needs a login', async () => {
      await ctx.http().post('/api/v1/ppas/reviews').send(review()).expect(401);
      await ctx.http().get('/api/v1/ppas').expect(401);
    });

    it('refuses everyone except verified serving and ex corps members', async () => {
      for (const user of [viewer, recruiter, admin]) {
        const res = await submit(user).expect(403);
        expect(res.body.code).toBe('ROLE_NOT_ALLOWED');
      }
    });

    it('refuses an unverified email and a missing NYSC verification', async () => {
      const noEmail = await ctx.makeUser({ emailVerified: false });
      const noNysc = await ctx.makeUser({ isVerified: false });

      expect((await submit(noEmail).expect(403)).body.code).toBe('EMAIL_NOT_VERIFIED');
      expect((await submit(noNysc).expect(403)).body.code).toBe('VERIFICATION_REQUIRED');
    });

    it('creates nothing when it refuses', async () => {
      expect(await ctx.prisma.ppa.count()).toBe(0);
    });
  });

  describe('validation', () => {
    it('rejects bad input with a 400', async () => {
      await submit(alice, review({ overallRating: 0 })).expect(400);
      await submit(alice, review({ overallRating: 6 })).expect(400);
      await submit(alice, review({ overallRating: 3.5 })).expect(400);
      await submit(alice, review({ environment: 'AMAZING' })).expect(400);
      await submit(alice, review({ learning: 'EXCELLENT' })).expect(400);
      await submit(alice, review({ content: 'Too short' })).expect(400);
      await submit(alice, review({ state: 'Atlantis' })).expect(400);
      await submit(alice, review({ sector: 'SPACE' })).expect(400);
      await submit(alice, review({ isAnonymous: 'yes' })).expect(400);
      await submit(alice, review({ environment: undefined })).expect(400);
    });

    it('needs either ppaId, or name and state, and not both', async () => {
      await submit(alice, review({ name: undefined, state: undefined })).expect(400);
      await submit(alice, review({ state: undefined })).expect(400);
      await submit(alice, review({ name: undefined })).expect(400);
      await submit(alice, review({ name: '???' })).expect(400);

      const ppa = await ctx.prisma.ppa.create({ data: { name: 'Both', nameKey: 'both', state: 'Oyo' } });
      await submit(alice, review({ ppaId: ppa.id })).expect(400);
      await submit(alice, review({ ppaId: 'not-a-uuid', name: undefined, state: undefined })).expect(400);
      await submit(alice, review({ ppaId: '00000000-0000-4000-8000-000000000000', name: undefined, state: undefined })).expect(404);
    });

    it('rejects fields it does not know, such as choosing the author or the totals', async () => {
      await submit(alice, review({ authorId: bob.id })).expect(400);
      await submit(alice, review({ reviewCount: 99 })).expect(400);
    });

    it('creates nothing when the input is bad', async () => {
      expect(await ctx.prisma.ppaReview.count()).toBe(0);
    });
  });

  describe('submitting and the totals', () => {
    it('creates the PPA with the first review and keeps the author hidden by default', async () => {
      const res = await submit(alice, review({ sector: 'TECHNOLOGY' })).expect(201);
      paystackId = res.body.ppaId;

      expect(res.body.isMine).toBe(true);
      expect(res.body.isAnonymous).toBe(true);
      expect(res.body.author).toBeNull();
      expect(res.body).not.toHaveProperty('authorId');
      expect(res.body.ppa).toMatchObject({ name: 'Paystack', state: 'Lagos', sector: 'TECHNOLOGY' });

      await expectTotalsMatchRows(paystackId);
    });

    it('uses the same PPA when the name is spelled differently', async () => {
      const res = await submit(bob, review({
        name: '  PAYSTACK   Ltd. ',
        overallRating: 4,
        environment: 'GOOD',
        learning: 'MODERATE',
        workload: 'HIGH',
        staffRelationship: 'FAIR',
      })).expect(201);

      expect(res.body.ppaId).toBe(paystackId);
      expect(await ctx.prisma.ppa.count()).toBe(2);
      await expectTotalsMatchRows(paystackId);
    });

    it('treats the same name in another state as another PPA', async () => {
      const other = await ctx.makeUser();
      const res = await submit(other, review({ state: 'Oyo' })).expect(201);
      expect(res.body.ppaId).not.toBe(paystackId);
    });

    it('computes the averages and words from the two reviews', async () => {
      const res = await getPpa(viewer, paystackId).expect(200);

      expect(res.body).toMatchObject({
        id: paystackId,
        name: 'Paystack',
        reviewCount: 2,
        rating: 4.5,
        environment: { average: 3.5, label: 'EXCELLENT' },
        learning: { average: 2.5, label: 'HIGH' },
        workload: { average: 2.5, label: 'HIGH' },
        staffRelationship: { average: 2.5, label: 'GOOD' },
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 },
        myReview: null,
      });
    });

    it('does not let one person review the same PPA twice', async () => {
      await submit(alice).expect(409);
      await submit(alice, review({ name: 'paystack limited' })).expect(409);
      expect((await getPpa(viewer, paystackId)).body.reviewCount).toBe(2);
    });

    it('shows a reviewer their own review on the PPA', async () => {
      const res = await getPpa(alice, paystackId).expect(200);
      expect(res.body.myReview.isMine).toBe(true);
      expect(res.body.myReview.overallRating).toBe(5);
    });

    it('keeps the totals right when many people review a brand new PPA at the same moment', async () => {
      const crowd = await Promise.all(Array.from({ length: 8 }, () => ctx.makeUser()));
      const results = await Promise.all(
        crowd.map((u, i) => submit(u, review({ name: 'Concurrent Co', state: 'Ogun', overallRating: (i % 5) + 1 }))),
      );

      expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));

      const ppas = await ctx.prisma.ppa.findMany({ where: { nameKey: 'concurrentco' } });
      expect(ppas).toHaveLength(1);
      expect(ppas[0].reviewCount).toBe(8);
      await expectTotalsMatchRows(ppas[0].id);
    });

    it('keeps the totals right when reviews are added and removed at the same moment', async () => {
      const ppa = (await ctx.prisma.ppa.findFirstOrThrow({ where: { nameKey: 'concurrentco' } })).id;
      const existing = await ctx.prisma.ppaReview.findMany({ where: { ppaId: ppa }, take: 3 });
      const newcomers = await Promise.all(Array.from({ length: 3 }, () => ctx.makeUser()));

      const adds = newcomers.map((u) => submit(u, review({ ppaId: ppa, name: undefined, state: undefined, overallRating: 2 })));
      const removals = existing.map((r) =>
        ctx.http().delete(`/api/v1/admin/ppa-reviews/${r.id}`).set(auth(admin)).send({}),
      );

      const results = await Promise.all([...adds, ...removals]);
      expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
      await expectTotalsMatchRows(ppa);
    });
  });

  describe('browsing', () => {
    beforeAll(async () => {
      const a = await ctx.makeUser();
      const b = await ctx.makeUser();
      await submit(a, review({ name: 'Federal Hospital Abeokuta', state: 'Ogun', sector: 'HEALTHCARE', environment: 'FAIR', learning: 'LOW', workload: 'HIGH' })).expect(201);
      await submit(b, review({ name: 'Zenith Bank', state: 'Lagos', sector: 'BANKING_FINANCE' })).expect(201);
    });

    it('lists only PPAs that have reviews, most recently reviewed first, with one quote each', async () => {
      const empty = await ctx.prisma.ppa.create({ data: { name: 'Nobody Reviewed Me', nameKey: 'nobodyreviewedme', state: 'Kano' } });
      const res = await ctx.http().get('/api/v1/ppas?pageSize=50').set(auth(viewer)).expect(200);

      const ids = res.body.ppas.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(empty.id);
      expect(ids).toContain(paystackId);

      const times = res.body.ppas.map((p: { lastReviewedAt: string }) => new Date(p.lastReviewedAt).getTime());
      expect(times).toEqual([...times].sort((x, y) => y - x));

      const paystack = res.body.ppas.find((p: { id: string }) => p.id === paystackId);
      expect(paystack.reviewCount).toBe(2);
      expect(paystack.highlight.content).toContain('Great place to serve');
      expect(paystack).not.toHaveProperty('createdById');

      for (const ppa of res.body.ppas) {
        expect(ppa.reviewCount).toBeGreaterThan(0);
        expect(ppa.highlight).not.toBeNull();
      }
    });

    it('still opens a PPA that has no reviews by its id', async () => {
      const empty = await ctx.prisma.ppa.findFirstOrThrow({ where: { nameKey: 'nobodyreviewedme' } });
      const res = await getPpa(viewer, empty.id).expect(200);

      expect(res.body.reviewCount).toBe(0);
      expect(res.body.rating).toBeNull();
      expect(res.body.environment).toEqual({ average: null, label: null });
      expect((await reviewsOf(viewer, empty.id).expect(200)).body.reviews).toEqual([]);
    });

    it('gives a 404 for an unknown PPA', async () => {
      await getPpa(viewer, 'nope').expect(404);
      await reviewsOf(viewer, 'nope').expect(404);
    });

    it('searches by name, even when spelled a little differently', async () => {
      for (const q of ['paystack', 'PAY-STACK', 'zenith', 'hospital']) {
        const res = await ctx.http().get(`/api/v1/ppas?q=${encodeURIComponent(q)}`).set(auth(viewer)).expect(200);
        expect(res.body.ppas.length).toBeGreaterThan(0);
      }

      const none = await ctx.http().get('/api/v1/ppas?q=doesnotexist').set(auth(viewer)).expect(200);
      expect(none.body.ppas).toEqual([]);
    });

    it('filters by state and sector', async () => {
      const ogun = await ctx.http().get('/api/v1/ppas?state=ogun').set(auth(viewer)).expect(200);
      expect(ogun.body.ppas.every((p: { state: string }) => p.state === 'Ogun')).toBe(true);
      expect(ogun.body.ppas.length).toBeGreaterThan(0);

      const health = await ctx.http().get('/api/v1/ppas?sector=HEALTHCARE').set(auth(viewer)).expect(200);
      expect(health.body.ppas.map((p: { name: string }) => p.name)).toEqual(['Federal Hospital Abeokuta']);
      expect(health.body.ppas[0].learning.label).toBe('LOW');

      await ctx.http().get('/api/v1/ppas?sector=SPACE').set(auth(viewer)).expect(400);
      await ctx.http().get('/api/v1/ppas?state=Atlantis').set(auth(viewer)).expect(400);
      await ctx.http().get('/api/v1/ppas?sort=best').set(auth(viewer)).expect(400);
    });

    it('pages with a cursor without repeating or skipping a PPA', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;

      for (let i = 0; i < 20; i += 1) {
        const res: { body: { ppas: { id: string }[]; nextCursor: string | null } } = await ctx
          .http()
          .get(`/api/v1/ppas?pageSize=2${cursor ? `&cursor=${cursor}` : ''}`)
          .set(auth(viewer))
          .expect(200);

        seen.push(...res.body.ppas.map((p) => p.id));
        cursor = res.body.nextCursor;

        if (!cursor) {
          break;
        }
      }

      const everything = await ctx.http().get('/api/v1/ppas?pageSize=50').set(auth(viewer)).expect(200);
      expect(seen).toEqual(everything.body.ppas.map((p: { id: string }) => p.id));
      expect(seen.length).toBeGreaterThan(3);
      await ctx.http().get('/api/v1/ppas?cursor=garbage').set(auth(viewer)).expect(400);
    });

    it('suggests PPAs while typing, including ones without reviews', async () => {
      const res = await ctx.http().get('/api/v1/ppas/suggest?q=nobody').set(auth(alice)).expect(200);
      expect(res.body.ppas.map((p: { name: string }) => p.name)).toEqual(['Nobody Reviewed Me']);
      expect(res.body.ppas[0]).toMatchObject({ state: 'Kano', reviewCount: 0 });

      const byState = await ctx.http().get('/api/v1/ppas/suggest?q=paystack&state=Oyo').set(auth(alice)).expect(200);
      expect(byState.body.ppas).toHaveLength(1);
      expect(byState.body.ppas[0].state).toBe('Oyo');

      await ctx.http().get('/api/v1/ppas/suggest?q=a').set(auth(alice)).expect(400);
      await ctx.http().get('/api/v1/ppas/suggest').set(auth(alice)).expect(400);
    });
  });

  describe('anonymity', () => {
    it('never reveals an anonymous author to anyone else', async () => {
      const res = await reviewsOf(viewer, paystackId).expect(200);
      expect(res.body.reviews.length).toBe(2);

      for (const r of res.body.reviews) {
        expect(r.author).toBeNull();
        expect(r.isMine).toBe(false);
        expect(r).not.toHaveProperty('authorId');
      }

      // Nothing anywhere in the reply, public or admin-free, names them.
      const text = JSON.stringify([res.body, (await getPpa(viewer, paystackId)).body]);

      for (const person of [alice, bob]) {
        expect(text).not.toContain(person.id);
        expect(text).not.toContain(person.username);
      }
    });

    it('tells the author which review is theirs, still without a name', async () => {
      const res = await reviewsOf(alice, paystackId).expect(200);
      const mine = res.body.reviews.filter((r: { isMine: boolean }) => r.isMine);

      expect(mine).toHaveLength(1);
      expect(mine[0].author).toBeNull();
      expect(mine[0].overallRating).toBe(5);
    });

    it('shows the author only when they chose to be named', async () => {
      const mine = (await getPpa(alice, paystackId)).body.myReview;
      const named = await ctx.http().patch(`/api/v1/ppas/reviews/${mine.id}`).set(auth(alice)).send({ isAnonymous: false }).expect(200);
      expect(named.body.author.username).toBe(alice.username);
      expect(named.body.author).not.toHaveProperty('email');

      const seen = await reviewsOf(viewer, paystackId).expect(200);
      expect(seen.body.reviews.map((r: { author: { username: string } | null }) => r.author?.username)).toContain(alice.username);

      await ctx.http().patch(`/api/v1/ppas/reviews/${mine.id}`).set(auth(alice)).send({ isAnonymous: true }).expect(200);
      const hidden = await reviewsOf(viewer, paystackId).expect(200);
      expect(JSON.stringify(hidden.body)).not.toContain(alice.username);
    });

    it('hides a blocked person\'s named review, but not their anonymous one', async () => {
      const blocker = await ctx.makeUser();
      const blocked = await ctx.makeUser();
      const first = (await submit(blocked, review({ name: 'Block Test Co', state: 'Abia', isAnonymous: false })).expect(201)).body;
      const sibling = await ctx.makeUser();
      await submit(sibling, review({ ppaId: first.ppaId, name: undefined, state: undefined })).expect(201);

      const second = await ctx.makeUser();
      const anon = (await submit(second, review({ ppaId: first.ppaId, name: undefined, state: undefined })).expect(201)).body;

      await ctx.http().post(`/api/v1/users/${blocked.id}/block`).set(auth(blocker)).expect(201);
      let res = await reviewsOf(blocker, first.ppaId).expect(200);
      expect(res.body.reviews.map((r: { id: string }) => r.id)).not.toContain(first.id);
      expect(res.body.reviews.map((r: { id: string }) => r.id)).toContain(anon.id);

      // An anonymous review stays visible even if its author is blocked, otherwise it would give them away.
      await ctx.http().post(`/api/v1/users/${second.id}/block`).set(auth(blocker)).expect(201);
      res = await reviewsOf(blocker, first.ppaId).expect(200);
      expect(res.body.reviews.map((r: { id: string }) => r.id)).toContain(anon.id);
    });

    it('shows admins the author of an anonymous review', async () => {
      const list = await ctx.http().get(`/api/v1/admin/ppa-reviews?ppaId=${paystackId}`).set(auth(admin)).expect(200);
      const names = list.body.reviews.map((r: { author: { username: string } }) => r.author.username);

      expect(names).toEqual(expect.arrayContaining([alice.username, bob.username]));
      expect(list.body.reviews[0].author).toHaveProperty('email');
      expect(list.body.reviews[0].ppa.name).toBe('Paystack');

      await ctx.http().get('/api/v1/admin/ppa-reviews').set(auth(alice)).expect(403);
    });
  });

  describe('reading reviews', () => {
    it('lists reviews newest first with a cursor', async () => {
      const crowd = await Promise.all(Array.from({ length: 3 }, () => ctx.makeUser()));
      for (const u of crowd) {
        await submit(u, review({ ppaId: paystackId, name: undefined, state: undefined })).expect(201);
      }

      const page1 = await reviewsOf(viewer, paystackId, '?pageSize=2').expect(200);
      expect(page1.body.reviews).toHaveLength(2);
      expect(page1.body.nextCursor).not.toBeNull();

      const page2 = await reviewsOf(viewer, paystackId, `?pageSize=2&cursor=${page1.body.nextCursor}`).expect(200);
      const all = await reviewsOf(viewer, paystackId, '?pageSize=50').expect(200);

      expect([...page1.body.reviews, ...page2.body.reviews].slice(0, 4).map((r: { id: string }) => r.id)).toEqual(
        all.body.reviews.slice(0, 4).map((r: { id: string }) => r.id),
      );

      const times = all.body.reviews.map((r: { createdAt: string }) => new Date(r.createdAt).getTime());
      expect(times).toEqual([...times].sort((x, y) => y - x));
    });

    it('lists my own reviews under /reviews/mine, with the PPA', async () => {
      const res = await ctx.http().get('/api/v1/ppas/reviews/mine').set(auth(alice)).expect(200);

      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].ppa.name).toBe('Paystack');
      expect(res.body.reviews[0].isMine).toBe(true);

      const nobody = await ctx.http().get('/api/v1/ppas/reviews/mine').set(auth(viewer)).expect(200);
      expect(nobody.body.reviews).toEqual([]);
    });
  });

  describe('editing and deleting', () => {
    let ppaId: string;
    let reviewId: string;
    let writer: TestUser;

    beforeAll(async () => {
      writer = await ctx.makeUser();
      const res = await submit(writer, review({ name: 'Edit Test Co', state: 'Kogi', overallRating: 2, environment: 'POOR', learning: 'LOW', workload: 'LOW', staffRelationship: 'POOR' })).expect(201);
      ppaId = res.body.ppaId;
      reviewId = res.body.id;
    });

    it('recomputes the totals when the author edits', async () => {
      const res = await ctx
        .http()
        .patch(`/api/v1/ppas/reviews/${reviewId}`)
        .set(auth(writer))
        .send({ overallRating: 4, environment: 'GOOD', content: 'Changed my mind, the team was lovely to work with.' })
        .expect(200);

      expect(res.body.overallRating).toBe(4);
      expect(res.body.content).toContain('Changed my mind');

      const ppa = (await getPpa(viewer, ppaId)).body;
      expect(ppa.rating).toBe(4);
      expect(ppa.environment.label).toBe('GOOD');
      expect(ppa.learning.label).toBe('LOW');
      await expectTotalsMatchRows(ppaId);
    });

    it('does not move the PPA up the list when a review is only edited', async () => {
      const before = await ctx.prisma.ppa.findUniqueOrThrow({ where: { id: ppaId } });
      await ctx.http().patch(`/api/v1/ppas/reviews/${reviewId}`).set(auth(writer)).send({ overallRating: 3 }).expect(200);
      const after = await ctx.prisma.ppa.findUniqueOrThrow({ where: { id: ppaId } });

      expect(after.lastReviewedAt?.getTime()).toBe(before.lastReviewedAt?.getTime());
    });

    it('answers someone else\'s review with a 404, not a 403', async () => {
      await ctx.http().patch(`/api/v1/ppas/reviews/${reviewId}`).set(auth(bob)).send({ overallRating: 1 }).expect(404);
      await ctx.http().delete(`/api/v1/ppas/reviews/${reviewId}`).set(auth(bob)).expect(404);
      await ctx.http().patch('/api/v1/ppas/reviews/nope').set(auth(bob)).send({ overallRating: 1 }).expect(404);
      expect((await getPpa(viewer, ppaId)).body.reviewCount).toBe(1);
    });

    it('rejects empty edits, bad values and attempts to change the PPA or the author', async () => {
      const patch = (data: Record<string, unknown>) =>
        ctx.http().patch(`/api/v1/ppas/reviews/${reviewId}`).set(auth(writer)).send(data);

      await patch({}).expect(400);
      await patch({ overallRating: 9 }).expect(400);
      await patch({ content: 'short' }).expect(400);
      await patch({ ppaId: paystackId }).expect(400);
      await patch({ name: 'Other' }).expect(400);
      await patch({ authorId: bob.id }).expect(400);
    });

    it('stops a person who lost their verification from editing, but not from deleting', async () => {
      await ctx.prisma.user.update({ where: { id: writer.id }, data: { isVerified: false } });
      const res = await ctx.http().patch(`/api/v1/ppas/reviews/${reviewId}`).set(auth(writer)).send({ overallRating: 1 }).expect(403);
      expect(res.body.code).toBe('VERIFICATION_REQUIRED');
      await ctx.prisma.user.update({ where: { id: writer.id }, data: { isVerified: true } });
    });

    it('recomputes the totals when the author deletes, and lets them write a new one', async () => {
      await ctx.http().delete(`/api/v1/ppas/reviews/${reviewId}`).set(auth(writer)).expect(200);

      const ppa = (await getPpa(viewer, ppaId)).body;
      expect(ppa.reviewCount).toBe(0);
      expect(ppa.rating).toBeNull();
      await expectTotalsMatchRows(ppaId);

      const listed = await ctx.http().get('/api/v1/ppas?q=Edit%20Test').set(auth(viewer)).expect(200);
      expect(listed.body.ppas).toEqual([]);

      await submit(writer, review({ ppaId, name: undefined, state: undefined })).expect(201);
      expect((await getPpa(viewer, ppaId)).body.reviewCount).toBe(1);
    });
  });

  describe('moderation', () => {
    let ppaId: string;
    let writer: TestUser;
    let reviewId: string;

    beforeAll(async () => {
      writer = await ctx.makeUser();
      const res = await submit(writer, review({ name: 'Moderation Co', state: 'Edo', content: 'This place is a scam, do not come here at all.' })).expect(201);
      ppaId = res.body.ppaId;
      reviewId = res.body.id;
      await submit(await ctx.makeUser(), review({ ppaId, name: undefined, state: undefined })).expect(201);
    });

    it('lets a user report a review, with the author kept for admins only', async () => {
      const report = await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'PPA_REVIEW', targetId: reviewId, reason: 'Abusive' }).expect(201);
      await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'PPA_REVIEW', targetId: reviewId, reason: 'Again' }).expect(409);
      await ctx.http().post('/api/v1/reports').set(auth(writer)).send({ targetType: 'PPA_REVIEW', targetId: reviewId, reason: 'Mine' }).expect(400);
      await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'PPA_REVIEW', targetId: 'nope', reason: 'Missing' }).expect(404);

      const queue = await ctx.http().get('/api/v1/admin/reports?targetType=PPA_REVIEW').set(auth(admin)).expect(200);
      const entry = queue.body.reports.find((r: { id: string }) => r.id === report.body.id);

      expect(entry.targetExists).toBe(true);
      expect(entry.target.author.username).toBe(writer.username);
      expect(entry.snapshot.ppaName).toBe('Moderation Co');

      await ctx
        .http()
        .patch(`/api/v1/admin/reports/${report.body.id}/decision`)
        .set(auth(admin))
        .send({ status: 'REVIEWED', action: 'REMOVE_CONTENT', note: 'Abusive review' })
        .expect(200);

      expect(await ctx.prisma.ppaReview.findUnique({ where: { id: reviewId } })).toBeNull();
      expect((await getPpa(viewer, ppaId)).body.reviewCount).toBe(1);
      await expectTotalsMatchRows(ppaId);

      const note = await ctx.prisma.notification.findFirst({ where: { recipientId: writer.id, type: NotificationType.CONTENT_REMOVED } });
      expect(note?.message).toContain('Moderation Co');
    });

    it('lets an admin delete a review directly, with a note and an audit record', async () => {
      const other = await ctx.makeUser();
      const created = (await submit(other, review({ ppaId, name: undefined, state: undefined })).expect(201)).body;

      await ctx.http().delete(`/api/v1/admin/ppa-reviews/${created.id}`).set(auth(other)).send({}).expect(403);
      await ctx.http().delete(`/api/v1/admin/ppa-reviews/${created.id}`).set(auth(admin)).send({ reason: 'Fake review' }).expect(200);
      await ctx.http().delete(`/api/v1/admin/ppa-reviews/${created.id}`).set(auth(admin)).send({}).expect(404);

      expect((await getPpa(viewer, ppaId)).body.reviewCount).toBe(1);
      await expectTotalsMatchRows(ppaId);

      const audit = await ctx.prisma.auditLog.findFirst({ where: { targetId: created.id, action: 'PPA_REVIEW_REMOVED' } });
      expect(audit?.reason).toBe('Fake review');
      expect(audit?.adminId).toBe(admin.id);

      const note = await ctx.prisma.notification.findFirst({ where: { recipientId: other.id } });
      expect(note?.message).toContain('Fake review');
    });

    it('shows a single review to an admin with its author', async () => {
      const any = await ctx.prisma.ppaReview.findFirstOrThrow({ where: { ppaId } });
      const res = await ctx.http().get(`/api/v1/admin/ppa-reviews/${any.id}`).set(auth(admin)).expect(200);

      expect(res.body.author).toHaveProperty('username');
      await ctx.http().get('/api/v1/admin/ppa-reviews/nope').set(auth(admin)).expect(404);
    });
  });

  describe('deleting an account', () => {
    it('takes the person\'s reviews out of the PPA totals', async () => {
      const leaver = await ctx.makeUser({ passwordHash: await argon2.hash('Passw0rd!Passw0rd') });
      const stayer = await ctx.makeUser();
      const first = (await submit(leaver, review({ name: 'Leaver Co', state: 'Enugu', overallRating: 1 })).expect(201)).body;
      await submit(stayer, review({ ppaId: first.ppaId, name: undefined, state: undefined, overallRating: 5 })).expect(201);

      expect((await getPpa(viewer, first.ppaId)).body.rating).toBe(3);

      await ctx.http().delete('/api/v1/users/me').set(auth(leaver)).send({ password: 'Passw0rd!Passw0rd' }).expect(200);

      const ppa = (await getPpa(viewer, first.ppaId)).body;
      expect(ppa.reviewCount).toBe(1);
      expect(ppa.rating).toBe(5);
      await expectTotalsMatchRows(first.ppaId);
    });
  });

  describe('admin dashboard', () => {
    it('counts what is waiting and what exists, without changing the old numbers', async () => {
      const res = await ctx.http().get('/api/v1/admin/stats').set(auth(admin)).expect(200);

      expect(res.body.needsAttention).toEqual(
        expect.objectContaining({
          pendingReports: expect.any(Number),
          pendingVerifications: expect.any(Number),
          pendingOpportunities: expect.any(Number),
          pendingEvents: expect.any(Number),
        }),
      );
      expect(res.body.ppaReviews.total).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('opportunities');
      expect(res.body).toHaveProperty('events');
    });
  });
});
