import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, registerDecorator } from 'class-validator';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Names that would collide with routes or look like official accounts.
export const RESERVED_USERNAMES = new Set([
  'me',
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'staff',
  'moderator',
  'mod',
  'official',
  'naijacorper',
  'nysc',
  'api',
  'search',
  'null',
  'undefined',
  'settings',
  'login',
  'logout',
  'register',
]);

// Lowercases and trims, then checks the format and the reserved list.
// Usernames are stored lowercase, so "Success" and "success" can never
// be two different people.
export function Username() {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsString(),
    Matches(USERNAME_PATTERN, {
      message: 'username must be 3 to 20 characters: lowercase letters, numbers and underscores only',
    }),
    (object: object, propertyName: string) => {
      registerDecorator({
        name: 'isNotReservedUsername',
        target: object.constructor,
        propertyName,
        options: { message: 'That username is not available' },
        validator: {
          validate: (value: unknown) =>
            typeof value === 'string' && !RESERVED_USERNAMES.has(value.toLowerCase()),
        },
      });
    },
  );
}
