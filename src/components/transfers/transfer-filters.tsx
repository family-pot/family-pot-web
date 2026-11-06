"use client";

import { TRANSFER_STATUSES, type Recipient } from "@/src/data";
import type { TransferFilters } from "@/src/lib/transfer-url";

type Props = {
  filters: TransferFilters;
  recipients: Recipient[];
  /** Called with the new filters (the page position is reset by the caller). */
  onApply: (filters: TransferFilters) => void;
  onClear: () => void;
  canClear: boolean;
};

const field =
  "mt-1 block w-full rounded-md border border-zinc-400 bg-white px-3 py-2 text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-50";

const STATUS_LABELS: Record<(typeof TRANSFER_STATUSES)[number], string> = {
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function TransferFilterForm({
  filters,
  recipients,
  onApply,
  onClear,
  canClear,
}: Props) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) =>
      String(data.get(name) ?? "").trim() || undefined;
    onApply({
      recipientId: text("recipient"),
      dateFrom: text("from"),
      dateTo: text("to"),
      provider: text("provider"),
      status: text("status") as TransferFilters["status"],
    });
  }

  return (
    // Uncontrolled inputs, re-created (by the parent's `key`) whenever the URL
    // changes, so back/forward and reload always show the filters in the URL.
    <form
      onSubmit={handleSubmit}
      aria-label="Filter transfers"
      className="grid gap-4 rounded-lg border border-zinc-300 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-700"
    >
      <div>
        <label htmlFor="filter-recipient" className="text-sm font-medium">
          Recipient
        </label>
        <select
          id="filter-recipient"
          name="recipient"
          defaultValue={filters.recipientId ?? ""}
          className={field}
        >
          <option value="">All recipients</option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="filter-from" className="text-sm font-medium">
          From date
        </label>
        <input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={filters.dateFrom ?? ""}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="filter-to" className="text-sm font-medium">
          To date
        </label>
        <input
          id="filter-to"
          name="to"
          type="date"
          defaultValue={filters.dateTo ?? ""}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="filter-provider" className="text-sm font-medium">
          Provider
        </label>
        <input
          id="filter-provider"
          name="provider"
          type="text"
          maxLength={100}
          defaultValue={filters.provider ?? ""}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="filter-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="filter-status"
          name="status"
          defaultValue={filters.status ?? ""}
          className={field}
        >
          <option value="">Any status</option>
          {TRANSFER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Apply filters
        </button>
        {canClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-zinc-400 px-4 py-2 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:hover:bg-zinc-800"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </form>
  );
}
