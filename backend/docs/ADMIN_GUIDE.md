# Admin guide

## How admins get their login

Admins are normal accounts with the role ADMIN. They log in the usual way (`POST /api/v1/auth/login`) and choose their own password. Nobody, including the developers, ever sees it.

There is no admin signup page and no way to make yourself an admin through the API. That is on purpose.

### The first admin (one time, from the backend folder)

```powershell
npx ts-node src/scripts/create-admin.ts you@example.com yourusername "Your Full Name"
```

- The script asks for the password twice. What you type is hidden, so it never lands in your command history or a file.
- The password needs at least 12 characters with an uppercase letter, a lowercase letter and a number.
- The email is marked as verified, so no email is sent.
- The script talks to whichever database `DATABASE_URL` points to. For the live site, run it once with the live `DATABASE_URL` in the environment:

```powershell
$env:DATABASE_URL = "<live pooled url>"
$env:DIRECT_URL = "<live direct url>"
npx ts-node src/scripts/create-admin.ts you@example.com yourusername "Your Full Name"
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL
```

- If the email already belongs to a normal account, that account is promoted and its password is not touched.
- Running it again for an existing admin does nothing.

### More admins later

1. The person signs up normally and verifies their email.
2. An existing admin calls `PATCH /api/v1/admin/users/:id/role` with `{ "role": "ADMIN", "reason": "..." }`.
3. The new admin logs in with the password they chose when they signed up.

The role change works on their next request. No new login is needed. Demoting works the same way (`{ "role": "SERVING_CORPER" }` and so on).

### Passwords

- Change: `POST /api/v1/auth/change-password`
- Forgot: `POST /api/v1/auth/forgot-password`, then `reset-password`
- Log out everywhere: `POST /api/v1/auth/logout-all`

## What an admin can do

Every route below needs an admin token. A normal user gets 403.

### Overview
- `GET /admin/stats`: user, post, listing and group totals, plus counts of what needs attention (pending reports, pending verifications).
- `GET /admin/audit-logs?action=&adminId=&targetType=&targetId=`: who did what, newest first.

### Users
- `GET /admin/users?q=&role=&status=active|inactive&verification=`: search by name, username or email.
- `GET /admin/users/:id`: full details, how many reports were made against and by them (and how many are still pending), and their latest verification request.
- `PATCH /admin/users/:id/deactivate` and `/reactivate` (optional `reason`). Deactivation takes effect immediately: the person is logged out of every device and their content disappears from feeds.
- `PATCH /admin/users/:id/role` `{ role, reason? }`. The target must be active with a verified email.
- `PATCH /admin/users/:id/verification` `{ status: VERIFIED | UNVERIFIED, reason? }`: give or take away the badge by hand.

### Verification requests
- `GET /admin/verifications?status=PENDING|VERIFIED|REJECTED|ALL`: pending ones come oldest first.
- `GET /admin/verifications/:id/document`: a private link that works for 10 minutes. Ask again if it expires.
- `PATCH /admin/verifications/:id/decision` `{ decision: VERIFIED | REJECTED, reason }`. A reason is required when rejecting, and the user sees it. The user gets a notification. The document file is deleted after the decision.

### Reports
- `GET /admin/reports?status=PENDING|REVIEWED|DISMISSED|ALL&targetType=POST|USER|COMMENT|LISTING|GROUP`
- `GET /admin/reports/:id`: the report, the reporter, and the reported content. A copy of the content taken when the report was made is included, so you can still see it if the person edits or deletes it.
- `PATCH /admin/reports/:id/decision` `{ status: REVIEWED | DISMISSED, action?: NONE | REMOVE_CONTENT | DEACTIVATE_USER, note? }`
  - `REMOVE_CONTENT` removes the reported post, comment, listing or group.
  - `DEACTIVATE_USER` deactivates the account that owns the reported content (or the reported user).
  - Other pending reports about the same item are closed with the same decision.
  - Admins cannot be deactivated this way.

### Content
- `GET /admin/posts?q=&authorId=&groupId=`, `GET /admin/posts/:id`, `DELETE /admin/posts/:id`
- `DELETE /admin/comments/:id`
- `GET /admin/listings?status=AVAILABLE|SOLD|REMOVED&q=&sellerId=`, `GET /admin/listings/:id`
- `PATCH /admin/listings/:id/remove` `{ reason }` (required; the seller is notified and sees it)
- `PATCH /admin/listings/:id/restore`
- `GET /admin/groups?q=`, `DELETE /admin/groups/:id`
- `DELETE /admin/explore/:id`

All delete and decision routes accept a `reason` or `note`, and all of them are written to the audit log.

## Rules the system enforces

- An admin cannot deactivate themselves or another admin.
- An admin cannot change their own role.
- A removed listing cannot be edited, re-listed or deleted by the seller.
- Every admin action is recorded with the admin, the time, the target and the reason.

## Suggested daily routine (for the dashboard UI)

1. Open the overview and look at "needs attention".
2. Work through pending verifications, oldest first.
3. Work through pending reports.
4. Use user search for anything that comes up in support.
