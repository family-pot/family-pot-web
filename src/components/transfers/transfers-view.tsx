"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/states";
import { ProvenanceBadge } from "@/src/components/provenance-badge";
import {
  getDataSource,
  type DataSource,
  type Recipient,
  type Transfer,
  type TransferPage,
  type TransferStatus,
} from "@/src/data";
import { formatMoney } from "@/src/lib/money";
import {
  filtersToQuery,
  hasActiveFilters,
  parseTransferSearchParams,
  transferHref,
  type TransferFilters,
} from "@/src/lib/transfer-url";
import { TransferFilterForm } from "./transfer-filters";

export const PAGE_SIZE = 10;

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; page: TransferPage; recipients: Recipient[] };

// Text AND a symbol, so status is never conveyed by colour alone.
const STATUS: Record<
  TransferStatus,
  { label: string; icon: string; className: string }
> = {
  pending: {
    label: "Pending",
    icon: "…",
    className:
      "border-amber-700 text-amber-900 dark:border-amber-400 dark:text-amber-200",
  },
  completed: {
    label: "Completed",
    icon: "✓",
    className:
      "border-green-700 text-green-900 dark:border-green-400 dark:text-green-200",
  },
  failed: {
    label: "Failed",
    icon: "✕",
    className:
      "border-red-700 text-red-900 dark:border-red-400 dark:text-red-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: "−",
    className: "border-zinc-500 text-zinc-700 dark:text-zinc-300",
  },
};

function StatusBadge({ status }: { status: TransferStatus }) {
  const { label, icon, className } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

/** Never lets a malformed amount crash the page or show a wrong number. */
function money(amount: string, currency: string): string {
  try {
    return formatMoney(amount, currency);
  } catch {
    return "Invalid amount";
  }
}

type Props = {
  /** Defaults to the app-wide data source. Tests pass their own. */
  dataSource?: DataSource;
};

export function TransfersView({ dataSource }: Props) {
  const [source] = useState(() => dataSource ?? getDataSource());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the single source of truth for filters and the page position.
  const search = searchParams.toString();
  const filters = useMemo(
    () => parseTransferSearchParams(new URLSearchParams(search)),
    [search],
  );

  const [load, setLoad] = useState<Load>({ status: "loading" });

  const fetchPage = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const [page, recipients] = await Promise.all([
        source.transfers.list(filtersToQuery(filters, PAGE_SIZE)),
        source.recipients.list(),
      ]);
      setLoad({ status: "ready", page, recipients });
    } catch (error) {
      setLoad({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not load transfers.",
      });
    }
  }, [source, filters]);

  useEffect(() => {
    // Re-fetch whenever the URL (filters or page position) changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage();
  }, [fetchPage]);

  const go = (next: TransferFilters) =>
    router.push(transferHref(pathname, next));
  const names = useMemo(
    () =>
      new Map(
        load.status === "ready"
          ? load.recipients.map((r) => [r.id, r.name])
          : [],
      ),
    [load],
  );
  const filtered = hasActiveFilters(filters);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Transfers</h1>
        <Link
          href="/transfers/new"
          className="rounded-md border border-zinc-400 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:hover:bg-zinc-800"
        >
          Add transfer
        </Link>
      </div>

      <div className="mt-6">
        {/* Keyed by the URL so the inputs always show what the URL says, and by
            whether recipients have loaded: the recipient <select> needs its
            options to exist before its default value can be shown. */}
        <TransferFilterForm
          key={`${search}|${load.status === "ready"}`}
          filters={filters}
          recipients={load.status === "ready" ? load.recipients : []}
          onApply={(next) => go(next)}
          onClear={() => go({})}
          canClear={filtered || Boolean(filters.cursor)}
        />
      </div>

      <div className="mt-6" aria-live="polite">
        {load.status === "loading" ? (
          <LoadingState label="Loading transfers…" />
        ) : load.status === "error" ? (
          <ErrorState message={load.message} onRetry={fetchPage} />
        ) : load.page.items.length === 0 ? (
          <EmptyState
            title={
              filtered ? "No transfers match these filters" : "No transfers yet"
            }
            description={
              filtered
                ? "Try widening the date range or clearing a filter."
                : "Once transfers are recorded, they will be listed here."
            }
            action={
              filtered ? (
                <button
                  type="button"
                  onClick={() => go({})}
                  className="rounded-md border border-zinc-400 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:hover:bg-zinc-800"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul aria-label="Transfers" className="space-y-3">
              {load.page.items.map((transfer) => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  recipientName={
                    names.get(transfer.recipientId) ?? "Unknown recipient"
                  }
                />
              ))}
            </ul>
            <nav
              aria-label="Pagination"
              className="mt-6 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Showing {load.page.items.length} transfer
                {load.page.items.length === 1 ? "" : "s"}
                {filters.cursor ? " (not the first page)" : ""}
                {load.page.hasMore ? "" : ", the last page"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!filters.cursor}
                  onClick={() => go({ ...filters, cursor: undefined })}
                  className="rounded-md border border-zinc-400 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-zinc-500 dark:hover:bg-zinc-800"
                >
                  First page
                </button>
                <button
                  type="button"
                  disabled={!load.page.hasMore}
                  onClick={() =>
                    go({
                      ...filters,
                      cursor: load.page.nextCursor ?? undefined,
                    })
                  }
                  className="rounded-md border border-zinc-400 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-zinc-500 dark:hover:bg-zinc-800"
                >
                  Next page
                </button>
              </div>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}

/** A card on narrow screens that becomes a row of columns from the `md` breakpoint. */
function TransferRow({
  transfer,
  recipientName,
}: {
  transfer: Transfer;
  recipientName: string;
}) {
  return (
    <li className="rounded-lg border border-zinc-300 p-4 md:grid md:grid-cols-[7rem_1fr_1.4fr_1fr_1fr_auto] md:items-center md:gap-4 dark:border-zinc-700">
      <p className="font-medium">
        <span className="sr-only">Date: </span>
        {transfer.transferDate}
      </p>
      <p className="break-words">
        <span className="sr-only">Recipient: </span>
        {recipientName}
      </p>
      <div className="mt-2 md:mt-0">
        <p className="font-medium">
          <span className="sr-only">Amount: </span>
          {money(transfer.amount, transfer.currency)}
        </p>
        <ProvenanceBadge provenance="user-entered" />
      </div>
      <p className="mt-2 text-sm text-zinc-600 md:mt-0 dark:text-zinc-400">
        <span className="font-medium md:sr-only">Fee: </span>
        {money(transfer.fee, transfer.currency)}
      </p>
      <p className="text-sm break-words">
        <span className="font-medium md:sr-only">Provider: </span>
        {transfer.provider}
      </p>
      <div className="mt-2 flex items-center gap-3 md:mt-0">
        <StatusBadge status={transfer.status} />
        <Link
          href={`/transfers/${transfer.id}/edit`}
          aria-label={`Edit transfer on ${transfer.transferDate} to ${recipientName}`}
          className="text-sm font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Edit
        </Link>
      </div>
    </li>
  );
}
