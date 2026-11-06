import {
  TRANSFER_STATUSES,
  isCalendarDate,
  type TransferListQuery,
  type TransferStatus,
} from "@/src/data";

/** The state of the transfers page that lives in the URL, so reload and back/forward restore it. */
export interface TransferFilters {
  recipientId?: string;
  dateFrom?: string;
  dateTo?: string;
  provider?: string;
  status?: TransferStatus;
  /** Where the current page starts (opaque, from the previous page). */
  cursor?: string;
}

/** Query-string names. Kept short and readable in a shared link. */
const PARAMS = {
  recipientId: "recipient",
  dateFrom: "from",
  dateTo: "to",
  provider: "provider",
  status: "status",
  cursor: "cursor",
} as const;

type Params = { get(name: string): string | null };

/**
 * Reads filters from a query string. Anything invalid or unknown is ignored
 * rather than failing, because a URL can be edited or stale: the page then
 * simply shows the unfiltered view for that part.
 */
export function parseTransferSearchParams(params: Params): TransferFilters {
  const filters: TransferFilters = {};
  const read = (name: string) => params.get(name)?.trim() || undefined;

  const recipientId = read(PARAMS.recipientId);
  if (recipientId && /^[\w-]+$/.test(recipientId))
    filters.recipientId = recipientId;

  const dateFrom = read(PARAMS.dateFrom);
  if (dateFrom && isCalendarDate(dateFrom)) filters.dateFrom = dateFrom;
  const dateTo = read(PARAMS.dateTo);
  if (dateTo && isCalendarDate(dateTo)) filters.dateTo = dateTo;
  // A reversed range cannot be satisfied; keep the "from" and drop the "to".
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    delete filters.dateTo;
  }

  const provider = read(PARAMS.provider);
  if (provider && provider.length <= 100) filters.provider = provider;

  const status = read(PARAMS.status);
  if (status && (TRANSFER_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as TransferStatus;
  }

  const cursor = read(PARAMS.cursor);
  if (cursor && cursor.length <= 200) filters.cursor = cursor;
  return filters;
}

/** The query string for the given filters, in a stable order, without empty values. */
export function buildTransferSearchParams(
  filters: TransferFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(PARAMS) as (keyof typeof PARAMS)[]) {
    const value = filters[key];
    if (value) params.set(PARAMS[key], value);
  }
  return params;
}

/** The same URL path with the filters applied, ready for `router.push`. */
export function transferHref(
  pathname: string,
  filters: TransferFilters,
): string {
  const query = buildTransferSearchParams(filters).toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function filtersToQuery(
  filters: TransferFilters,
  limit: number,
): TransferListQuery {
  return { ...filters, limit };
}

/** True when any filter (not the page position) is set. */
export function hasActiveFilters(filters: TransferFilters): boolean {
  return Boolean(
    filters.recipientId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.provider ||
    filters.status,
  );
}
