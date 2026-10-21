# NaijaCorper Backend

The backend API for NaijaCorper, a social network for Nigerian corps members
(NYSC): feed, profiles, groups, polls, marketplace, explore, messaging,
notifications, moderation and an admin side.

Live API: https://api.naijacorper.com (all paths start with /api/v1)

## Stack

- Nest.js 10 with TypeScript
- Prisma 5 on Supabase Postgres
- Cloudinary for images, videos and verification documents
- Resend for email (verification and password reset codes)
- Socket.IO for live chat (namespace /messaging)
- Swagger for the API page
- Hosted on Render

## Where the documentation lives

This README covers setup and how the project is run. It does not list endpoints,
because a list written here goes out of date. Use these instead:

- Live API page: /api/docs (raw description: /api/docs-json, importable into Postman)
- docs/API_REFERENCE.md: every endpoint in plain language
- docs/openapi.json: a saved copy of the API description
- docs/ADMIN_GUIDE.md: the admin endpoints and how to run the admin side
- docs/PATCH_NOTES.md: what changed in each patch, and notes for the frontend
- docs/backfill.sql: one-time SQL that existing databases needed after patch 2

When endpoints change, update docs/API_REFERENCE.md and replace docs/openapi.json
with a fresh copy of /api/docs-json.

## Run it locally

You need Node 20 or newer and a filled-in `.env`.

```bash
npm install                  # installs packages and runs prisma generate
cp .env.example .env         # PowerShell: Copy-Item .env.example .env
npm run start:dev            # starts on http://localhost:4000 and restarts on every save
```

Then open http://localhost:4000/api/docs.

The database already has its tables. Only run `npx prisma migrate dev --name
what_changed` when you change `prisma/schema.prisma`, and commit the new folder
it creates under `prisma/migrations`. Never run `npx prisma migrate reset`
against a database that holds real data, because it erases everything.

## Environment variables

Set these in `.env` locally and in Render's Environment tab in production.
Never commit real values. The app refuses to start if a required one is missing.

| Name | Required | What it is |
|---|---|---|
| NODE_ENV | yes | development, production or test. Production turns on secure cookies and the proxy setting. |
| PORT | yes | Render sets this itself. Locally it is 4000. |
| DATABASE_URL | yes | Supabase transaction pooler (port 6543). Used by the running app. |
| DIRECT_URL | yes | Supabase session pooler (port 5432). Used only by Prisma migrations. |
| JWT_ACCESS_SECRET | yes | Signs access tokens. At least 32 characters in production. Use a different value for production than for local. |
| JWT_ACCESS_EXPIRES_IN | no | Default 15m. |
| JWT_REFRESH_EXPIRES_IN_DAYS | no | Default 30. |
| FRONTEND_URL | yes | The addresses allowed to call the API (CORS), separated by commas, for example https://naijacorper.com,https://www.naijacorper.com. It is not used to build links in emails. |
| COOKIE_DOMAIN | yes | The parent domain for the refresh cookie, naijacorper.com in production. The API and the frontend must both live under it. Locally: localhost. |
| CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | yes | From the Cloudinary dashboard. |
| RESEND_API_KEY | yes | A Resend key. A "sending access" key limited to the sending domain is enough. |
| RESEND_FROM_ADDRESS | yes | For example `NaijaCorper <noreply@mail.naijacorper.com>`. The domain must be verified in Resend. In Render, enter it without surrounding quotes. |

## Scripts

| Command | What it does |
|---|---|
| npm run start:dev | Local development: compiles, starts, and restarts on every change. |
| npm run build | Compiles to the dist folder. |
| npm run start | Runs the compiled app (node dist/main). This is what Render runs. |
| npm run prisma:migrate:deploy | Applies pending migrations. Safe to repeat. |
| npx prisma migrate status | Shows which migrations are applied. |
| npx ts-node src/scripts/create-admin.ts email username "Full Name" | Creates the first admin, or promotes an existing account. The password is typed at a hidden prompt. |

## How sign-in works

- Register and login return `{ accessToken }` in the body. It lives 15 minutes.
  Send it as `Authorization: Bearer <token>`.
- They also set an httpOnly refresh cookie (naijacorper_refresh). It is Secure,
  SameSite=None in production, and only sent to /api/v1/auth routes.
- When the access token expires, call POST /api/v1/auth/refresh. The browser sends
  the cookie by itself, so the frontend must send requests with credentials
  (fetch: credentials 'include', axios: withCredentials true). Refresh tokens
  rotate on every use.
- Logout revokes the refresh token. Changing or resetting a password logs the
  user out everywhere.
- Every route needs a login except the ones under /auth and /health.

## Email verification

Verification uses a 6-digit code, not a link. Register sends the code. The user
types it into the app, which calls POST /api/v1/auth/verify-email with the email
and the code. Codes last 15 minutes, work once, allow 5 wrong tries, and a new
one is not sent more than once a minute. Password reset works the same way.

Some actions need a verified email (posting media, selling, creating groups,
sending a verification document). They answer 403 with code EMAIL_NOT_VERIFIED.

If an email fails to send, the user still gets a normal answer and the problem is
logged. Search Render's logs for "Resend rejected".

## The first admin

There is no endpoint that makes someone an admin, on purpose. Run the
create-admin script (see Scripts). If the person already has a session, they must
log in again before the new role shows up.

## Deploying on Render

- Root Directory: backend
- Build Command: `npm install --include=dev && npx prisma migrate deploy && npm run build`
- Start Command: `npm run start`
- Health Check Path: /api/v1/health
- Environment: the variables above, with NODE_ENV=production
- Custom domain: api.naijacorper.com (a CNAME to the Render address)
- Pushing to the connected branch deploys automatically, and the build applies any
  new migrations. Commit the prisma/migrations folder or the database will not
  get the change.

The free Render plan sleeps when idle, which drops chat connections. Use a paid
instance for real traffic.

## Design decisions worth knowing

- The feed is read at query time with indexes, not pre-built per follower. This is
  the simple choice until write volume proves otherwise. The counters and indexes
  are already in place if that changes.
- Lists use cursor pagination. A cursor is an opaque string: clients send back
  exactly what they received.
- Chat uses REST for history and Socket.IO for live messages. Both call the same
  service code.
- Notifications are polled, not pushed.
- Verification documents are stored privately on Cloudinary and opened through
  links that expire after 10 minutes.
- No payments go through the platform. Buyers and sellers settle between
  themselves, and prices are whole Naira.
- The rate limiter and the chat flood limit keep their counts in memory. That is
  correct for one server. Running several servers would need a shared store such
  as Redis.
- A feed with scope STATE and no state set falls back to the national feed.

## Known limits

The full list is at the end of docs/PATCH_NOTES.md. The main ones: files from
deleted posts stay in Cloudinary, there is no scheduled clean-up (expired tokens
and old one-time codes are removed when the same person next signs in or asks for
a code, so only accounts that never come back leave rows behind), and there is no
post search (only users and hashtags).
