# NaijaCorper API reference

This file is generated from the live API description (`/api/docs`). The same information is available as a Postman-ready file in `docs/openapi.json`.

Backend API for NaijaCorper. All paths start with **/api/v1**.

## Signing in
1. Call **POST /auth/register** or **POST /auth/login**. You get an `accessToken` (valid 15 minutes) and a refresh cookie.
2. Send the token on every request: `Authorization: Bearer <accessToken>`. In this page, press **Authorize** and paste it.
3. When it expires (401), call **POST /auth/refresh**. The browser sends the cookie by itself, so use `credentials: 'include'` (axios: `withCredentials: true`). You get a new token.

## Verified email
Posting media, selling, creating groups and sending a verification document need a verified email. Those calls answer **403** with `code: "EMAIL_NOT_VERIFIED"`. Show a "verify your email" prompt. Codes are sent by **POST /auth/register** and **POST /auth/resend-verification**.

## Lists and pages
List calls take `pageSize` (1 to 50, default 20) and `cursor`. The answer has a `nextCursor`. Send it back unchanged to get the next page. `null` means there are no more pages. Never build or edit a cursor yourself.

## Errors
Errors look like `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`. For validation errors `message` is a list of texts. Common codes: 400 wrong input, 401 not signed in or token expired, 403 not allowed, 404 not found (also used when someone blocked you), 409 already exists, 429 too many requests.

## Photos, videos and files
Upload first, then send the returned `url` where it is needed (post `mediaUrls`, listing `imageUrls`). Only links from our own uploads are accepted. Uploads are multipart form data with the file in a field named **file**.

## Real-time chat (Socket.IO, not shown below)
Connect to the **/messaging** namespace with `auth: { token: <accessToken> }`. A bad or expired token gives a `connect_error`: refresh the token and connect again.
- Send: emit `sendMessage` with `{ conversationId, content }` (content 1 to 2000 characters). The acknowledgement is the saved message.
- Receive: listen for `newMessage`.
- Problems arrive on the `exception` event. Sending more than 20 messages in 10 seconds is refused.

## Importing into Postman

1. Postman, Import, choose the file `docs/openapi.json` (or paste `http://localhost:4000/api/docs-json` while the server is running, or the live address once deployed).
2. Open the new collection, Variables tab: set `baseUrl` to your server (for example `http://localhost:4000`).
3. Collection, Authorization tab: type Bearer Token, paste the `accessToken` you got from login.
4. Postman keeps cookies by itself, so `refresh` works after `login` in the same session.


## health

Is the server up.


### GET /health

**Check that the server is running**  
Public


Possible errors: 429


## auth

Sign up, sign in, tokens, email codes and passwords.


### POST /auth/register

**Create an account and get tokens. A verification code is emailed**  
Public


Password: 8 to 128 characters with an uppercase letter, a lowercase letter and a number. Username: 3 to 20 characters, lowercase letters, numbers and underscores. The response is `{ accessToken }` and a refresh cookie is set.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string (up to 254 chars) | yes |  |
| `username` | string | yes |  |
| `fullName` | string (2 to 80 chars) | yes |  |
| `password` | string | yes |  |

Possible errors: 400, 429


### POST /auth/login

**Sign in and get tokens**  
Public


Response: `{ accessToken }`. The refresh cookie is set by the server. Email is not case sensitive.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes |  |
| `password` | string (up to 128 chars) | yes |  |

Possible errors: 400, 429


### POST /auth/refresh

**Get a new access token using the refresh cookie**  
Public


No body. Needs the refresh cookie. Each refresh gives a new cookie, so always use the latest one. Response: `{ accessToken }`.


Possible errors: 429


### POST /auth/logout

**Sign out of this device**  
Public


Possible errors: 429


### POST /auth/logout-all

**Sign out of every device**  
Needs sign in


Possible errors: 401, 429


### POST /auth/change-password

**Change your password (signs out other devices)**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `currentPassword` | string (up to 128 chars) | yes |  |
| `newPassword` | string | yes |  |

Possible errors: 400, 401, 429


### POST /auth/verify-email

**Confirm your email with the 6-digit code**  
Public


The code lasts 15 minutes and allows 5 tries. After that, ask for a new code.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes |  |
| `code` | string (exactly 6 chars) | yes |  |

Possible errors: 400, 429


### POST /auth/resend-verification

**Send a new verification code (one per minute)**  
Public


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes |  |

Possible errors: 400, 429


### POST /auth/forgot-password

**Email a password reset code**  
Public


Always answers the same way, whether or not the email exists.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes |  |

Possible errors: 400, 429


### POST /auth/reset-password

**Set a new password with the reset code**  
Public


Also marks the email as verified and signs the person out everywhere.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes |  |
| `code` | string (exactly 6 chars) | yes |  |
| `newPassword` | string | yes |  |

Possible errors: 400, 429


## users

Profiles, search, followers, avatar and account deletion.


### GET /users/me

**Get your own account and profile**  
Needs sign in


Possible errors: 401, 429


### PATCH /users/me

**Edit your profile (name, username, bio, state)**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | string | no |  |
| `fullName` | string (2 to 80 chars) | no |  |
| `bio` | string (up to 300 chars) | no |  |
| `state` | string | no |  |

Possible errors: 400, 401, 429


### DELETE /users/me

**Delete your account permanently (needs your password)**  
Needs sign in


Body: `{ "password": "..." }`. Admin accounts cannot be deleted here. This cannot be undone.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `password` | string (up to 128 chars) | yes |  |

Possible errors: 400, 401, 429


### PATCH /users/me/avatar

**Set your profile picture**  
Needs sign in


JPG, PNG or WebP up to 5 MB. It is cropped to a square.


Body (multipart form data):

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | JPG, PNG or WebP, up to 5 MB |

Possible errors: 400, 401, 429


### DELETE /users/me/avatar

**Remove your profile picture**  
Needs sign in


Possible errors: 401, 429


### GET /users/search

**Search people by username or name**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `q` | string (2 to 50 chars) | yes |  |

Possible errors: 400, 401, 429


### GET /users/{username}

**Public profile of a user**  
Needs sign in


Includes `isVerified` (the badge), follower counts and whether you follow them. Returns 404 for deactivated accounts and for people who blocked you.


Path: `username`


Possible errors: 400, 401, 404, 429


### GET /users/{username}/posts

**A user's posts, newest first**  
Needs sign in


Path: `username`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### GET /users/{username}/followers

**A user's followers**  
Needs sign in


Path: `username`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### GET /users/{username}/following

**People a user follows**  
Needs sign in


Path: `username`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### GET /users/me/blocked

**People you have blocked**  
Needs sign in


Possible errors: 401, 429


### GET /users/me/muted

**People you have muted**  
Needs sign in


Possible errors: 401, 429


### POST /users/{userId}/block

**Block a user (also removes follows both ways)**  
Needs sign in


Path: `userId`


Possible errors: 400, 401, 404, 429


### DELETE /users/{userId}/block

**Unblock a user**  
Needs sign in


Path: `userId`


Possible errors: 400, 401, 404, 429


### POST /users/{userId}/mute

**Mute a user (hide their posts from your feed, privately)**  
Needs sign in


Path: `userId`


Possible errors: 400, 401, 404, 429


### DELETE /users/{userId}/mute

**Unmute a user**  
Needs sign in


Path: `userId`


Possible errors: 400, 401, 404, 429


### POST /users/{userId}/follow

**Follow a user**  
Needs sign in


Path: `userId`


Possible errors: 400, 401, 404, 429


### DELETE /users/{userId}/follow

**Unfollow a user**  
Needs sign in


Path: `userId`


Possible errors: 400, 401, 404, 429


## onboarding

Journey stage, NYSC details and the verification badge.


### PATCH /onboarding/journey-stage

**Choose your NYSC journey stage**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `stage` | one of: PREPARING, SERVING, COMPLETED | yes |  |

Possible errors: 400, 401, 429


### PATCH /onboarding/prospective-details

**Save details for someone waiting for call-up**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `nyscStage` | one of: WAITING_MOBILIZATION, WAITING_CALLUP, WAITING_DEPLOYMENT, RECEIVED_CALLUP, PREPARING_CAMP, OTHER | yes |  |
| `state` | string | no |  |
| `interests` | one of: NYSC_UPDATES, ORIENTATION_CAMP, RELOCATION, ACCOMMODATION, JOBS, BUSINESS, TECHNOLOGY, NETWORKING, MAKING_FRIENDS, NYSC_TIPS, CAREER_OPPORTUNITIES | yes |  |

Possible errors: 400, 401, 429


### PATCH /onboarding/serving-details

**Save details for a serving corps member**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `state` | string | yes |  |
| `lga` | string (1 to 80 chars) | yes |  |
| `batch` | string (1 to 20 chars) | yes |  |
| `stream` | string (1 to 20 chars) | yes |  |
| `ppa` | string (up to 120 chars) | no |  |
| `interests` | one of: COMMUNITY, JOBS, ACCOMMODATION, MARKETPLACE, EXPLORE, EVENTS, BUSINESS, PROFESSIONAL_NETWORKING, TECHNOLOGY, ENTREPRENEURSHIP, CAREER_DEVELOPMENT | yes |  |

Possible errors: 400, 401, 429


### POST /onboarding/verification-document

**Submit a document to get the verified badge**  
Needs sign in


Needs a verified email. Send as multipart form data: `file` (PDF, JPG, PNG or WebP, up to 10 MB), `documentType` and an optional `note`. One pending request at a time, at most 5 in 30 days. The file is private and deleted after an admin decides. The badge shows as `isVerified` on public profiles only after approval.


Body (multipart form data):

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | PDF, JPG, PNG or WebP, up to 10 MB |
| `documentType` | one of: NYSC_ID_CARD, CALL_UP_LETTER, DISCHARGE_CERTIFICATE, OTHER | no | What the document is (optional, defaults to OTHER) |
| `note` | string | no | Anything the reviewer should know (optional, up to 300 characters) |

Possible errors: 400, 401, 403, 429


### GET /onboarding/verification

**Status of your verification request**  
Needs sign in


Possible errors: 401, 429


## posts

Create, read and delete posts, reposts, polls.


### POST /posts

**Create a post, quote, repost or poll**  
Needs sign in


Send text, `mediaUrls` (from the upload endpoint), `repostOfId` (repost or quote), `groupId` (post inside a group) or a `poll` ({ options: 2 to 4, durationHours: 1 to 168 }). Hashtags are taken from the text (up to 10). A post needs text, media or a repost. A poll needs its question as the post text, and a repost cannot have a poll.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string (up to 2000 chars) | no |  |
| `mediaUrls` | list of string | no |  |
| `repostOfId` | string | no |  |
| `groupId` | string | no |  |
| `poll` | CreatePollDto | no |  |

Possible errors: 400, 401, 429


### GET /posts/{id}

**Get one post**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


### DELETE /posts/{id}

**Delete your post (a group owner can delete posts in their group)**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


### POST /posts/{id}/poll/vote

**Vote in a poll (one vote per person)**  
Needs sign in


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `optionId` | string | yes |  |

Possible errors: 400, 401, 404, 429


### POST /posts/{postId}/like

**Like a post**  
Needs sign in


Path: `postId`


Possible errors: 400, 401, 404, 429


### DELETE /posts/{postId}/like

**Remove your like**  
Needs sign in


Path: `postId`


Possible errors: 400, 401, 404, 429


### POST /posts/{postId}/comments

**Comment on a post, or reply to a comment**  
Needs sign in


Path: `postId`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string (1 to 1000 chars) | yes |  |
| `parentId` | string | no |  |

Possible errors: 400, 401, 404, 429


### GET /posts/{postId}/comments

**Top-level comments on a post**  
Needs sign in


Path: `postId`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### GET /posts/{postId}/comments/{commentId}/replies

**Replies to a comment**  
Needs sign in


Path: `postId`, `commentId`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### DELETE /posts/{postId}/comments/{commentId}

**Delete your comment**  
Needs sign in


Path: `postId`, `commentId`


Possible errors: 400, 401, 404, 429


## feed

The home feed and trending posts.


### GET /feed

**Home feed (all, your state, or people you follow)**  
Needs sign in


`scope`: NATIONAL (default), STATE (use `state`, or your own state if you leave it out) or FOLLOWING (you and the people you follow).


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |
| `scope` | one of: NATIONAL, STATE, FOLLOWING | no |  |
| `state` | string | no |  |

Possible errors: 400, 401, 429


### GET /feed/trending

**Trending posts from the last days**  
Needs sign in


Possible errors: 401, 429


## notifications

Notification list and settings.


### GET /notifications

**Your notifications, newest first**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 429


### GET /notifications/unread-count

**Number of unread notifications**  
Needs sign in


Possible errors: 401, 429


### PATCH /notifications/read-all

**Mark all notifications as read**  
Needs sign in


Possible errors: 401, 429


### GET /notifications/preferences

**Your notification settings**  
Needs sign in


Possible errors: 401, 429


### PATCH /notifications/preferences

**Change your notification settings**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `likes` | boolean | no |  |
| `comments` | boolean | no |  |
| `follows` | boolean | no |  |
| `messages` | boolean | no |  |

Possible errors: 400, 401, 429


### PATCH /notifications/{id}/read

**Mark one notification as read**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


## messaging

Private conversations and messages.


### POST /messaging/conversations/{userId}

**Start a conversation with a user (or get the existing one)**  
Needs sign in


Returns the existing conversation if there is one. Not possible with yourself, with deactivated users or when either of you blocked the other.


Path: `userId`


Possible errors: 400, 401, 404, 429


### GET /messaging/conversations

**Your inbox, most recent first**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 429


### GET /messaging/unread-count

**Total unread messages**  
Needs sign in


Possible errors: 401, 429


### GET /messaging/conversations/{conversationId}/messages

**Messages in a conversation, newest first**  
Needs sign in


Path: `conversationId`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### POST /messaging/conversations/{conversationId}/messages

**Send a message**  
Needs sign in


Path: `conversationId`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string (1 to 2000 chars) | yes |  |

Possible errors: 400, 401, 404, 429


### PATCH /messaging/conversations/{conversationId}/read

**Mark the conversation as read**  
Needs sign in


Path: `conversationId`


Possible errors: 400, 401, 404, 429


## marketplace

Classified listings. There are no payments, buyers contact sellers in chat.


### POST /marketplace/listings

**Create a listing**  
Needs sign in


Needs a verified email. At least one photo is required, except for the SERVICES category. At most 6 photos and 20 available listings per seller. Price is a whole number in naira from 0 to 1,000,000,000.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `category` | one of: PHONES, LAPTOPS, ELECTRONICS, FURNITURE, FASHION, BOOKS, KITCHEN_ITEMS, VEHICLES, ACCOMMODATION, SERVICES | yes |  |
| `title` | string (3 to 120 chars) | yes |  |
| `description` | string (10 to 2000 chars) | yes |  |
| `price` | number (0 to 1000000000) | yes |  |
| `state` | string | no |  |
| `imageUrls` | list of string | no |  |

Possible errors: 400, 401, 403, 429


### GET /marketplace/listings

**Browse and search listings**  
Needs sign in


Only available listings from active sellers. `q` searches title and description.


| Query | Type | Required | Notes |
|---|---|---|---|
| `category` | one of: PHONES, LAPTOPS, ELECTRONICS, FURNITURE, FASHION, BOOKS, KITCHEN_ITEMS, VEHICLES, ACCOMMODATION, SERVICES | no |  |
| `state` | string | no |  |
| `q` | string (up to 60 chars) | no |  |
| `minPrice` | number (0 to 1000000000) | no |  |
| `maxPrice` | number (0 to 1000000000) | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 429


### GET /marketplace/listings/mine

**Your own listings (any status)**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: AVAILABLE, SOLD, REMOVED | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 429


### GET /marketplace/sellers/{username}

**A seller's profile**  
Needs sign in


Path: `username`


Possible errors: 400, 401, 404, 429


### GET /marketplace/sellers/{username}/listings

**A seller's listings (available or sold)**  
Needs sign in


Path: `username`


| Query | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: AVAILABLE, SOLD, REMOVED | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### GET /marketplace/listings/{id}

**Get one listing**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


### PATCH /marketplace/listings/{id}

**Edit your listing**  
Needs sign in


Photos already on the listing can be sent back as they are. New photos must come from the upload endpoint. A listing removed by a moderator cannot be changed.


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `category` | one of: PHONES, LAPTOPS, ELECTRONICS, FURNITURE, FASHION, BOOKS, KITCHEN_ITEMS, VEHICLES, ACCOMMODATION, SERVICES | no |  |
| `imageUrls` | list of string (up to 600 chars) | no |  |
| `title` | string (3 to 120 chars) | no |  |
| `description` | string (10 to 2000 chars) | no |  |
| `price` | number (0 to 1000000000) | no |  |
| `state` | string | no |  |

Possible errors: 400, 401, 403, 404, 429


### DELETE /marketplace/listings/{id}

**Delete your listing**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


### PATCH /marketplace/listings/{id}/status

**Mark your listing available or sold**  
Needs sign in


Moving a sold listing back to AVAILABLE counts against the limit of 20.


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: AVAILABLE, SOLD | yes |  |

Possible errors: 400, 401, 404, 429


### POST /marketplace/listings/{id}/report

**Report a listing**  
Needs sign in


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (3 to 500 chars) | yes |  |

Possible errors: 400, 401, 404, 429


## explore

Community tips about places (food, markets, spots).


### POST /explore

**Share a tip about a place**  
Needs sign in


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `category` | one of: ACCOMMODATION, FOOD, RESTAURANTS, MAMI_MARKET, TRANSPORT, HOSPITALS, PHARMACIES, ATMS, CYBERCAFES, PRINTING_SERVICES, MARKETS, NYSC_LOCATIONS, ORIENTATION_CAMPS, SECRETARIATS, PPAS, EVENTS, OTHER | yes |  |
| `name` | string (2 to 120 chars) | yes |  |
| `description` | string (3 to 1000 chars) | yes |  |
| `state` | string | no |  |
| `rating` | number (1 to 5) | no |  |

Possible errors: 400, 401, 429


### GET /explore

**Browse tips by category, state or keyword**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `category` | one of: ACCOMMODATION, FOOD, RESTAURANTS, MAMI_MARKET, TRANSPORT, HOSPITALS, PHARMACIES, ATMS, CYBERCAFES, PRINTING_SERVICES, MARKETS, NYSC_LOCATIONS, ORIENTATION_CAMPS, SECRETARIATS, PPAS, EVENTS, OTHER | no |  |
| `state` | string | no |  |
| `q` | string (up to 60 chars) | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 429


### GET /explore/{id}

**Get one tip**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


### DELETE /explore/{id}

**Delete your tip**  
Needs sign in


Path: `id`


Possible errors: 400, 401, 404, 429


## groups

Groups people can join and post in.


### POST /groups

**Create a group**  
Needs sign in


Needs a verified email. You become the owner. At most 10 groups per person. The slug is made from the name.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string (3 to 60 chars) | yes |  |
| `description` | string (up to 500 chars) | no |  |
| `state` | string | no |  |

Possible errors: 400, 401, 403, 429


### GET /groups

**Browse and search groups**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |
| `q` | string (up to 60 chars) | no |  |
| `state` | string | no |  |

Possible errors: 400, 401, 429


### GET /groups/mine

**Groups you belong to**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 429


### GET /groups/{group}

**Get a group by id or slug**  
Needs sign in


Path: `group`


Possible errors: 400, 401, 404, 429


### PATCH /groups/{group}

**Edit a group (owner only)**  
Needs sign in


Path: `group`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string (up to 500 chars) | no |  |
| `state` | string | no |  |

Possible errors: 400, 401, 404, 429


### DELETE /groups/{group}

**Delete a group (owner only)**  
Needs sign in


Path: `group`


Possible errors: 400, 401, 404, 429


### PATCH /groups/{group}/avatar

**Set the group picture (owner only)**  
Needs sign in


JPG, PNG or WebP up to 5 MB. It is cropped to a square.


Path: `group`


Body (multipart form data):

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | JPG, PNG or WebP, up to 5 MB |

Possible errors: 400, 401, 404, 429


### POST /groups/{group}/join

**Join a group**  
Needs sign in


Path: `group`


Possible errors: 400, 401, 404, 429


### DELETE /groups/{group}/leave

**Leave a group**  
Needs sign in


Path: `group`


Possible errors: 400, 401, 404, 429


### GET /groups/{group}/members

**Members of a group**  
Needs sign in


Path: `group`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


### GET /groups/{group}/posts

**Posts inside a group**  
Needs sign in


Path: `group`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


## hashtags

Trending tags, tag search and posts by tag.


### GET /hashtags/trending

**Trending hashtags this week**  
Needs sign in


Possible errors: 401, 429


### GET /hashtags/search

**Search hashtags by name**  
Needs sign in


| Query | Type | Required | Notes |
|---|---|---|---|
| `q` | string (1 to 51 chars) | yes |  |

Possible errors: 400, 401, 429


### GET /hashtags/{tag}/posts

**Posts that use a hashtag**  
Needs sign in


Path: `tag`


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 404, 429


## uploads

File uploads. Upload first, then use the returned url.


### POST /uploads/post-media

**Upload a photo or short video for a post**  
Needs sign in


Needs a verified email. Photos (JPG, PNG, GIF, WebP) up to 15 MB, or short videos (MP4, MOV). Response: `{ "url": "..." }`.


Body (multipart form data):

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | Photo (JPG, PNG, GIF, WebP) or video (MP4, MOV), up to 15 MB |

Possible errors: 400, 401, 403, 429


### POST /uploads/listing-image

**Upload a photo for a marketplace listing**  
Needs sign in


Needs a verified email. JPG, PNG, GIF or WebP up to 8 MB. Response: `{ "url": "..." }`.


Body (multipart form data):

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | JPG, PNG, GIF or WebP, up to 8 MB |

Possible errors: 400, 401, 403, 429


## reports

Report a post, user, comment, listing or group.


### POST /reports

**Report a post, user, comment, listing or group**  
Needs sign in


Reasons are free text (up to 500 characters). You cannot report yourself, and a repeat report of the same item is refused.


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `targetType` | one of: POST, USER, COMMENT, LISTING, GROUP | yes |  |
| `targetId` | string (up to 64 chars) | yes |  |
| `reason` | string (3 to 500 chars) | yes |  |

Possible errors: 400, 401, 429


## admin

Admin tools. Every call needs an admin account.


### GET /admin/stats

**Overview numbers and what needs attention**  
Admin only


Possible errors: 401, 403, 429


### GET /admin/audit-logs

**Record of admin actions**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |
| `action` | string (up to 60 chars) | no |  |
| `adminId` | string | no |  |
| `targetType` | string (up to 40 chars) | no |  |
| `targetId` | string (up to 64 chars) | no |  |

Possible errors: 400, 401, 403, 429


### GET /admin/users

**Search and list users**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `role` | one of: PROSPECTIVE_CORPER, SERVING_CORPER, EX_CORPER, BUSINESS, RECRUITER, ADMIN | no |  |
| `status` | one of: active, inactive | no |  |
| `verification` | one of: UNVERIFIED, PENDING, VERIFIED, REJECTED | no |  |
| `q` | string (up to 80 chars) | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 403, 429


### GET /admin/users/{id}

**Full details of a user**  
Admin only


Path: `id`


Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/users/{id}/deactivate

**Deactivate an account (signs the person out everywhere)**  
Admin only


You cannot deactivate yourself or another admin.


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/users/{id}/reactivate

**Reactivate an account**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/users/{id}/role

**Change a role (for example make someone an admin)**  
Admin only


The person must be active with a verified email. You cannot change your own role. The change works on their next request.


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `role` | one of: PROSPECTIVE_CORPER, SERVING_CORPER, EX_CORPER, BUSINESS, RECRUITER, ADMIN | yes |  |
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/users/{id}/verification

**Give or remove the verified badge by hand**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: VERIFIED, UNVERIFIED | yes |  |
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### GET /admin/verifications

**Verification requests (the PENDING queue by default, oldest first)**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: PENDING, VERIFIED, REJECTED, ALL | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 403, 429


### GET /admin/verifications/{id}/document

**Get a private link to the document (works 10 minutes)**  
Admin only


Path: `id`


Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/verifications/{id}/decision

**Approve or reject a verification request**  
Admin only


A reason is required when rejecting and the person can read it. They get a notification. The document file is deleted after the decision.


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | one of: VERIFIED, REJECTED | yes |  |
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### GET /admin/reports

**Reports, with filters**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: PENDING, REVIEWED, DISMISSED, ALL | no |  |
| `targetType` | one of: POST, USER, COMMENT, LISTING, GROUP | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 403, 429


### GET /admin/reports/{id}

**One report with the reported content**  
Admin only


Includes a copy of the content taken when the report was made, so it can still be read if it was edited or deleted since.


Path: `id`


Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/reports/{id}/decision

**Close a report and optionally act on the content or user**  
Admin only


`status`: REVIEWED or DISMISSED. `action` (optional): NONE, REMOVE_CONTENT (removes the reported post, comment, listing or group) or DEACTIVATE_USER (the owner of the content, or the reported user). Other open reports about the same item are closed too.


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: REVIEWED, DISMISSED | yes |  |
| `action` | one of: NONE, REMOVE_CONTENT, DEACTIVATE_USER | no |  |
| `note` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### GET /admin/posts

**Search all posts**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |
| `q` | string (up to 80 chars) | no |  |
| `authorId` | string | no |  |
| `groupId` | string | no |  |

Possible errors: 400, 401, 403, 429


### GET /admin/posts/{id}

**One post (admin view)**  
Admin only


Path: `id`


Possible errors: 400, 401, 403, 404, 429


### DELETE /admin/posts/{id}

**Delete any post**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### DELETE /admin/comments/{id}

**Delete any comment**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### GET /admin/listings

**Search all listings, including removed ones**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `status` | one of: AVAILABLE, SOLD, REMOVED | no |  |
| `q` | string (up to 80 chars) | no |  |
| `sellerId` | string | no |  |
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |

Possible errors: 400, 401, 403, 429


### GET /admin/listings/{id}

**One listing (admin view)**  
Admin only


Path: `id`


Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/listings/{id}/remove

**Remove a listing (a reason is required, the seller sees it)**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (3 to 500 chars) | yes |  |

Possible errors: 400, 401, 403, 404, 429


### PATCH /admin/listings/{id}/restore

**Put a removed listing back**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### GET /admin/groups

**Search all groups**  
Admin only


| Query | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string (up to 200 chars) | no |  |
| `pageSize` | number (1 to 50) | no |  |
| `q` | string (up to 80 chars) | no |  |

Possible errors: 400, 401, 403, 429


### DELETE /admin/groups/{id}

**Delete any group**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429


### DELETE /admin/explore/{id}

**Delete any explore tip**  
Admin only


Path: `id`


Body (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string (up to 500 chars) | no |  |

Possible errors: 400, 401, 403, 404, 429

