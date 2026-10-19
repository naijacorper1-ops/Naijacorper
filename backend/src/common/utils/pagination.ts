import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_SIZE = 20;

export type SortDirection = 'asc' | 'desc';

// A cursor remembers the sort value and id of the last row on the page.
// Looking up "the row with this id" (the old way) breaks when that row has
// been deleted in the meantime, and two rows created in the same millisecond
// can be skipped or repeated. Sort value + id has neither problem.
//
// The client treats a cursor as an opaque string and sends back whatever it
// was given.
export function encodeCursor(sortValue: Date, id: string): string {
  return Buffer.from(`${sortValue.toISOString()}|${id}`, 'utf8').toString('base64url');
}

const CURSOR_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CURSOR_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function decodeCursor(cursor: string): { sortValue: Date; id: string } {
  const [iso, id, extra] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const sortValue = new Date(iso ?? '');

  // Only a cursor in exactly the shape we hand out is accepted, so a
  // hand-made one can never reach the database.
  if (
    extra !== undefined ||
    !iso ||
    !id ||
    !CURSOR_DATE.test(iso) ||
    !CURSOR_ID.test(id) ||
    Number.isNaN(sortValue.getTime())
  ) {
    throw new BadRequestException('Invalid cursor');
  }

  return { sortValue, id };
}

// The "everything after this cursor" condition, to be combined (AND) with the
// rest of a query's where. Pair it with
//   orderBy: [{ [field]: direction }, { id: direction }]
// W is the Prisma where type of the model being queried.
export function keysetWhere<W>(
  cursor: string | undefined,
  field = 'createdAt',
  direction: SortDirection = 'desc',
): W | undefined {
  if (!cursor) {
    return undefined;
  }

  const { sortValue, id } = decodeCursor(cursor);
  const op = direction === 'desc' ? 'lt' : 'gt';

  return {
    OR: [{ [field]: { [op]: sortValue } }, { [field]: sortValue, id: { [op]: id } }],
  } as unknown as W;
}

// Queries fetch one row more than the page size. If that extra row exists
// there is another page, and the cursor points at the last row we return.
// This avoids the old "empty last page" when the total is an exact multiple.
export function sliceWithCursor<T extends { id: string }>(
  rows: T[],
  pageSize: number,
  sortValueOf: (row: T) => Date,
) {
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(sortValueOf(last), last.id) : null,
  };
}
