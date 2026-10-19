import { UserRole } from '@prisma/client';

// What request.user contains on every authenticated request.
// It is loaded from the database on each request (see JwtStrategy), so
// deactivation and role changes take effect immediately.
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  emailVerified: boolean;
}
