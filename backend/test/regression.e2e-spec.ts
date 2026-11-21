import { NotificationType, UserRole } from '@prisma/client';
import { TestContext, TestUser, auth, createContext } from './helpers';

// The older parts of the API must behave exactly as before the new modules
// were added. These are quick checks of their main paths and reply shapes.
describe('Existing features still work', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let user: TestUser;
  let seller: TestUser;

  beforeAll(async () => {
    ctx = await createContext();
    await ctx.reset();
    admin = await ctx.makeUser({ role: UserRole.ADMIN });
    user = await ctx.makeUser({ state: 'Ogun' });
    seller = await ctx.makeUser({ state: 'Lagos' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('answers the health check without a login', async () => {
    const res = await ctx.http().get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('still protects routes that need a login', async () => {
    for (const path of ['/users/me', '/feed', '/notifications', '/marketplace/listings', '/explore', '/admin/stats']) {
      await ctx.http().get(`/api/v1${path}`).expect(401);
    }
  });

  it('keeps admin routes admin only', async () => {
    await ctx.http().get('/api/v1/admin/stats').set(auth(user)).expect(403);
    await ctx.http().get('/api/v1/admin/reports').set(auth(user)).expect(403);
  });

  it('returns the current user', async () => {
    const res = await ctx.http().get('/api/v1/users/me').set(auth(user)).expect(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe(user.username);
  });

  it('creates and reads a post, and shows it in the feed shape', async () => {
    const created = await ctx.http().post('/api/v1/posts').set(auth(user)).send({ content: 'Hello from my PPA' }).expect(201);
    expect(created.body.content).toBe('Hello from my PPA');

    const one = await ctx.http().get(`/api/v1/posts/${created.body.id}`).set(auth(seller)).expect(200);
    expect(one.body.id).toBe(created.body.id);

    const feed = await ctx.http().get('/api/v1/feed').set(auth(user)).expect(200);
    expect(feed.body).toHaveProperty('nextCursor');
  });

  it('creates and lists a marketplace service listing', async () => {
    const created = await ctx
      .http()
      .post('/api/v1/marketplace/listings')
      .set(auth(seller))
      .send({ title: 'Logo design service', description: 'I design clean logos for small businesses.', price: 15000, category: 'SERVICES' })
      .expect(201);

    const list = await ctx.http().get('/api/v1/marketplace/listings').set(auth(user)).expect(200);
    expect(list.body.listings.map((l: { id: string }) => l.id)).toContain(created.body.id);
    expect(list.body).toHaveProperty('nextCursor');
  });

  it('lists explore entries', async () => {
    const res = await ctx.http().get('/api/v1/explore').set(auth(user)).expect(200);
    expect(res.body).toHaveProperty('entries');
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('reports a post and shows it to the admin in the same shape as before', async () => {
    const post = await ctx.http().post('/api/v1/posts').set(auth(seller)).send({ content: 'A questionable post' }).expect(201);
    const report = await ctx.http().post('/api/v1/reports').set(auth(user)).send({ targetType: 'POST', targetId: post.body.id, reason: 'Spam' }).expect(201);

    const queue = await ctx.http().get('/api/v1/admin/reports').set(auth(admin)).expect(200);
    const entry = queue.body.reports.find((r: { id: string }) => r.id === report.body.id);

    expect(entry.targetType).toBe('POST');
    expect(entry.targetExists).toBe(true);
    expect(entry.target.id).toBe(post.body.id);

    await ctx
      .http()
      .patch(`/api/v1/admin/reports/${report.body.id}/decision`)
      .set(auth(admin))
      .send({ status: 'REVIEWED', action: 'REMOVE_CONTENT', note: 'Spam' })
      .expect(200);

    await ctx.http().get(`/api/v1/posts/${post.body.id}`).set(auth(user)).expect(404);
  });

  it('blocks a user and lists the blocked', async () => {
    await ctx.http().post(`/api/v1/users/${seller.id}/block`).set(auth(user)).expect(201);
    const blocked = await ctx.http().get('/api/v1/users/me/blocked').set(auth(user)).expect(200);
    expect(JSON.stringify(blocked.body)).toContain(seller.username);
  });

  it('shows notifications, old and new types, with the ids the app needs to open them', async () => {
    const event = await ctx.prisma.event.create({
      data: {
        createdById: admin.id,
        title: 'Notification event',
        description: 'An event for the notification check.',
        category: 'MEETUP',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        format: 'VIRTUAL',
        status: 'PUBLISHED',
      },
    });

    await ctx.prisma.notification.create({
      data: { recipientId: user.id, type: NotificationType.EVENT_APPROVED, eventId: event.id, message: 'approved' },
    });

    const res = await ctx.http().get('/api/v1/notifications').set(auth(user)).expect(200);
    const note = res.body.notifications.find((n: { type: string }) => n.type === 'EVENT_APPROVED');

    expect(note.eventId).toBe(event.id);
    expect(note).toHaveProperty('opportunityId');
    expect(note.read).toBe(false);

    const count = await ctx.http().get('/api/v1/notifications/unread-count').set(auth(user)).expect(200);
    expect(count.body.count).toBeGreaterThan(0);

    await ctx.http().patch('/api/v1/notifications/read-all').set(auth(user)).expect(200);
    expect((await ctx.http().get('/api/v1/notifications/unread-count').set(auth(user))).body.count).toBe(0);

    const prefs = await ctx.http().get('/api/v1/notifications/preferences').set(auth(user)).expect(200);
    expect(prefs.body).toHaveProperty('userId');
  });

  it('keeps the old numbers on the admin dashboard', async () => {
    const res = await ctx.http().get('/api/v1/admin/stats').set(auth(admin)).expect(200);

    expect(res.body.needsAttention).toHaveProperty('pendingReports');
    expect(res.body.needsAttention).toHaveProperty('pendingVerifications');
    expect(res.body).toHaveProperty('messages');
  });
});
