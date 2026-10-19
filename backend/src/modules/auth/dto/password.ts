import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// One rule for every place a new password is chosen. The upper limit stops
// someone sending a huge string just to make the server spend time hashing it.
export function NewPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8),
    MaxLength(128),
    Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password must contain an uppercase letter, a lowercase letter, and a number',
    }),
  );
}
