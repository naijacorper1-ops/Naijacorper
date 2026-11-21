# NaijaCorper backend, patch 3

This patch adds three modules: Opportunities, Events and PPA Reviews. It also adds their moderation tools for admins, new report targets, and automated tests.

## How to apply

From the `backend` folder in PowerShell:

```powershell
Expand-Archive -Path .\naijacorper-patch-3.zip -DestinationPath . -Force
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start:dev
```

Notes:

- No `npm install` is needed. No new packages were added.
- No `.env` change is needed.
- The migration is `prisma/migrations/20261120000000_opportunities_events_ppa_reviews`. It only adds enum values, notification columns, tables and indexes. Nothing is dropped, deleted or renamed, so existing users, posts, listings and groups are untouched.
- Commit the migration folder. Render runs `npx prisma migrate deploy` in its build command, so it applies the migration on the next deploy.
- Use `migrate deploy` (not `migrate dev`) so Prisma applies the migration exactly as shipped.
- Nothing needs to run against the live database by hand.

## Who may post what

| | Opportunities | Events | PPA reviews |
|---|---|---|---|
| Admin | Live at once | Live at once | Cannot review |
| Recruiter, business | Live at once (verified email needed) | Waits for approval (verified email needed) | Cannot review |
| Verified serving or ex corps member (verified badge and verified email) | Waits for approval | Waits for approval | Can review |
| Anyone else | 403 | 403 | 403 |

A 403 from these routes has a `code` the frontend can use:

- `EMAIL_NOT_VERIFIED`: ask the person to verify their email.
- `VERIFICATION_REQUIRED`: a corps member who has no verified badge yet. Send them to the verification flow.
- `ROLE_NOT_ALLOWED`: this role cannot do it.

## What is new

Opportunities (jobs, internships, freelance, scholarships, grants, training, competitions, business, networking, other)
- `POST /opportunities`, `GET /opportunities`, `GET /opportunities/mine`, `GET /opportunities/:id`
- `PATCH /opportunities/:id`, `PATCH /opportunities/:id/status` (`OPEN` or `CLOSED`), `DELETE /opportunities/:id`
- List filters: `type`, `state`, `mode`, `employmentType`, `q`. Newest first.
- The public list shows only OPEN opportunities from active people, whose deadline has not passed.
- Statuses: `PENDING`, `OPEN`, `CLOSED`, `REJECTED`, `REMOVED`.

Events
- `POST /events`, `GET /events`, `GET /events/mine`, `GET /events/going`, `GET /events/:id`
- `PATCH /events/:id`, `POST /events/:id/cancel`, `DELETE /events/:id`
- `POST /events/:id/rsvp`, `DELETE /events/:id/rsvp`, `GET /events/:id/attendees`
- Cover image: upload with `POST /uploads/event-cover` (file field `file`), then send the returned URL as `coverImageUrl`.
- List filters: `category`, `state`, `format`, `when` (`upcoming` is the default, `past`, `all`), `q`. Upcoming events are soonest first.
- Statuses: `PENDING`, `PUBLISHED`, `REJECTED`, `CANCELLED`, `REMOVED`.

PPA reviews
- `GET /ppas` (filters `q`, `state`, `sector`), `GET /ppas/suggest?q=&state=`, `GET /ppas/:id`, `GET /ppas/:id/reviews`
- `GET /ppas/reviews/mine`, `POST /ppas/reviews`, `PATCH /ppas/reviews/:reviewId`, `DELETE /ppas/reviews/:reviewId`

Admin
- Queues, decisions, removal and restore for opportunities and events, and removal of PPA reviews. See `docs/ADMIN_GUIDE.md`.
- `GET /admin/stats` has new counts. The existing keys did not change.
- Reports can now target `OPPORTUNITY`, `EVENT` and `PPA_REVIEW`.

Also changed
- Notifications have new types (`OPPORTUNITY_APPROVED`, `OPPORTUNITY_REJECTED`, `EVENT_APPROVED`, `EVENT_REJECTED`, `EVENT_CANCELLED`) and carry `eventId` or `opportunityId` where relevant. They have no on and off switch in notification settings.
- Deleting an account now also removes the person's PPA reviews (and recalculates the PPA ratings), takes them off event guest lists (and fixes the counts), and deletes their event cover images.

## Rules worth knowing

Approval and visibility
- A pending or rejected item, and a removed opportunity or event, returns 404 to everyone except the person who made it and admins.
- A closed opportunity and a cancelled event can still be opened by link, but they are left out of the public lists.
- Editing: a corps member's opportunity, or any event made by a non-admin, goes back to PENDING after an edit. A recruiter's or business's opportunity does not. Editing a rejected item sends it back for review. Admin edits never do. A removed item cannot be edited by its owner.
- Limits per person: opportunities, 10 waiting for review and 50 live. Events, 10 waiting for review and 30 upcoming.

Opportunities
- `deadline` can be a date (`2026-12-31`, counted to the end of that day in Nigerian time) or a full date and time.
- `state` is optional. Leave it out for remote or nationwide opportunities. The `state` filter on the list is an exact match.
- `applyUrl` must be an https link. `applyEmail` is optional.
- On `PATCH`, send `null` to clear an optional field.

Events
- `startsAt` and `endsAt` need the offset, for example `2026-12-05T14:00:00+01:00`. The start must be in the future, the end after the start, and an event can be at most 30 days long.
- `state` is required unless the format is `VIRTUAL`.
- `organizerName` shows as "by ...". If it is left out, the creator's full name is used.
- The meeting link is shown to everyone who can see the event. Do not use it for anything private.
- Going is `POST /events/:id/rsvp`, not going is `DELETE /events/:id/rsvp`. Both return `{ going, rsvpCount }`. Saying you are going twice gives 409. Leaving when you were not going is harmless. RSVP to an ended or cancelled event gives 409.
- The full guest list (`/attendees`) is only for the creator and admins. Everyone else gets `rsvpCount` and `viewerRsvp` on the event.
- Cancelling an event tells everyone who said they are going.
- An event can only be deleted while it is PENDING, REJECTED or CANCELLED. Cancel a published event first.

PPA reviews
- Only verified corps members with a verified email can review.
- One review per person per PPA. A second one gives 409. Edit the first instead.
- Anonymous is the default. `authorId` is never returned. The `author` object is only there when the author chose to be named (`isAnonymous: false`). The author sees their own review through `isMine: true`.
- To review a PPA that exists, send `ppaId` (find it with `/ppas/suggest`). To review a new one, send `name` and `state`. PPAs are matched by a cleaned-up name plus state, so "The Ministry of Works Ltd" and "ministry of works" are the same PPA.
- A PPA with no reviews is left out of `GET /ppas`, but can still be opened by id.
- `GET /ppas` is ordered by `lastReviewedAt`, newest first. There is no "top rated" sort yet.
- Ratings: `overallRating` is 1 to 5. `environment` and `staffRelationship` are `POOR`, `FAIR`, `GOOD`, `EXCELLENT`. `learning` and `workload` are `LOW`, `MODERATE`, `HIGH`. A PPA shows the average (one decimal) and a word for each. The word comes from the exact average.
- Blocking: a review that is named is hidden from someone who blocked its author. Anonymous reviews are never hidden this way, because hiding them would show who wrote them.

## What the frontend developer should know

- All new routes need the access token in `Authorization: Bearer <token>`, like the rest of the API. Response shapes follow the existing pattern: `{ opportunities, nextCursor }`, `{ events, nextCursor }`, `{ reviews, nextCursor }`, and `{ attendees, total, nextCursor }`. Cursors are opaque. Send back exactly what you received. `pageSize` is 1 to 50.
- Every opportunity and event has `isMine`. Events also have `viewerRsvp` and `rsvpCount`. Use `isMine` to show Edit and Cancel buttons.
- Only the owner and admins see `rejectionReason`, `removedReason`, `removedAt` and `reviewedAt`. Show the reason to the owner on a rejected item, with a note that editing sends it for review again.
- After creating or editing, check `status`. `PENDING` means "submitted, waiting for review". `OPEN` or `PUBLISHED` means it is live.
- Validation errors are 400 with a `message` array. Limits and clashes are 409. Hidden or missing items are 404.
- The event and opportunity `GET /:id` routes return 404 for items the viewer is not allowed to see, so a pending item opened by the wrong person looks like a missing one.
- Admin screens: the queues are `GET /admin/opportunities?status=PENDING` and `GET /admin/events?status=PENDING` (oldest first). Decide with `PATCH .../decision` `{ decision, reason }`.

## Tests

- `npm test` runs the unit tests. They need no database.
- `npm run test:e2e` runs the end-to-end tests. They need a separate empty test database. The tests refuse to run unless `TEST_DATABASE_URL` is set and the database name contains "test", so they cannot touch live data. See `test/README.md`.

## Known limits (not bugs, but good to know)

- Two people can create the same PPA under slightly different spellings that the name cleaning does not catch (for example an abbreviation). There is no merge tool yet. One can be added later.
- Reminders, notifications about new opportunities, and in-app application tracking are not part of this patch.
- Cover images of events that an admin removes stay in Cloudinary until the owner deletes the event.
- Event notifications to a big guest list are written in batches. A cancelled event with thousands of guests can take a moment.
