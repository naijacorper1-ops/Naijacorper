import { NotificationType, UserRole } from '@prisma/client';
import { TestContext, TestUser, auth, createContext, inDays } from './helpers';

const body = (over: Record<string, unknown> = {}) => ({
  type: 'JOB',
  title: 'Junior Backend Developer',
  organization: 'Acme Ltd',
  description: 'We are hiring a junior backend developer to work on our APIs.',
  mode: 'ONSITE',
  state: 'Lagos',
  applyUrl: 'https://acme.example.com/apply',
  ...over,
});

describe('Opportunities', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let recruiter: TestUser;
  let corper: TestUser;
  let otherCorper: TestUser;
  let viewer: TestUser;

  beforeAll(async () => {
    ctx = await createContext();
    await ctx.reset();
    admin = await ctx.makeUser({ role: UserRole.ADMIN });
    recruiter = await ctx.makeUser({ role: UserRole.RECRUITER, isVerified: false });
    corper = await ctx.makeUser({ role: UserRole.SERVING_CORPER });
    otherCorper = await ctx.makeUser({ role: UserRole.EX_CORPER });
    viewer = await ctx.makeUser({ role: UserRole.PROSPECTIVE_CORPER, isVerified: false });
  });

  afterAll(async () => {
    await ctx.close();
  });

  const post = (user: TestUser, data: Record<string, unknown> = body()) =>
    ctx.http().post('/api/v1/opportunities').set(auth(user)).send(data);

  // A recruiter's or business's post waits for approval like everyone else's.
  // This submits it and approves it as the admin, and returns the id.
  const postLive = async (user: TestUser, data: Record<string, unknown> = body()) => {
    const id = (await post(user, data).expect(201)).body.id as string;
    await ctx.http().patch(`/api/v1/admin/opportunities/${id}/decision`).set(auth(admin)).send({ decision: 'APPROVE' }).expect(200);
    return id;
  };

  const list = (user: TestUser, query = '') =>
    ctx.http().get(`/api/v1/opportunities${query}`).set(auth(user));

  describe('who may post', () => {
    it('needs a login', async () => {
      await ctx.http().post('/api/v1/opportunities').send(body()).expect(401);
      await ctx.http().get('/api/v1/opportunities').expect(401);
    });

    it('refuses a prospective corps member', async () => {
      const res = await post(viewer).expect(403);
      expect(res.body.code).toBe('ROLE_NOT_ALLOWED');
    });

    it('refuses a corps member whose email is not verified', async () => {
      const user = await ctx.makeUser({ emailVerified: false });
      const res = await post(user).expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('refuses a corps member who is not NYSC verified', async () => {
      const user = await ctx.makeUser({ isVerified: false });
      const res = await post(user).expect(403);
      expect(res.body.code).toBe('VERIFICATION_REQUIRED');
    });

    it('refuses a recruiter whose email is not verified', async () => {
      const user = await ctx.makeUser({ role: UserRole.RECRUITER, emailVerified: false });
      const res = await post(user).expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('queues a verified corps member for approval', async () => {
      const res = await post(corper).expect(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.isMine).toBe(true);
      expect(res.body.postedBy.username).toBe(corper.username);
    });

    it('queues a recruiter and a business for approval', async () => {
      const business = await ctx.makeUser({ role: UserRole.BUSINESS, isVerified: false });

      for (const user of [recruiter, business]) {
        const res = await post(user).expect(201);
        expect(res.body.status).toBe('PENDING');
        expect(res.body.isMine).toBe(true);
      }
    });

    it('publishes only an admin straight away', async () => {
      const fromAdmin = await post(admin).expect(201);
      expect(fromAdmin.body.status).toBe('OPEN');
    });
  });

  describe('validation', () => {
    it('rejects bad input with a 400', async () => {
      await post(recruiter, body({ title: 'x' })).expect(400);
      await post(recruiter, body({ type: 'NOPE' })).expect(400);
      await post(recruiter, body({ state: 'Atlantis' })).expect(400);
      await post(recruiter, body({ applyUrl: 'http://insecure.example.com' })).expect(400);
      await post(recruiter, body({ applyUrl: 'javascript:alert(1)' })).expect(400);
      await post(recruiter, body({ applyEmail: 'not-an-email' })).expect(400);
      await post(recruiter, body({ compensationMin: -1 })).expect(400);
      await post(recruiter, body({ deadline: 'next friday' })).expect(400);
    });

    it('rejects fields it does not know, such as setting its own status', async () => {
      await post(recruiter, body({ status: 'OPEN' })).expect(400);
      await post(recruiter, body({ postedById: admin.id })).expect(400);
    });

    it('rejects a minimum pay above the maximum', async () => {
      await post(recruiter, body({ compensationMin: 200000, compensationMax: 100000 })).expect(400);
    });

    it('rejects a deadline in the past', async () => {
      await post(recruiter, body({ deadline: '2020-01-01' })).expect(400);
    });

    it('accepts a date-only deadline and keeps it until the end of that day', async () => {
      const day = inDays(10).toISOString().slice(0, 10);
      const res = await post(recruiter, body({ deadline: day, applyEmail: 'Jobs@Acme.com ' })).expect(201);

      expect(res.body.deadline).toBe(`${day}T22:59:59.999Z`);
      expect(res.body.applyEmail).toBe('jobs@acme.com');
    });
  });

  describe('visibility', () => {
    let pending: string;
    let open: string;

    beforeAll(async () => {
      pending = (await post(corper, body({ title: 'Pending visibility job' })).expect(201)).body.id;
      open = await postLive(recruiter, body({ title: 'Open visibility job' }));
    });

    it('keeps a pending opportunity out of the public list and hides it from others', async () => {
      const res = await list(viewer, '?q=visibility').expect(200);
      const ids = res.body.opportunities.map((o: { id: string }) => o.id);

      expect(ids).toContain(open);
      expect(ids).not.toContain(pending);

      await ctx.http().get(`/api/v1/opportunities/${pending}`).set(auth(viewer)).expect(404);
      await ctx.http().get(`/api/v1/opportunities/${pending}`).set(auth(otherCorper)).expect(404);
    });

    it('shows a pending opportunity to its poster and to an admin', async () => {
      const mine = await ctx.http().get(`/api/v1/opportunities/${pending}`).set(auth(corper)).expect(200);
      const asAdmin = await ctx.http().get(`/api/v1/opportunities/${pending}`).set(auth(admin)).expect(200);

      expect(mine.body.status).toBe('PENDING');
      expect(asAdmin.body.status).toBe('PENDING');
    });

    it('lists the poster\'s own posts in every status under /mine', async () => {
      const res = await ctx.http().get('/api/v1/opportunities/mine').set(auth(corper)).expect(200);
      const ids = res.body.opportunities.map((o: { id: string }) => o.id);

      expect(ids).toContain(pending);
      expect(res.body).toHaveProperty('nextCursor');

      const onlyOpen = await ctx.http().get('/api/v1/opportunities/mine?status=OPEN').set(auth(corper)).expect(200);
      expect(onlyOpen.body.opportunities).toHaveLength(0);
    });

    it('never shows who reviewed it, or the reason, to other people', async () => {
      const res = await ctx.http().get(`/api/v1/opportunities/${open}`).set(auth(viewer)).expect(200);

      for (const key of ['reviewedBy', 'reviewedAt', 'removedBy', 'rejectionReason', 'removedReason']) {
        expect(res.body).not.toHaveProperty(key);
      }

      expect(res.body.isMine).toBe(false);
      expect(res.body.postedBy).not.toHaveProperty('email');
    });

    it('gives a 404 for an id that does not exist', async () => {
      await ctx.http().get('/api/v1/opportunities/does-not-exist').set(auth(viewer)).expect(404);
    });

    it('hides opportunities from a poster who has blocked the viewer', async () => {
      const blocker = await ctx.makeUser({ role: UserRole.RECRUITER });
      const blocked = await ctx.makeUser({ role: UserRole.EX_CORPER });
      const created = await postLive(blocker, body({ title: 'Blocker only job' }));

      await ctx.http().post(`/api/v1/users/${blocker.id}/block`).set(auth(blocked)).expect(201);

      const res = await list(blocked, '?q=Blocker%20only').expect(200);
      expect(res.body.opportunities).toHaveLength(0);
      await ctx.http().get(`/api/v1/opportunities/${created}`).set(auth(blocked)).expect(404);
    });

    it('hides opportunities from a deactivated poster', async () => {
      const gone = await ctx.makeUser({ role: UserRole.RECRUITER });
      await postLive(gone, body({ title: 'Deactivated poster job' }));
      await ctx.prisma.user.update({ where: { id: gone.id }, data: { isActive: false } });

      const res = await list(viewer, '?q=Deactivated%20poster').expect(200);
      expect(res.body.opportunities).toHaveLength(0);
    });
  });

  describe('searching and filtering', () => {
    beforeAll(async () => {
      await postLive(recruiter, body({ title: 'Scholarship for graduates', type: 'SCHOLARSHIP', state: 'Oyo', mode: 'HYBRID', organization: 'Zebra Foundation' }));
      await postLive(recruiter, body({ title: 'Remote copywriter', type: 'FREELANCE', state: undefined, mode: 'REMOTE', employmentType: 'CONTRACT', organization: 'Quill Co' }));
    });

    it('filters by type, state, mode and employment type', async () => {
      const byType = await list(viewer, '?type=SCHOLARSHIP').expect(200);
      expect(byType.body.opportunities.length).toBeGreaterThan(0);
      expect(byType.body.opportunities.every((o: { type: string }) => o.type === 'SCHOLARSHIP')).toBe(true);

      const byState = await list(viewer, '?state=oyo').expect(200);
      expect(byState.body.opportunities.length).toBeGreaterThan(0);
      expect(byState.body.opportunities.every((o: { state: string }) => o.state === 'Oyo')).toBe(true);

      const byMode = await list(viewer, '?mode=REMOTE').expect(200);
      expect(byMode.body.opportunities.map((o: { title: string }) => o.title)).toContain('Remote copywriter');

      const byEmployment = await list(viewer, '?employmentType=CONTRACT').expect(200);
      expect(byEmployment.body.opportunities).toHaveLength(1);
    });

    it('searches title and organisation', async () => {
      const byTitle = await list(viewer, '?q=copywriter').expect(200);
      expect(byTitle.body.opportunities).toHaveLength(1);

      const byOrg = await list(viewer, '?q=zebra').expect(200);
      expect(byOrg.body.opportunities).toHaveLength(1);
      expect(byOrg.body.opportunities[0].organization).toBe('Zebra Foundation');
    });

    it('rejects unknown filter values and unknown parameters', async () => {
      await list(viewer, '?type=NOPE').expect(400);
      await list(viewer, '?state=Atlantis').expect(400);
      await list(viewer, '?pageSize=500').expect(400);
      await list(viewer, '?sort=oldest').expect(400);
    });

    it('pages with a cursor and never repeats or skips a row', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;

      for (let i = 0; i < 20; i += 1) {
        const res: { body: { opportunities: { id: string }[]; nextCursor: string | null } } = await list(
          viewer,
          `?pageSize=2${cursor ? `&cursor=${cursor}` : ''}`,
        ).expect(200);

        seen.push(...res.body.opportunities.map((o) => o.id));
        cursor = res.body.nextCursor;

        if (!cursor) {
          break;
        }
      }

      // The same rows, fetched in one go, in the same order.
      const everything = await list(viewer, '?pageSize=50').expect(200);
      expect(everything.body.nextCursor).toBeNull();
      expect(seen).toEqual(everything.body.opportunities.map((o: { id: string }) => o.id));
      expect(seen.length).toBeGreaterThan(3);
      await list(viewer, '?cursor=not-a-cursor').expect(400);
    });
  });

  describe('approval', () => {
    it('is an admin-only queue', async () => {
      await ctx.http().get('/api/v1/admin/opportunities?status=PENDING').set(auth(corper)).expect(403);
      const res = await ctx.http().get('/api/v1/admin/opportunities?status=PENDING').set(auth(admin)).expect(200);

      expect(res.body.opportunities.length).toBeGreaterThan(0);
      expect(res.body.opportunities.every((o: { status: string }) => o.status === 'PENDING')).toBe(true);
      expect(res.body.opportunities[0].postedBy).toHaveProperty('email');
    });

    it('approves, publishes, tells the poster and writes the audit log', async () => {
      const id = (await post(corper, body({ title: 'To be approved' })).expect(201)).body.id;

      const res = await ctx
        .http()
        .patch(`/api/v1/admin/opportunities/${id}/decision`)
        .set(auth(admin))
        .send({ decision: 'APPROVE' })
        .expect(200);

      expect(res.body.status).toBe('OPEN');
      expect(res.body.reviewedBy).toBe(admin.id);

      const visible = await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(200);
      expect(visible.body.status).toBe('OPEN');

      const note = await ctx.prisma.notification.findFirst({
        where: { recipientId: corper.id, opportunityId: id },
      });
      expect(note?.type).toBe(NotificationType.OPPORTUNITY_APPROVED);

      const audit = await ctx.prisma.auditLog.findFirst({ where: { targetId: id, action: 'OPPORTUNITY_APPROVED' } });
      expect(audit?.adminId).toBe(admin.id);
    });

    it('cannot decide the same post twice', async () => {
      const id = (await post(corper, body({ title: 'Decided once' })).expect(201)).body.id;
      const decide = () =>
        ctx.http().patch(`/api/v1/admin/opportunities/${id}/decision`).set(auth(admin)).send({ decision: 'APPROVE' });

      const [a, b] = await Promise.all([decide(), decide()]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });

    it('needs a reason to reject, and shows it to the poster only', async () => {
      const id = (await post(corper, body({ title: 'To be rejected' })).expect(201)).body.id;

      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/decision`).set(auth(admin)).send({ decision: 'REJECT' }).expect(400);

      await ctx
        .http()
        .patch(`/api/v1/admin/opportunities/${id}/decision`)
        .set(auth(admin))
        .send({ decision: 'REJECT', reason: 'Not a real opportunity' })
        .expect(200);

      const mine = await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(corper)).expect(200);
      expect(mine.body.status).toBe('REJECTED');
      expect(mine.body.rejectionReason).toBe('Not a real opportunity');

      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(404);

      const note = await ctx.prisma.notification.findFirst({ where: { recipientId: corper.id, opportunityId: id } });
      expect(note?.type).toBe(NotificationType.OPPORTUNITY_REJECTED);
      expect(note?.message).toContain('Not a real opportunity');
    });

    it('does not decide something that is not pending', async () => {
      const open = await postLive(recruiter, body({ title: 'Already open' }));
      await ctx.http().patch(`/api/v1/admin/opportunities/${open}/decision`).set(auth(admin)).send({ decision: 'APPROVE' }).expect(409);
      await ctx.http().patch('/api/v1/admin/opportunities/nope/decision').set(auth(admin)).send({ decision: 'APPROVE' }).expect(404);
    });
  });

  describe('editing', () => {
    it('sends an edited, approved corps member post back for review', async () => {
      const id = (await post(corper, body({ title: 'Edit me' })).expect(201)).body.id;
      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/decision`).set(auth(admin)).send({ decision: 'APPROVE' }).expect(200);

      const res = await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(corper)).send({ title: 'Edited title' }).expect(200);
      expect(res.body.title).toBe('Edited title');
      expect(res.body.status).toBe('PENDING');

      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(404);
    });

    it('lets a rejected post be corrected and resubmitted', async () => {
      const id = (await post(corper, body({ title: 'Fix me' })).expect(201)).body.id;
      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/decision`).set(auth(admin)).send({ decision: 'REJECT', reason: 'Add details' }).expect(200);

      const res = await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(corper)).send({ description: 'Now with plenty of details about the role.' }).expect(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.rejectionReason).toBeNull();
    });

    it('sends an edited, approved recruiter post back for review', async () => {
      const id = await postLive(recruiter, body({ title: 'Recruiter edit' }));
      const res = await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({ title: 'Recruiter edited' }).expect(200);
      expect(res.body.status).toBe('PENDING');

      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(404);
    });

    it('does not re-queue an admin\'s edit, even of someone else\'s post', async () => {
      const id = await postLive(recruiter, body({ title: 'Admin will edit' }));
      const res = await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(admin)).send({ title: 'Fixed by admin' }).expect(200);
      expect(res.body.status).toBe('OPEN');
    });

    it('only lets the owner (or an admin) edit', async () => {
      const id = await postLive(recruiter, body({ title: 'Not yours' }));
      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(corper)).send({ title: 'Hijack' }).expect(403);
    });

    it('cannot edit a pending post of someone else, and gets a 404 not a 403', async () => {
      const id = (await post(corper, body({ title: 'Hidden edit' })).expect(201)).body.id;
      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(otherCorper)).send({ title: 'Hijack' }).expect(404);
    });

    it('clears an optional field with null and rejects an empty body', async () => {
      const id = await postLive(recruiter, body({ title: 'Clear me', duration: '6 months' }));
      const res = await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({ duration: null }).expect(200);
      expect(res.body.duration).toBeNull();

      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({}).expect(400);
      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({ title: null }).expect(400);
      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({ status: 'OPEN' }).expect(400);
    });

    it('checks the pay range against what is already saved', async () => {
      const id = await postLive(recruiter, body({ title: 'Pay range', compensationMin: 100000, compensationMax: 200000 }));
      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({ compensationMax: 50000 }).expect(400);
    });
  });

  describe('closing, deleting and removal', () => {
    it('closes a post: still reachable by link, gone from the list, can be reopened', async () => {
      const id = await postLive(recruiter, body({ title: 'Closable job' }));

      const closed = await ctx.http().patch(`/api/v1/opportunities/${id}/status`).set(auth(recruiter)).send({ status: 'CLOSED' }).expect(200);
      expect(closed.body.status).toBe('CLOSED');

      const direct = await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(200);
      expect(direct.body.status).toBe('CLOSED');

      const listed = await list(viewer, '?q=Closable').expect(200);
      expect(listed.body.opportunities).toHaveLength(0);

      await ctx.http().patch(`/api/v1/opportunities/${id}/status`).set(auth(recruiter)).send({ status: 'CLOSED' }).expect(409);
      await ctx.http().patch(`/api/v1/opportunities/${id}/status`).set(auth(corper)).send({ status: 'OPEN' }).expect(403);
      await ctx.http().patch(`/api/v1/opportunities/${id}/status`).set(auth(recruiter)).send({ status: 'REMOVED' }).expect(400);

      const reopened = await ctx.http().patch(`/api/v1/opportunities/${id}/status`).set(auth(recruiter)).send({ status: 'OPEN' }).expect(200);
      expect(reopened.body.status).toBe('OPEN');
    });

    it('does not let a pending post be closed or reopened', async () => {
      const id = (await post(corper, body({ title: 'Pending no close' })).expect(201)).body.id;
      await ctx.http().patch(`/api/v1/opportunities/${id}/status`).set(auth(corper)).send({ status: 'CLOSED' }).expect(409);
    });

    it('hides a post whose deadline has passed from the list, but not from its link', async () => {
      const id = await postLive(recruiter, body({ title: 'Deadline passed job', deadline: inDays(5).toISOString() }));
      await ctx.prisma.opportunity.update({ where: { id }, data: { deadline: new Date(Date.now() - 1000) } });

      const listed = await list(viewer, '?q=Deadline%20passed').expect(200);
      expect(listed.body.opportunities).toHaveLength(0);
      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(200);
    });

    it('lets the owner delete their own post and nobody else', async () => {
      const id = await postLive(recruiter, body({ title: 'Deletable' }));
      await ctx.http().delete(`/api/v1/opportunities/${id}`).set(auth(corper)).expect(404);
      await ctx.http().delete(`/api/v1/opportunities/${id}`).set(auth(recruiter)).expect(200);
      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(admin)).expect(404);
    });

    it('removes and restores as an admin, telling the poster and keeping the record', async () => {
      const id = await postLive(recruiter, body({ title: 'Removable job' }));

      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/remove`).set(auth(recruiter)).send({ reason: 'spam' }).expect(403);
      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/remove`).set(auth(admin)).send({}).expect(400);
      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/remove`).set(auth(admin)).send({ reason: 'This is spam' }).expect(200);
      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/remove`).set(auth(admin)).send({ reason: 'This is spam' }).expect(409);

      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(404);

      const owner = await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(recruiter)).expect(200);
      expect(owner.body.status).toBe('REMOVED');
      expect(owner.body.removedReason).toBe('This is spam');

      await ctx.http().patch(`/api/v1/opportunities/${id}`).set(auth(recruiter)).send({ title: 'Sneaky edit' }).expect(403);
      await ctx.http().delete(`/api/v1/opportunities/${id}`).set(auth(recruiter)).expect(403);

      const note = await ctx.prisma.notification.findFirst({
        where: { recipientId: recruiter.id, opportunityId: id, type: NotificationType.CONTENT_REMOVED },
      });
      expect(note).not.toBeNull();
      expect(note?.message).toContain('This is spam');

      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/restore`).set(auth(admin)).send({}).expect(200);
      await ctx.http().get(`/api/v1/opportunities/${id}`).set(auth(viewer)).expect(200);
      await ctx.http().patch(`/api/v1/admin/opportunities/${id}/restore`).set(auth(admin)).send({}).expect(404);
    });
  });

  describe('reports', () => {
    it('lets a user report a public post, and an admin remove it from the report', async () => {
      const id = await postLive(recruiter, body({ title: 'Reportable job' }));

      const report = await ctx
        .http()
        .post('/api/v1/reports')
        .set(auth(viewer))
        .send({ targetType: 'OPPORTUNITY', targetId: id, reason: 'Looks like a scam' })
        .expect(201);

      await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'OPPORTUNITY', targetId: id, reason: 'Again' }).expect(409);
      await ctx.http().post('/api/v1/reports').set(auth(recruiter)).send({ targetType: 'OPPORTUNITY', targetId: id, reason: 'Mine' }).expect(400);

      const queue = await ctx.http().get('/api/v1/admin/reports?targetType=OPPORTUNITY').set(auth(admin)).expect(200);
      const entry = queue.body.reports.find((r: { id: string }) => r.id === report.body.id);
      expect(entry.targetExists).toBe(true);
      expect(entry.target.title).toBe('Reportable job');
      expect(entry.snapshot.title).toBe('Reportable job');

      await ctx
        .http()
        .patch(`/api/v1/admin/reports/${report.body.id}/decision`)
        .set(auth(admin))
        .send({ status: 'REVIEWED', action: 'REMOVE_CONTENT', note: 'Confirmed scam' })
        .expect(200);

      const after = await ctx.prisma.opportunity.findUnique({ where: { id } });
      expect(after?.status).toBe('REMOVED');
    });

    it('does not let anyone report a post that is not public', async () => {
      const id = (await post(corper, body({ title: 'Pending report' })).expect(201)).body.id;
      await ctx.http().post('/api/v1/reports').set(auth(viewer)).send({ targetType: 'OPPORTUNITY', targetId: id, reason: 'Probe' }).expect(404);
    });
  });
});
