import { TransformFnParams } from 'class-transformer';

export const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

// Emails are stored and looked up in lowercase, so "Ada@Gmail.com" and
// "ada@gmail.com" are the same account.
export const normalizeEmail = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Trims, and turns an empty string into undefined so optional fields can be
// cleared or skipped by sending "".
export const trimToUndefined = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};
