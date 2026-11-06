import { ValidationError } from "./errors";
import type { Transfer, TransferListQuery, TransferPage } from "./types";
import { TRANSFER_STATUSES } from "./transfer-status";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_OR_ID = /^[\w-]+$/;

/** A real calendar date, `YYYY-MM-DD`. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Opaque to callers; holds only the sort key of the last item on the page. */
export function encodeCursor(transferDate: string, id: string): string {
  return btoa(JSON.stringify([transferDate, id]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeCursor(
  cursor: string,
): { transferDate: string; id: string } | undefined {
  try {
    const padded = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const parsed: unknown = JSON.parse(atob(padded));
    if (!Array.isArray(parsed) || parsed.length !== 2) return undefined;
    const [transferDate, id] = parsed as unknown[];
    if (!isCalendarDate(transferDate)) return undefined;
    if (typeof id !== "string" || !UUID_OR_ID.test(id)) return undefined;
    return { transferDate, id };
  } catch {
    return undefined;
  }
}

/** Newest first, with the id as a tiebreak, so the order is total and stable. */
export function compareTransfers(a: Transfer, b: Transfer): number {
  if (a.transferDate !== b.transferDate) {
    return a.transferDate < b.transferDate ? 1 : -1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** Field-level problems with a query, keyed like the API's `errors`. */
export function validateTransferQuery(
  query: TransferListQuery,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (query.dateFrom !== undefined && !isCalendarDate(query.dateFrom)) {
    errors.dateFrom = "dateFrom must be a real date (YYYY-MM-DD).";
  }
  if (query.dateTo !== undefined && !isCalendarDate(query.dateTo)) {
    errors.dateTo = "dateTo must be a real date (YYYY-MM-DD).";
  }
  if (
    !errors.dateFrom &&
    !errors.dateTo &&
    query.dateFrom &&
    query.dateTo &&
    query.dateFrom > query.dateTo
  ) {
    errors.dateFrom = "dateFrom must not be after dateTo.";
  }
  if (
    query.status !== undefined &&
    !(TRANSFER_STATUSES as readonly string[]).includes(query.status)
  ) {
    errors.status = `status must be one of ${TRANSFER_STATUSES.join(", ")}.`;
  }
  if (
    query.limit !== undefined &&
    (!Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > MAX_PAGE_SIZE)
  ) {
    errors.limit = `limit must be a whole number from 1 to ${MAX_PAGE_SIZE}.`;
  }
  if (query.cursor !== undefined && !decodeCursor(query.cursor)) {
    errors.cursor = "cursor is not valid.";
  }
  return errors;
}

/**
 * Applies filters, the stable sort and cursor pagination to a list of
 * transfers. The mock data source uses it; the API does the same server-side.
 */
export function queryTransfers(
  records: readonly Transfer[],
  query: TransferListQuery = {},
): TransferPage {
  const errors = validateTransferQuery(query);
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const provider = query.provider?.trim().toLowerCase();
  const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;

  const matching = records
    .filter(
      (t) =>
        (!query.recipientId || t.recipientId === query.recipientId) &&
        (!query.dateFrom || t.transferDate >= query.dateFrom) &&
        (!query.dateTo || t.transferDate <= query.dateTo) &&
        (!provider || t.provider.toLowerCase() === provider) &&
        (!query.status || t.status === query.status),
    )
    .sort(compareTransfers);

  // Keyset: start strictly after the cursor's position in the sort order.
  const start = cursor
    ? matching.filter(
        (t) =>
          t.transferDate < cursor.transferDate ||
          (t.transferDate === cursor.transferDate && t.id < cursor.id),
      )
    : matching;

  const items = start.slice(0, limit).map((t) => structuredClone(t));
  const last = items.at(-1);
  const hasMore = start.length > limit;
  return {
    items,
    limit,
    hasMore,
    nextCursor:
      hasMore && last ? encodeCursor(last.transferDate, last.id) : null,
  };
}
