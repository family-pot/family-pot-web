"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/states";
import {
  DeletionRejectedError,
  countryName,
  getDataSource,
  type DataSource,
  type Recipient,
} from "@/src/data";
import { RecipientForm, type RecipientFormValues } from "./recipient-form";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; recipients: Recipient[] };

type Props = {
  /** Defaults to the app-wide data source. Tests pass their own. */
  dataSource?: DataSource;
};

const buttonClass =
  "rounded-md border border-zinc-400 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:hover:bg-zinc-800";

export function RecipientsView({ dataSource }: Props) {
  const [source] = useState(() => dataSource ?? getDataSource());
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const recipients = await source.recipients.list();
      setLoad({ status: "ready", recipients });
    } catch (error) {
      setLoad({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not load recipients.",
      });
    }
  }, [source]);

  useEffect(() => {
    // Initial load; setState happens after the awaited promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  function update(fn: (recipients: Recipient[]) => Recipient[]) {
    setLoad((current) =>
      current.status === "ready"
        ? { status: "ready", recipients: fn(current.recipients) }
        : current,
    );
  }

  async function create(values: RecipientFormValues) {
    const created = await source.recipients.create(toInput(values));
    update((list) => [...list, created]);
    setAdding(false);
  }

  async function save(id: string, values: RecipientFormValues) {
    const updated = await source.recipients.update(id, toInput(values));
    update((list) => list.map((item) => (item.id === id ? updated : item)));
    setEditingId(null);
  }

  async function remove(recipient: Recipient) {
    setDeleteError(null);
    try {
      await source.recipients.delete(recipient.id);
      update((list) => list.filter((item) => item.id !== recipient.id));
      setConfirmingId(null);
    } catch (error) {
      setDeleteError(
        error instanceof DeletionRejectedError
          ? `${recipient.name} was not deleted. ${error.reason}`
          : `${recipient.name} could not be deleted. Please try again.`,
      );
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Recipients</h1>
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className={buttonClass}
          >
            Add recipient
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-6">
          <RecipientForm onSubmit={create} onCancel={() => setAdding(false)} />
        </div>
      ) : null}

      {deleteError ? (
        <p
          role="alert"
          className="mt-6 font-medium text-red-800 dark:text-red-300"
        >
          <span aria-hidden="true">✕ </span>
          {deleteError}
        </p>
      ) : null}

      <div className="mt-6">
        {load.status === "loading" ? (
          <LoadingState label="Loading recipients…" />
        ) : load.status === "error" ? (
          <ErrorState message={load.message} onRetry={refresh} />
        ) : load.recipients.length === 0 ? (
          <EmptyState
            title="No recipients yet"
            description="Add a recipient to group transfers and compare costs."
          />
        ) : (
          <ul className="space-y-3" aria-label="Recipients">
            {load.recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
              >
                {editingId === recipient.id ? (
                  <RecipientForm
                    recipient={recipient}
                    onSubmit={(values) => save(recipient.id, values)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold break-words">
                        {recipient.name}
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {countryName(recipient.country)} ({recipient.country})
                      </p>
                      {recipient.notes ? (
                        <p className="mt-1 text-sm break-words">
                          {recipient.notes}
                        </p>
                      ) : null}
                    </div>
                    {confirmingId === recipient.id ? (
                      <div
                        role="group"
                        aria-label={`Confirm deleting ${recipient.name}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="text-sm">
                          Delete {recipient.name}?
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(recipient)}
                          className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className={buttonClass}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(recipient.id);
                            setAdding(false);
                          }}
                          aria-label={`Edit ${recipient.name}`}
                          className={buttonClass}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingId(recipient.id);
                            setDeleteError(null);
                          }}
                          aria-label={`Delete ${recipient.name}`}
                          className={buttonClass}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function toInput(values: RecipientFormValues) {
  // Always send notes (even empty) so clearing them on edit takes effect.
  return {
    name: values.name.trim(),
    country: values.country,
    notes: values.notes.trim(),
  };
}
