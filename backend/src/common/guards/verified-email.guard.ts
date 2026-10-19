import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

// Put after JwtAuthGuard on routes that need a confirmed email address:
// selling, creating groups, submitting NYSC verification. The frontend can
// check `code` to show a "verify your email" screen.
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;

    if (!user?.emailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before doing this',
      });
    }

    return true;
  }
}
