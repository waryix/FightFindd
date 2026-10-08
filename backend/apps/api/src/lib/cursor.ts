import { badRequest } from "./errors.js";

export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.createdAt.toISOString(), i: cursor.id })).toString("base64url");
}

export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { t: string; i: string };
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime()) || typeof parsed.i !== "string") throw new Error("bad cursor");
    return { createdAt, id: parsed.i };
  } catch {
    throw badRequest("VALIDATION_ERROR", "Invalid pagination cursor");
  }
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface Accessors<T> {
  createdAt: (row: T) => Date | string;
  id: (row: T) => string;
}

/** Maps rows to a cursor page; override accessors when rows are nested. */
export function buildPageWith<T>(rows: T[], limit: number, accessors: Accessors<T>): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          createdAt: normalizeDate(accessors.createdAt(last)),
          id: accessors.id(last),
        })
      : null;
  return { items, nextCursor };
}

export function buildPage<T extends { createdAt: Date | string; id: string }>(rows: T[], limit: number): Page<T> {
  return buildPageWith(rows, limit, {
    createdAt: (row) => row.createdAt,
    id: (row) => row.id,
  });
}

export interface SortCursor {
  /** Primary sort value. Numbers for score/distance/counts, epoch millis for dates. */
  value: number;
  id: string;
}

export function encodeSortCursor(cursor: SortCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeSortCursor(raw: string | undefined | null): SortCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SortCursor;
    if (typeof parsed.value !== "number" || typeof parsed.id !== "string") throw new Error("bad cursor");
    return parsed;
  } catch {
    throw badRequest("VALIDATION_ERROR", "Invalid pagination cursor");
  }
}

export function buildSortPage<T>(
  rows: T[],
  limit: number,
  valueOf: (row: T) => number,
  idOf?: (row: T) => string,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  if (!hasMore || !last) return { items, nextCursor: null };
  const id = idOf ? idOf(last) : ((last as { id?: string }).id ?? "");
  return { items, nextCursor: encodeSortCursor({ value: valueOf(last), id }) };
}

function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
