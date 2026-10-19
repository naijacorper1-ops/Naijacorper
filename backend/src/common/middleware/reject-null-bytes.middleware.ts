import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Postgres refuses text that contains a null character, and that refusal
// used to surface as a 500. No real user types one, so any request that
// carries it in the address, query or JSON body gets a plain 400 instead.
@Injectable()
export class RejectNullBytesMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    let address = req.originalUrl;

    try {
      address = decodeURIComponent(req.originalUrl);
    } catch {
      throw new BadRequestException('Malformed request address');
    }

    if (address.includes('\0') || containsNullByte(req.body)) {
      throw new BadRequestException('Request contains an invalid character');
    }

    next();
  }
}

function containsNullByte(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') {
    return value.includes('\0');
  }

  if (depth > 10 || value === null || typeof value !== 'object') {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, inner]) => key.includes('\0') || containsNullByte(inner, depth + 1),
  );
}
