# NaijaCorper backend, patch 2

This patch adds profiles, marketplace trust, a full admin toolkit, groups, polls and hashtags, and fixes a long list of bugs found while checking the whole backend.

## How to apply

From the `backend` folder in PowerShell:

```powershell
Expand-Archive -Path .\naijacorper-patch-2.zip -DestinationPath . -Force
npx prisma migrate dev --name patch_2
npx prisma generate
npm run build
npm run start:dev
```

Notes:

- No `npm install` is needed. No new packages were added (the admin script uses `dotenv`, which already comes with `@nestjs/config`).
- No `.env` change is needed.
- `npx prisma migrate dev` creates one new migration. It only adds tables, columns and indexes. Nothing is dropped except one duplicate index. Existing users, posts and listings are kept.
- Four old files are replaced by empty placeholders (`admin.service.ts` and three old DTO files). They are harmless. You can delete them if you like: 
  `src/modules/admin/admin.service.ts`, `src/modules/admin/dto/report-decision.dto.ts`, `src/modules/admin/dto/verification-decision.dto.ts`, `src/modules/onboarding/dto/verification-document.dto.ts`.
- After migrating, run `docs/backfill.sql` once in the Supabase SQL editor. It gives the new verified badge to accounts that were already verified before this patch.
- For the live database, run `npm run prisma:migrate:deploy` once against the live `DATABASE_URL` (or make sure your Render start or build step already runs it), then run the backfill once.

## What is new

Profiles
- Public profile with bio, avatar and a verified badge: `GET /users/:username`
- Edit profile (name, username, bio, state): `PATCH /users/me`
- Avatar: `PATCH /users/me/avatar` (file field `file`), `DELETE /users/me/avatar`
- Followers and following lists: `GET /users/:username/followers`, `.../following`
- User search: `GET /users/search?q=`
- A person's posts: `GET /users/:username/posts`
- Delete your own account: `DELETE /users/me` (needs the password)

Marketplace
- Selling needs a verified email. Anyone with a verified email can sell.
- Photos must be uploaded first with `POST /uploads/listing-image`. Only those links are accepted.
- Keyword search, price and state filters: `GET /marketplace/listings?q=&minPrice=&maxPrice=&state=&category=`
- My listings: `GET /marketplace/listings/mine`
- Seller page: `GET /marketplace/sellers/:username` and `.../listings`
- Report a listing: `POST /marketplace/listings/:id/report`
- Admin can remove or restore a listing. The seller sees the removal reason, nobody else does.
- At most 20 active listings per seller, up to 6 photos each.

Verification (the badge)
- Needs a verified email first. The user uploads a document: `POST /onboarding/verification-document` (multipart: `documentType`, optional `note`, `file`). Check status with `GET /onboarding/verification`.
- Documents are stored privately. Only admins can open them, through a link that expires in 10 minutes. The file is deleted after the admin decides.
- One pending request at a time, at most 5 submissions in 30 days.
- The result shows as `isVerified` on the public profile. A pending or rejected request never shows publicly.

Admin
- See `docs/ADMIN_GUIDE.md`.

Groups, polls, hashtags
- Groups: create, join, leave, members, posts, edit, avatar, delete.
- Polls: add `poll: { options: [...], durationHours }` when creating a post, vote with `POST /posts/:id/poll/vote`.
- Hashtags: written in the post text. Trending, search, and posts by tag.

Also new
- Trending posts: `GET /feed/trending`
- Messaging unread count and mark-as-read.
- Notifications for verification results and removed content or listings.
- Change password and log out of all devices: `POST /auth/change-password`, `POST /auth/logout-all`.

## Fixes

Quick patch items
1. The verification document link expired after 15 minutes, so admins opened a dead link. The system now stores only the file's private id and makes a fresh 10-minute link each time an admin opens it.
2. The verified badge is now returned wherever a user appears (`isVerified`).

Security
3. The access token now holds only the user id. Role, active state and email-verified state are read from the database on every request, so deactivating an account or changing a role takes effect at once.
4. Refresh tokens rotate in one atomic step, so two tabs refreshing at the same time cannot both succeed. The cookie is cleared with the same settings it was set with.
5. Email codes are random, stored hashed, compared in constant time, allow 5 attempts, and every guess is counted atomically so parallel guessing cannot get extra tries.
6. Login takes the same time for unknown emails as for wrong passwords.
7. Image links on posts and listings must come from our own Cloudinary uploads.
8. Uploaded files are checked by their real contents, not their name, and have size limits.
9. Verification documents are private, and the admin gets a short-lived link instead of a permanent public one.
10. Production now refuses to start with a JWT secret shorter than 32 characters.
11. The onboarding journey-stage step used to overwrite a user's role. An admin could lose admin rights by going through it. It now leaves admin (and other special) roles alone.
12. Email and username were case-sensitive, so `Ada@x.com` and `ada@x.com` could be two accounts. They are now matched ignoring case, including for older accounts.
13. Admins cannot deactivate themselves or other admins, or change their own role. Every admin action is written to an audit log.

Correctness
14. Likes, follows, comment counts, poll votes, group member counts and listing limits are race-safe.
15. Pagination uses a stable cursor (time + id), so no item is skipped or repeated, and a deleted item no longer breaks the next page. A hand-made cursor gets a 400.
16. Deleting an account now fixes the counters on other people's posts, polls and groups, and removes plain reposts that would otherwise turn into empty posts.
17. A repost no longer shows content from someone who is deactivated or blocked, and you cannot repost around a block.
18. Seller edits can never bring back a listing that a moderator removed, even if they happen at the same moment.
19. Marking a sold item as available again counts against the 20-listing limit. Changing a listing to a category that needs photos no longer works without a photo.
20. Seller pages honour the `status` filter (available or sold, never removed).
21. Groups of a deactivated creator are hidden everywhere, creating a group needs a verified email, and a group name that looks like an id is refused.
22. Explore entries from deactivated users are hidden in the detail view too.
23. A message limit of 20 per 10 seconds now applies per user, not per socket.
24. Socket connections are authenticated before they are accepted, so a message sent immediately after connecting no longer fails.
25. Messages to blocked or deactivated users are refused. Starting the same chat from both sides at once no longer errors.

Crash fixes (these used to return a 500)
26. A null byte in a URL or in text.
27. `null` sent for a required field in a profile, listing or notification-settings update.
28. A hand-made pagination cursor.
29. Database validation errors now come back as a 400 instead of a 500.

Other
30. Email sending failures are now logged (without the code or full address) instead of disappearing.
31. FRONTEND_URL can list several sites separated by commas, for both the API and sockets.
32. The server shuts down cleanly on deploys, and trusts the Render proxy in production so rate limits are per real user IP.
33. Missing database indexes were added for comment replies, reposts and explore.

## What the frontend developer should know

- Response shapes of the existing lists did not change (`{ posts, nextCursor }`, `{ listings, nextCursor }` and so on). Cursors are now opaque strings. Always send back exactly what you received.
- Lists accept an optional `pageSize` from 1 to 50 (default 20).
- Actions that need a verified email return 403 with `code: "EMAIL_NOT_VERIFIED"`. Show a "verify your email" prompt.
- Public users now carry `isVerified` (boolean). Use it for the badge. `verificationStatus` is only for the person's own account.
- Verification changed: the old upload-a-link flow (`POST /uploads/verification-document`, then `POST /onboarding/verification-document` with `documentUrl`) is gone. It is now one multipart request to `POST /onboarding/verification-document`.
- Post images and listing photos: upload first, then send the returned URLs.
- Sockets: connect to `/messaging` with `auth: { token: <access token> }`. A bad or expired token gives a `connect_error`. Refresh the token and reconnect.
- Errors from validation are `400` with a `message` array. Block checks on content return `404`, and on actions return `403`.

## Known limits (not bugs, but good to know)

- Files uploaded to posts that are later deleted stay in Cloudinary. A clean-up job can be added later.
- Deleting an account that owns a group deletes that group and its posts.
- Someone who is blocked can work out that they are blocked from the `403` on actions like follow or like. Hiding that fully would need every action to return `404`.
- Follower and following counts on a profile can include deactivated accounts, while the lists leave them out.
- If Cloudinary fails at the moment a verification document should be deleted, the file stays until it is removed by hand.
- Two reposts of the same post sent at the exact same instant can both be saved.
- `#a#b` (hashtags with no space between) counts only `#a`.
- Payments are untouched, as agreed.
