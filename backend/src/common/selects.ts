import { Prisma } from '@prisma/client';

// What anyone may see about a user, everywhere a user appears next to
// content: post authors, commenters, sellers, message senders, and so on.
// Never put email, verificationStatus or anything private in here.
//
// isVerified is true only for an approved NYSC verification, so a pending or
// rejected request is never visible to other people.
export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  state: true,
  isVerified: true,
} satisfies Prisma.UserSelect;

// Public user plus "member since", shown to buyers on a listing.
export const SELLER_SELECT = {
  ...PUBLIC_USER_SELECT,
  createdAt: true,
} satisfies Prisma.UserSelect;
