import { OpenAPIObject } from '@nestjs/swagger';

// Plain-language descriptions for the API page (/api/docs). They are added to
// the page after it is generated from the code, so no controller is touched
// and the behaviour of the API does not change. Keys look like
// "POST /api/v1/auth/login".

const INTRO = `
Backend API for NaijaCorper. All paths start with **/api/v1**.

## Signing in
1. Call **POST /auth/register** or **POST /auth/login**. You get an \`accessToken\` (valid 15 minutes) and a refresh cookie.
2. Send the token on every request: \`Authorization: Bearer <accessToken>\`. In this page, press **Authorize** and paste it.
3. When it expires (401), call **POST /auth/refresh**. The browser sends the cookie by itself, so use \`credentials: 'include'\` (axios: \`withCredentials: true\`). You get a new token.

## Verified email
Posting media, selling, creating groups and sending a verification document need a verified email. Those calls answer **403** with \`code: "EMAIL_NOT_VERIFIED"\`. Show a "verify your email" prompt. Codes are sent by **POST /auth/register** and **POST /auth/resend-verification**.

## Lists and pages
List calls take \`pageSize\` (1 to 50, default 20) and \`cursor\`. The answer has a \`nextCursor\`. Send it back unchanged to get the next page. \`null\` means there are no more pages. Never build or edit a cursor yourself.

## Errors
Errors look like \`{ "statusCode": 400, "message": "...", "error": "Bad Request" }\`. For validation errors \`message\` is a list of texts. Common codes: 400 wrong input, 401 not signed in or token expired, 403 not allowed, 404 not found (also used when someone blocked you), 409 already exists, 429 too many requests.

## Photos, videos and files
Upload first, then send the returned \`url\` where it is needed (post \`mediaUrls\`, listing \`imageUrls\`). Only links from our own uploads are accepted. Uploads are multipart form data with the file in a field named **file**.

## Real-time chat (Socket.IO, not shown below)
Connect to the **/messaging** namespace with \`auth: { token: <accessToken> }\`. A bad or expired token gives a \`connect_error\`: refresh the token and connect again.
- Send: emit \`sendMessage\` with \`{ conversationId, content }\` (content 1 to 2000 characters). The acknowledgement is the saved message.
- Receive: listen for \`newMessage\`.
- Problems arrive on the \`exception\` event. Sending more than 20 messages in 10 seconds is refused.
`.trim();

const TAGS: Record<string, string> = {
  health: 'Is the server up.',
  auth: 'Sign up, sign in, tokens, email codes and passwords.',
  users: 'Profiles, search, followers, avatar and account deletion.',
  onboarding: 'Journey stage, NYSC details and the verification badge.',
  posts: 'Create, read and delete posts, reposts, polls.',
  feed: 'The home feed and trending posts.',
  comments: 'Comments and replies on a post.',
  notifications: 'Notification list and settings.',
  messaging: 'Private conversations and messages.',
  marketplace: 'Classified listings. There are no payments, buyers contact sellers in chat.',
  explore: 'Community tips about places (food, markets, spots).',
  groups: 'Groups people can join and post in.',
  hashtags: 'Trending tags, tag search and posts by tag.',
  uploads: 'File uploads. Upload first, then use the returned url.',
  reports: 'Report a post, user, comment, listing or group.',
  admin: 'Admin tools. Every call needs an admin account.',
};

const SUMMARIES: Record<string, string> = {
  'GET /api/v1/health': 'Check that the server is running',

  'POST /api/v1/auth/register': 'Create an account and get tokens. A verification code is emailed',
  'POST /api/v1/auth/login': 'Sign in and get tokens',
  'POST /api/v1/auth/refresh': 'Get a new access token using the refresh cookie',
  'POST /api/v1/auth/logout': 'Sign out of this device',
  'POST /api/v1/auth/logout-all': 'Sign out of every device',
  'POST /api/v1/auth/change-password': 'Change your password (signs out other devices)',
  'POST /api/v1/auth/verify-email': 'Confirm your email with the 6-digit code',
  'POST /api/v1/auth/resend-verification': 'Send a new verification code (one per minute)',
  'POST /api/v1/auth/forgot-password': 'Email a password reset code',
  'POST /api/v1/auth/reset-password': 'Set a new password with the reset code',

  'GET /api/v1/users/me': 'Get your own account and profile',
  'PATCH /api/v1/users/me': 'Edit your profile (name, username, bio, state)',
  'DELETE /api/v1/users/me': 'Delete your account permanently (needs your password)',
  'PATCH /api/v1/users/me/avatar': 'Set your profile picture',
  'DELETE /api/v1/users/me/avatar': 'Remove your profile picture',
  'GET /api/v1/users/search': 'Search people by username or name',
  'GET /api/v1/users/{username}': 'Public profile of a user',
  'GET /api/v1/users/{username}/posts': "A user's posts, newest first",
  'GET /api/v1/users/{username}/followers': "A user's followers",
  'GET /api/v1/users/{username}/following': 'People a user follows',
  'GET /api/v1/users/me/blocked': 'People you have blocked',
  'GET /api/v1/users/me/muted': 'People you have muted',
  'POST /api/v1/users/{userId}/block': 'Block a user (also removes follows both ways)',
  'DELETE /api/v1/users/{userId}/block': 'Unblock a user',
  'POST /api/v1/users/{userId}/mute': "Mute a user (hide their posts from your feed, privately)",
  'DELETE /api/v1/users/{userId}/mute': 'Unmute a user',
  'POST /api/v1/users/{userId}/follow': 'Follow a user',
  'DELETE /api/v1/users/{userId}/follow': 'Unfollow a user',

  'POST /api/v1/reports': 'Report a post, user, comment, listing or group',

  'POST /api/v1/uploads/post-media': 'Upload a photo or short video for a post',
  'POST /api/v1/uploads/listing-image': 'Upload a photo for a marketplace listing',

  'PATCH /api/v1/onboarding/journey-stage': 'Choose your NYSC journey stage',
  'PATCH /api/v1/onboarding/prospective-details': 'Save details for someone waiting for call-up',
  'PATCH /api/v1/onboarding/serving-details': 'Save details for a serving corps member',
  'POST /api/v1/onboarding/verification-document': 'Submit a document to get the verified badge',
  'GET /api/v1/onboarding/verification': 'Status of your verification request',

  'POST /api/v1/posts': 'Create a post, quote, repost or poll',
  'GET /api/v1/posts/{id}': 'Get one post',
  'DELETE /api/v1/posts/{id}': 'Delete your post (a group owner can delete posts in their group)',
  'POST /api/v1/posts/{id}/poll/vote': 'Vote in a poll (one vote per person)',
  'POST /api/v1/posts/{postId}/like': 'Like a post',
  'DELETE /api/v1/posts/{postId}/like': 'Remove your like',

  'GET /api/v1/feed': 'Home feed (all, your state, or people you follow)',
  'GET /api/v1/feed/trending': 'Trending posts from the last days',

  'POST /api/v1/posts/{postId}/comments': 'Comment on a post, or reply to a comment',
  'GET /api/v1/posts/{postId}/comments': 'Top-level comments on a post',
  'GET /api/v1/posts/{postId}/comments/{commentId}/replies': 'Replies to a comment',
  'DELETE /api/v1/posts/{postId}/comments/{commentId}': 'Delete your comment',

  'GET /api/v1/notifications': 'Your notifications, newest first',
  'GET /api/v1/notifications/unread-count': 'Number of unread notifications',
  'PATCH /api/v1/notifications/read-all': 'Mark all notifications as read',
  'GET /api/v1/notifications/preferences': 'Your notification settings',
  'PATCH /api/v1/notifications/preferences': 'Change your notification settings',
  'PATCH /api/v1/notifications/{id}/read': 'Mark one notification as read',

  'POST /api/v1/messaging/conversations/{userId}': 'Start a conversation with a user (or get the existing one)',
  'GET /api/v1/messaging/conversations': 'Your inbox, most recent first',
  'GET /api/v1/messaging/unread-count': 'Total unread messages',
  'GET /api/v1/messaging/conversations/{conversationId}/messages': 'Messages in a conversation, newest first',
  'POST /api/v1/messaging/conversations/{conversationId}/messages': 'Send a message',
  'PATCH /api/v1/messaging/conversations/{conversationId}/read': 'Mark the conversation as read',

  'POST /api/v1/marketplace/listings': 'Create a listing',
  'GET /api/v1/marketplace/listings': 'Browse and search listings',
  'GET /api/v1/marketplace/listings/mine': 'Your own listings (any status)',
  'GET /api/v1/marketplace/sellers/{username}': "A seller's profile",
  'GET /api/v1/marketplace/sellers/{username}/listings': "A seller's listings (available or sold)",
  'GET /api/v1/marketplace/listings/{id}': 'Get one listing',
  'PATCH /api/v1/marketplace/listings/{id}': 'Edit your listing',
  'DELETE /api/v1/marketplace/listings/{id}': 'Delete your listing',
  'PATCH /api/v1/marketplace/listings/{id}/status': 'Mark your listing available or sold',
  'POST /api/v1/marketplace/listings/{id}/report': 'Report a listing',

  'POST /api/v1/explore': 'Share a tip about a place',
  'GET /api/v1/explore': 'Browse tips by category, state or keyword',
  'GET /api/v1/explore/{id}': 'Get one tip',
  'DELETE /api/v1/explore/{id}': 'Delete your tip',

  'POST /api/v1/groups': 'Create a group',
  'GET /api/v1/groups': 'Browse and search groups',
  'GET /api/v1/groups/mine': 'Groups you belong to',
  'GET /api/v1/groups/{group}': 'Get a group by id or slug',
  'PATCH /api/v1/groups/{group}': 'Edit a group (owner only)',
  'DELETE /api/v1/groups/{group}': 'Delete a group (owner only)',
  'PATCH /api/v1/groups/{group}/avatar': 'Set the group picture (owner only)',
  'POST /api/v1/groups/{group}/join': 'Join a group',
  'DELETE /api/v1/groups/{group}/leave': 'Leave a group',
  'GET /api/v1/groups/{group}/members': 'Members of a group',
  'GET /api/v1/groups/{group}/posts': 'Posts inside a group',

  'GET /api/v1/hashtags/trending': 'Trending hashtags this week',
  'GET /api/v1/hashtags/search': 'Search hashtags by name',
  'GET /api/v1/hashtags/{tag}/posts': 'Posts that use a hashtag',

  'GET /api/v1/admin/stats': 'Overview numbers and what needs attention',
  'GET /api/v1/admin/audit-logs': 'Record of admin actions',
  'GET /api/v1/admin/users': 'Search and list users',
  'GET /api/v1/admin/users/{id}': 'Full details of a user',
  'PATCH /api/v1/admin/users/{id}/deactivate': 'Deactivate an account (signs the person out everywhere)',
  'PATCH /api/v1/admin/users/{id}/reactivate': 'Reactivate an account',
  'PATCH /api/v1/admin/users/{id}/role': 'Change a role (for example make someone an admin)',
  'PATCH /api/v1/admin/users/{id}/verification': 'Give or remove the verified badge by hand',
  'GET /api/v1/admin/verifications': 'Verification requests (the PENDING queue by default, oldest first)',
  'GET /api/v1/admin/verifications/{id}/document': 'Get a private link to the document (works 10 minutes)',
  'PATCH /api/v1/admin/verifications/{id}/decision': 'Approve or reject a verification request',
  'GET /api/v1/admin/reports': 'Reports, with filters',
  'GET /api/v1/admin/reports/{id}': 'One report with the reported content',
  'PATCH /api/v1/admin/reports/{id}/decision': 'Close a report and optionally act on the content or user',
  'GET /api/v1/admin/posts': 'Search all posts',
  'GET /api/v1/admin/posts/{id}': 'One post (admin view)',
  'DELETE /api/v1/admin/posts/{id}': 'Delete any post',
  'DELETE /api/v1/admin/comments/{id}': 'Delete any comment',
  'GET /api/v1/admin/listings': 'Search all listings, including removed ones',
  'GET /api/v1/admin/listings/{id}': 'One listing (admin view)',
  'PATCH /api/v1/admin/listings/{id}/remove': 'Remove a listing (a reason is required, the seller sees it)',
  'PATCH /api/v1/admin/listings/{id}/restore': 'Put a removed listing back',
  'GET /api/v1/admin/groups': 'Search all groups',
  'DELETE /api/v1/admin/groups/{id}': 'Delete any group',
  'DELETE /api/v1/admin/explore/{id}': 'Delete any explore tip',
};

// Extra explanation shown under the summary.
const DETAILS: Record<string, string> = {
  'POST /api/v1/auth/register':
    'Password: 8 to 128 characters with an uppercase letter, a lowercase letter and a number. Username: 3 to 20 characters, lowercase letters, numbers and underscores. The response is `{ accessToken }` and a refresh cookie is set.',
  'POST /api/v1/auth/login': 'Response: `{ accessToken }`. The refresh cookie is set by the server. Email is not case sensitive.',
  'POST /api/v1/auth/refresh': 'No body. Needs the refresh cookie. Each refresh gives a new cookie, so always use the latest one. Response: `{ accessToken }`.',
  'POST /api/v1/auth/verify-email': 'The code lasts 15 minutes and allows 5 tries. After that, ask for a new code.',
  'POST /api/v1/auth/reset-password': 'Also marks the email as verified and signs the person out everywhere.',
  'POST /api/v1/auth/forgot-password': 'Always answers the same way, whether or not the email exists.',
  'GET /api/v1/users/{username}': 'Includes `isVerified` (the badge), follower counts and whether you follow them. Returns 404 for deactivated accounts and for people who blocked you.',
  'DELETE /api/v1/users/me': 'Body: `{ "password": "..." }`. Admin accounts cannot be deleted here. This cannot be undone.',
  'POST /api/v1/reports': 'Reasons are free text (up to 500 characters). You cannot report yourself, and a repeat report of the same item is refused.',
  'POST /api/v1/uploads/post-media': 'Needs a verified email. Photos (JPG, PNG, GIF, WebP) up to 15 MB, or short videos (MP4, MOV). Response: `{ "url": "..." }`.',
  'POST /api/v1/uploads/listing-image': 'Needs a verified email. JPG, PNG, GIF or WebP up to 8 MB. Response: `{ "url": "..." }`.',
  'PATCH /api/v1/users/me/avatar': 'JPG, PNG or WebP up to 5 MB. It is cropped to a square.',
  'PATCH /api/v1/groups/{group}/avatar': 'JPG, PNG or WebP up to 5 MB. It is cropped to a square.',
  'POST /api/v1/onboarding/verification-document':
    'Needs a verified email. Send as multipart form data: `file` (PDF, JPG, PNG or WebP, up to 10 MB), `documentType` and an optional `note`. One pending request at a time, at most 5 in 30 days. The file is private and deleted after an admin decides. The badge shows as `isVerified` on public profiles only after approval.',
  'POST /api/v1/posts':
    'Send text, `mediaUrls` (from the upload endpoint), `repostOfId` (repost or quote), `groupId` (post inside a group) or a `poll` ({ options: 2 to 4, durationHours: 1 to 168 }). Hashtags are taken from the text (up to 10). A post needs text, media or a repost. A poll needs its question as the post text, and a repost cannot have a poll.',
  'GET /api/v1/feed': '`scope`: NATIONAL (default), STATE (use `state`, or your own state if you leave it out) or FOLLOWING (you and the people you follow).',
  'POST /api/v1/messaging/conversations/{userId}': 'Returns the existing conversation if there is one. Not possible with yourself, with deactivated users or when either of you blocked the other.',
  'POST /api/v1/marketplace/listings':
    'Needs a verified email. At least one photo is required, except for the SERVICES category. At most 6 photos and 20 available listings per seller. Price is a whole number in naira from 0 to 1,000,000,000.',
  'GET /api/v1/marketplace/listings': 'Only available listings from active sellers. `q` searches title and description.',
  'PATCH /api/v1/marketplace/listings/{id}': 'Photos already on the listing can be sent back as they are. New photos must come from the upload endpoint. A listing removed by a moderator cannot be changed.',
  'PATCH /api/v1/marketplace/listings/{id}/status': 'Moving a sold listing back to AVAILABLE counts against the limit of 20.',
  'POST /api/v1/groups': 'Needs a verified email. You become the owner. At most 10 groups per person. The slug is made from the name.',
  'PATCH /api/v1/admin/users/{id}/role': 'The person must be active with a verified email. You cannot change your own role. The change works on their next request.',
  'PATCH /api/v1/admin/users/{id}/deactivate': 'You cannot deactivate yourself or another admin.',
  'PATCH /api/v1/admin/verifications/{id}/decision': 'A reason is required when rejecting and the person can read it. They get a notification. The document file is deleted after the decision.',
  'PATCH /api/v1/admin/reports/{id}/decision':
    '`status`: REVIEWED or DISMISSED. `action` (optional): NONE, REMOVE_CONTENT (removes the reported post, comment, listing or group) or DEACTIVATE_USER (the owner of the content, or the reported user). Other open reports about the same item are closed too.',
  'GET /api/v1/admin/reports/{id}': 'Includes a copy of the content taken when the report was made, so it can still be read if it was edited or deleted since.',
};

// File upload routes: the page generated from the code cannot see the file
// field, so it is described here.
const UPLOADS: Record<
  string,
  { fields?: Record<string, { type: string; enum?: string[]; description: string }>; required?: string[]; fileDescription: string }
> = {
  'POST /api/v1/uploads/post-media': { fileDescription: 'Photo (JPG, PNG, GIF, WebP) or video (MP4, MOV), up to 15 MB' },
  'POST /api/v1/uploads/listing-image': { fileDescription: 'JPG, PNG, GIF or WebP, up to 8 MB' },
  'PATCH /api/v1/users/me/avatar': { fileDescription: 'JPG, PNG or WebP, up to 5 MB' },
  'PATCH /api/v1/groups/{group}/avatar': { fileDescription: 'JPG, PNG or WebP, up to 5 MB' },
  'POST /api/v1/onboarding/verification-document': {
    fileDescription: 'PDF, JPG, PNG or WebP, up to 10 MB',
    fields: {
      documentType: {
        type: 'string',
        enum: ['NYSC_ID_CARD', 'CALL_UP_LETTER', 'DISCHARGE_CERTIFICATE', 'OTHER'],
        description: 'What the document is (optional, defaults to OTHER)',
      },
      note: { type: 'string', description: 'Anything the reviewer should know (optional, up to 300 characters)' },
    },
  },
};

const PUBLIC_ROUTES = new Set([
  'GET /api/v1/health',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/verify-email',
  'POST /api/v1/auth/resend-verification',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
]);

const NEEDS_VERIFIED_EMAIL = new Set([
  'POST /api/v1/uploads/post-media',
  'POST /api/v1/uploads/listing-image',
  'POST /api/v1/onboarding/verification-document',
  'POST /api/v1/marketplace/listings',
  'PATCH /api/v1/marketplace/listings/{id}',
  'POST /api/v1/groups',
]);

const TOKEN_RESPONSE = {
  type: 'object',
  properties: { accessToken: { type: 'string', description: 'Valid for 15 minutes' } },
};

const URL_RESPONSE = {
  type: 'object',
  properties: { url: { type: 'string', description: 'Use this link where the file is needed' } },
};

const ERROR_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    error: { type: 'string' },
  },
};

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ERROR_SCHEMA } },
});

type Operation = {
  summary?: string;
  description?: string;
  requestBody?: unknown;
  parameters?: Array<{ in: string }>;
  responses?: Record<string, unknown>;
  security?: unknown[];
};

// Adds the descriptions, upload forms, error answers and intro to the page.
export function improveApiDocument(document: OpenAPIObject): OpenAPIObject {
  document.info.description = INTRO;

  const used = new Set<string>();
  document.paths && Object.values(document.paths).forEach((item) => {
    Object.values(item as Record<string, { tags?: string[] }>).forEach((op) => op?.tags?.forEach((t) => used.add(t)));
  });
  document.tags = Object.keys(TAGS)
    .filter((name) => used.has(name))
    .map((name) => ({ name, description: TAGS[name] }));

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, raw] of Object.entries(item as Record<string, unknown>)) {
      const op = raw as Operation;
      const key = `${method.toUpperCase()} ${path}`;

      op.summary = SUMMARIES[key] ?? op.summary;
      op.description = DETAILS[key] ?? op.description;

      if (PUBLIC_ROUTES.has(key)) {
        op.security = [];
      }

      const upload = UPLOADS[key];

      if (upload) {
        op.requestBody = {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: upload.fileDescription },
                  ...(upload.fields ?? {}),
                },
              },
            },
          },
        };
      }

      const responses = (op.responses ??= {});
      const okCode = Object.keys(responses).find((code) => code.startsWith('2'));

      if (okCode && ['POST /api/v1/auth/register', 'POST /api/v1/auth/login', 'POST /api/v1/auth/refresh'].includes(key)) {
        responses[okCode] = {
          description: 'Signed in. The refresh cookie is set too.',
          content: { 'application/json': { schema: TOKEN_RESPONSE } },
        };
      }

      if (okCode && ['POST /api/v1/uploads/post-media', 'POST /api/v1/uploads/listing-image'].includes(key)) {
        responses[okCode] = { description: 'The uploaded file', content: { 'application/json': { schema: URL_RESPONSE } } };
      }

      const isAdmin = path.startsWith('/api/v1/admin');
      const hasBody = !!op.requestBody;
      const hasInput = hasBody || (op.parameters ?? []).length > 0;

      if (hasInput) responses['400'] ??= errorResponse('Wrong or missing input. `message` lists what is wrong.');
      if (!PUBLIC_ROUTES.has(key)) responses['401'] ??= errorResponse('Not signed in, or the access token expired. Call refresh.');
      if (isAdmin) responses['403'] ??= errorResponse('Not an admin.');
      if (NEEDS_VERIFIED_EMAIL.has(key)) {
        responses['403'] ??= errorResponse('Email not verified (`code: "EMAIL_NOT_VERIFIED"`) or not allowed.');
      }
      if (path.includes('{')) responses['404'] ??= errorResponse('Not found, or hidden from you.');
      responses['429'] ??= errorResponse('Too many requests. Wait a moment and try again.');
    }
  }

  return document;
}
