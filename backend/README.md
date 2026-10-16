# NaijaCorper Backend — Foundation

This is the starting scaffold: project config, Prisma, Auth (register, login,
refresh, logout), Users (`GET /users/me`), and Onboarding (journey stage,
prospective/serving details, verification document submission). Everything
else (posts, feed, marketplace, messaging, moderation) gets added as separate
modules under `src/modules/` the same way these are structured.

## Setup — run these in order

```bash
npm install                          # installs everything + auto-runs prisma generate
npx prisma migrate dev --name init   # creates the actual tables in your database
npx tsc --noEmit                     # optional but recommended: confirms zero type errors
npm run start:dev                    # starts the server on http://localhost:4000
```

`npm install` alone is not enough to start the server — it generates the
Prisma *client code*, but doesn't touch your actual database. `migrate dev`
is the step that creates the tables. Skip it and the server will start fine,
then crash the moment any endpoint tries to query a table that doesn't exist
yet. Run `migrate dev` once now; run it again only when `schema.prisma`
changes in the future.

Once it's running, `http://localhost:4000/api/docs` has every endpoint listed
and testable (Swagger).

## Onboarding flow, in short

1. `PATCH /api/v1/onboarding/journey-stage` — `{ stage: 'PREPARING' | 'SERVING' | 'COMPLETED' }`.
   Sets the user's role. Callable again later if their status changes (PRD allows this).
2. Depending on the role that sets:
   - `PATCH /api/v1/onboarding/prospective-details` — `{ nyscStage, state?, interests[] }`
   - `PATCH /api/v1/onboarding/serving-details` — `{ state, lga, batch, stream, ppa?, interests[] }`
   Either one also marks `onboardingCompleted: true`.
3. `POST /api/v1/onboarding/verification-document` — `{ documentUrl }`. Creates a
   `VerificationDocument` row and sets `verificationStatus` to `PENDING`. Actual
   file upload (to Cloudinary or a private bucket) comes with the Uploads module —
   for now this expects a URL you already have.

Verification review itself isn't built yet — for now, approve/reject by editing
`verificationStatus` directly in the Supabase table editor. A couple of protected
admin endpoints come later once that gets tedious, not before.

## Social core

- `POST /api/v1/posts` — `{ content?, mediaUrls?, repostOfId? }`. Needs content,
  a repost target, or both (a quote post is a repost with its own content).
  Hashtags in `content` are extracted and stored automatically.
- `GET /api/v1/posts/:id` / `DELETE /api/v1/posts/:id` (own posts only)
- `POST /api/v1/posts/:postId/like` / `DELETE /api/v1/posts/:postId/like`
- `POST /api/v1/posts/:postId/comments` — `{ content, parentId? }` (`parentId` makes it a reply, one level deep)
- `GET /api/v1/posts/:postId/comments`
- `POST /api/v1/users/:userId/follow` / `DELETE /api/v1/users/:userId/follow`
- `GET /api/v1/feed?scope=NATIONAL|STATE|FOLLOWING&state=&cursor=` — cursor-paginated,
  20 posts per page. `STATE` defaults to the caller's own state if none is given.

Two design calls worth knowing about:

- **Every route requires login**, including reads (`GET /posts/:id`, feed, comments).
  There's no logged-out browsing yet. Easy to relax later — it's one guard.
- **Feed reads posts at query time** (filter + sort with indexes), not the
  fan-out-on-write/BullMQ approach mentioned earlier. That's the right call
  until you actually have write volume that makes read-time queries slow —
  building the queue infrastructure before you need it is wasted complexity.
  The schema (denormalized counters, indexed columns) is ready for fan-out to
  be bolted on later without a rewrite.
- **Hashtags are extracted and stored on every post**, but there's no
  "browse by hashtag" endpoint yet — that's coming with Explore/Trending.

## Uploads (Cloudinary)

- `POST /api/v1/uploads/post-media` — multipart `file` field, image or video,
  15MB max. Returns `{ url }` — a permanent public URL. Pass that URL into
  `mediaUrls` when creating a post.
- `POST /api/v1/uploads/verification-document` — multipart `file` field, image
  or PDF, 15MB max. Uploaded as Cloudinary's `authenticated` delivery type
  (not public), returns `{ url }` as a **signed URL that expires in 15 minutes**.
  Pass that URL into `POST /onboarding/verification-document` right away —
  don't store it for later, it expires.

Note on the verification document choice: a fully separate private storage
provider (S3, Supabase Storage) was the original plan for these, since they're
more sensitive than post photos. Cloudinary's `authenticated` type gets you
equivalent privacy — not publicly listable, requires a signed URL, expires —
without adding a second storage account to manage for MVP. Worth revisiting
if you outgrow it, but it's not a shortcut that compromises anything right now.

Files are streamed straight from the request into Cloudinary — nothing touches
disk on the server, which matters on Render specifically since its filesystem
isn't persistent between deploys anyway.

### One more package needed for this module

```bash
npm i -D @types/multer
```
(`multer` itself ships as a dependency of `@nestjs/platform-express` already —
this just adds the TypeScript types for `Express.Multer.File`.)

## Messaging

REST for initial load and history, a Socket.io gateway for live send/receive.
Both paths call the same `MessagingService` methods — no duplicated logic.

- `POST /api/v1/messaging/conversations/:userId` — get or create the 1:1
  conversation with that user (idempotent, safe to call every time a chat opens)
- `GET /api/v1/messaging/conversations` — list mine, newest activity first,
  each with the other participant and a last-message preview
- `GET /api/v1/messaging/conversations/:conversationId/messages?cursor=` —
  cursor-paginated history, 30 per page
- `POST /api/v1/messaging/conversations/:conversationId/messages` — send over
  REST (useful for testing without a socket connection)

**Socket.io**, namespace `/messaging`:
- Connect with `{ auth: { token: '<access token>' } }` — same access token as
  REST, verified on connection; the socket is dropped if it doesn't check out
- Emit `sendMessage` with `{ conversationId, content }` to send
- Listen for `newMessage` to receive — fires whether the message came in over
  the socket or the REST endpoint, so the frontend only needs one listener

Frontend will need `socket.io-client` (not a backend package, flagging it so
whoever's on that side knows).

A message's `conversationId` comes from the `startConversation` call — the
usual flow is: open a profile/listing → `POST .../conversations/:userId` →
use the returned `id` for both history and sending from then on.

## Marketplace

- `POST /api/v1/marketplace/listings` — `{ title, description, price, category, state?, imageUrls? }`.
  `state` defaults to the seller's own state. `price` is a whole-Naira integer —
  no payment processing happens through the platform for MVP (buyer and seller
  settle between themselves), so kobo precision wasn't worth the complexity.
- `GET /api/v1/marketplace/listings?category=&state=&cursor=` — browse,
  `AVAILABLE` only, cursor-paginated
- `GET /api/v1/marketplace/listings/:id`
- `PATCH /api/v1/marketplace/listings/:id` — edit your own (any field, all optional)
- `PATCH /api/v1/marketplace/listings/:id/status` — `{ status: 'AVAILABLE' | 'SOLD' }`,
  kept separate from the general edit — one clear action, same pattern as
  like/unlike being their own endpoints rather than folded into a generic update
- `DELETE /api/v1/marketplace/listings/:id` — your own only

**"Message Seller" needed no new endpoint.** Every listing response already
includes `seller: { id, username, fullName, state }`, and Messaging's
`POST /messaging/conversations/:userId` already works with any user id — so
the frontend just calls that with `listing.seller.id`. Marketplace doesn't
import or depend on Messaging at all; they stay decoupled, which is exactly
why building Messaging generically (not "message about a listing" specifically)
paid off here.

### One more package needed for this module

```bash
npm i @nestjs/mapped-types
```
Used for `PartialType` in `UpdateListingDto`, so it doesn't have to repeat
every field from `CreateListingDto` by hand.

## Notifications

`NotificationsService` is called internally by Likes, Comments, Follows, and
Messaging — there's no endpoint to create one directly. It silently no-ops
for two cases so none of those callers need extra logic: notifying yourself
about your own action, and notification types the recipient has turned off.

- `GET /api/v1/notifications?cursor=` — cursor-paginated, newest first
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`
- `GET /api/v1/notifications/preferences` / `PATCH /api/v1/notifications/preferences`
  — `{ likes?, comments?, follows?, messages? }`, all booleans, all optional

**REST/poll-based for now, not real-time push.** The Messaging gateway's
`user:<id>` room pattern would extend cleanly to push notifications live too,
but that's a deliberate deferral, not an oversight — wanted this piece to be
small and certain rather than bigger and riskier. Frontend can poll
`unread-count` periodically or refetch on app foreground in the meantime.

## Explore

- `POST /api/v1/explore` — `{ name, category, description, state?, rating? }`.
  `state` defaults to the submitter's own. One rating/tip per entry, from
  whoever submitted it — the PRD's own wording calls multi-review aggregation
  an "eventually," not MVP scope, so that's not built here either.
- `GET /api/v1/explore?category=&state=&cursor=` — browse, cursor-paginated
- `GET /api/v1/explore/:id`

## Moderation

- `POST /api/v1/reports` — `{ targetType: 'POST' | 'USER', targetId, reason }`
- `POST /api/v1/users/:userId/block` / `DELETE /api/v1/users/:userId/block`
- `POST /api/v1/users/:userId/mute` / `DELETE /api/v1/users/:userId/mute`

Blocking and muting actually do something, not just recorded rows:

- **Feed** excludes posts from anyone you've blocked (either direction) or
  muted — enforced in `FeedService`, on every scope (National/State/Following).
- **Messaging** refuses to start a new conversation, or send in an existing
  one, between blocked users — checked in both `getOrCreateConversation` and
  `sendMessage`, since a block happening after a conversation already exists
  should still stop new messages.

"Delete your own post" was already built (`DELETE /posts/:id`, from the
social-core round) — nothing new needed there.

## Admin

Locked to `role: ADMIN` via `RolesGuard` — the first real use of that guard
since it was built in the foundation round.

- `GET /api/v1/admin/verifications` / `PATCH /api/v1/admin/verifications/:id/decision`
  — `{ decision: 'VERIFIED' | 'REJECTED' }`. This is the review step that's
  been sitting as "just edit the Supabase table" since the onboarding round —
  now a real endpoint, though editing the table directly still works fine too.
- `GET /api/v1/admin/reports` / `PATCH /api/v1/admin/reports/:id/decision`
  — `{ status: 'REVIEWED' | 'DISMISSED' }`
- `DELETE /api/v1/admin/posts/:id` — deletes any post, not just your own
  (separate from the regular delete, which still only allows your own)
- `PATCH /api/v1/admin/users/:id/deactivate` / `.../reactivate` — deactivating
  also revokes every active session immediately, not just future logins

**There is no endpoint to make someone an admin.** That's deliberate — a
self-serve or API-driven way to grant admin would be a real security hole.
Promote someone by editing their row's `role` to `ADMIN` directly in the
Supabase table editor. One operational catch: if that person already has a
valid access token from before the promotion, it still carries their old role
for up to 15 minutes (how long access tokens live) — they need to log out and
back in, or just wait it out, for the new role to take effect.

## Project files added this round

`package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, and
`.gitignore` didn't exist before this round — an honest gap in earlier
handoffs, now fixed. `npm install` has been run against this exact
`package.json` and resolves cleanly with no version conflicts. Full compilation
(`prisma generate` + `tsc`) could not be verified in the sandbox this was built
in — Prisma's query-engine binary downloads from `binaries.prisma.sh`, which
that environment can't reach — so run `npx prisma generate && npx tsc --noEmit`
yourself once you've cloned this locally, as a first check before anything else.
Everything from Auth through Explore has still had a careful manual line-by-line
review, and that pass did catch and fix two real issues (both in this round's
diff): a `strictNullChecks` typing gap in `CommentsService`, and an unset `lib`
in `tsconfig.json` that would have pulled in DOM types a backend has no
business with.

## Setup

1. `npm install` (see the package list you were given separately — this
   scaffold assumes those are already in `package.json`)
2. `npm i cookie-parser` and `npm i -D @types/cookie-parser` if not already added
3. Copy `.env.example` to `.env` and fill in real values
4. `npx prisma generate`
5. `npx prisma migrate dev --name init`
6. `npm run start:dev`

API docs will be at `http://localhost:4000/api/docs` once it's running.

## What's deliberately not here yet

- User roles are set at registration only as the default (`PROSPECTIVE_CORPER`).
  Role/state/interests get set by the onboarding module, which will `PATCH`
  the user record — matches the PRD's account-creation-then-onboarding flow.
- No verification fields (NYSC number, document URLs, batch/stream/PPA) on
  the User model yet. Those get added when we build the onboarding/verification
  module, alongside the admin review endpoints.
- No password reset flow yet — comes with the Resend integration.

## Auth flow, in short

- `POST /api/v1/auth/register` and `/login` return `{ accessToken }` in the
  response body and set an httpOnly refresh-token cookie scoped to `/api/v1/auth`.
- The frontend keeps the access token in memory (React state/context), not
  localStorage, and sends it as `Authorization: Bearer <token>`.
- When a request comes back 401 because the access token expired, call
  `POST /api/v1/auth/refresh` (the browser sends the cookie automatically) to
  get a new access token, then retry the original request.
- `POST /api/v1/auth/logout` revokes the refresh token and clears the cookie.

### Email verification and password reset

- `register` now also sends a 6-digit code by email (via Resend) and creates
  an `OtpCode` row. This is **non-blocking** — the user can use the app
  immediately, `emailVerified` is just a flag on their record.
- `POST /api/v1/auth/verify-email` — `{ email, code }`
- `POST /api/v1/auth/resend-verification` — `{ email }` (no-op, same response,
  if the email is already verified or doesn't exist — doesn't leak which)
- `POST /api/v1/auth/forgot-password` — `{ email }` — always returns the same
  generic message regardless of whether the email is registered
- `POST /api/v1/auth/reset-password` — `{ email, code, newPassword }` — also
  revokes every existing refresh token for that user, so a password change
  logs them out everywhere else

Codes expire in 15 minutes and are single-use (`consumed` flag on `OtpCode`).
