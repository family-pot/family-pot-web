"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/states";
import { ProvenanceBadge } from "@/src/components/provenance-badge";
import {
  NotFoundError,
  TRANSFER_STATUSES,
  ValidationError,
  getDataSource,
  validateTransferInput,
  type CreateTransferInput,
  type DataSource,
  type Recipient,
  type Transfer,
  type TransferStatus,
} from "@/src/data";
import { parseAmountInput, parseRateInput } from "@/src/lib/decimal-input";
import { SUPPORTED_CURRENCIES, minorUnitsToDecimal } from "@/src/lib/money";

/** What the person types: everything is text until it is converted on submit. */
export type TransferFormValues = {
  recipientId: string;
  transferDate: string;
  amount: string;
  currency: string;
  receivingCurrency: string;
  exchangeRate: string;
  fee: string;
  provider: string;
  purpose: string;
  status: TransferStatus;
  notes: string;
};

type Props = {
  /** Edit this transfer; otherwise the form creates one. */
  transferId?: string;
  /** Defaults to the app-wide data source. Tests pass their own. */
  dataSource?: DataSource;
};

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; recipients: Recipient[]; transfer?: Transfer };

const STATUS_LABELS: Record<TransferStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-400 bg-white px-3 py-2 text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[invalid=true]:border-red-700 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-50";
const buttonClass =
  "rounded-md border border-zinc-400 px-4 py-2 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:hover:bg-zinc-800";

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function initialValues(transfer?: Transfer): TransferFormValues {
  if (!transfer) {
    return {
      recipientId: "",
      transferDate: today(),
      amount: "",
      currency: "GBP",
      receivingCurrency: "NGN",
      exchangeRate: "",
      fee: "0",
      provider: "",
      purpose: "",
      status: "pending",
      notes: "",
    };
  }
  return {
    recipientId: transfer.recipientId,
    transferDate: transfer.transferDate,
    // Minor units back to the text the person typed: "10010" -> "100.10" (exact, string maths).
    amount: minorUnitsToDecimal(transfer.amount, transfer.currency),
    currency: transfer.currency,
    receivingCurrency: transfer.receivingCurrency,
    exchangeRate: transfer.exchangeRate,
    fee: minorUnitsToDecimal(transfer.fee, transfer.currency),
    provider: transfer.provider,
    purpose: transfer.purpose ?? "",
    status: transfer.status,
    notes: transfer.notes ?? "",
  };
}

/**
 * Converts the typed values to a data-layer input and validates them. Returns
 * either the input or field-keyed messages. Amounts, the fee and the rate go
 * through string-only parsing, never a float.
 */
export function buildTransferInput(
  values: TransferFormValues,
):
  | { ok: true; input: CreateTransferInput }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const supported = SUPPORTED_CURRENCIES as readonly string[];
  const currencyOk = supported.includes(values.currency);

  let amount = "";
  let fee = "0";
  if (currencyOk) {
    const parsedAmount = parseAmountInput(values.amount, values.currency, {
      allowZero: false,
    });
    if (parsedAmount.ok) amount = parsedAmount.value;
    else errors.amount = parsedAmount.message;

    // A blank fee means no fee.
    if (values.fee.trim() !== "") {
      const parsedFee = parseAmountInput(values.fee, values.currency, {
        allowZero: true,
      });
      if (parsedFee.ok) fee = parsedFee.value;
      else errors.fee = parsedFee.message;
    }
  }

  let exchangeRate = "";
  const parsedRate = parseRateInput(values.exchangeRate);
  if (parsedRate.ok) exchangeRate = parsedRate.value;
  else errors.exchangeRate = parsedRate.message;

  const input: CreateTransferInput = {
    recipientId: values.recipientId,
    transferDate: values.transferDate,
    amount,
    currency: values.currency,
    receivingCurrency: values.receivingCurrency,
    exchangeRate,
    fee,
    provider: values.provider.trim(),
    status: values.status,
    ...(values.purpose.trim() ? { purpose: values.purpose.trim() } : {}),
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  };

  // The remaining rules (recipient, date, currencies, lengths, status) come from
  // the same validation the data source uses; keep messages already set above.
  for (const [field, message] of Object.entries(validateTransferInput(input))) {
    if (
      !errors[field] &&
      !(field === "amount" && amount === "") &&
      !(field === "exchangeRate" && exchangeRate === "")
    ) {
      errors[field] = message;
    }
  }
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, input };
}

export function TransferForm({ transferId, dataSource }: Props) {
  const router = useRouter();
  const id = useId();
  const [source] = useState(() => dataSource ?? getDataSource());
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<TransferFormValues>(() =>
    initialValues(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fetchData = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const recipients = await source.recipients.list();
      if (!transferId) {
        setLoad({ status: "ready", recipients });
        return;
      }
      let transfer: Transfer;
      try {
        transfer = await source.transfers.get(transferId);
      } catch (error) {
        if (error instanceof NotFoundError) {
          setLoad({ status: "missing" });
          return;
        }
        throw error;
      }
      setValues(initialValues(transfer));
      setLoad({ status: "ready", recipients, transfer });
    } catch (error) {
      setLoad({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not load the form.",
      });
    }
  }, [source, transferId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const set = <K extends keyof TransferFormValues>(
    field: K,
    value: TransferFormValues[K],
  ) => setValues((current) => ({ ...current, [field]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const built = buildTransferInput(values);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      if (transferId) await source.transfers.update(transferId, built.input);
      else await source.transfers.create(built.input);
      router.push("/transfers");
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(error.fieldErrors);
      } else if (
        error instanceof NotFoundError &&
        error.resource === "Recipient"
      ) {
        setErrors({
          recipientId: "That recipient no longer exists. Choose another.",
        });
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : "Could not save the transfer.",
        );
      }
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setFormError(null);
    setSubmitting(true);
    try {
      await source.transfers.delete(transferId!);
      router.push("/transfers");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not delete the transfer.",
      );
      setConfirmingDelete(false);
      setSubmitting(false);
    }
  }

  const field = (name: string) => ({
    id: `${id}-${name}`,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  const fieldError = (name: string) =>
    errors[name] ? (
      <p
        id={`${id}-${name}-error`}
        className="mt-1 text-sm text-red-800 dark:text-red-300"
      >
        <span aria-hidden="true">✕ </span>
        {errors[name]}
      </p>
    ) : null;

  const title = transferId ? "Edit transfer" : "Add transfer";

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

      <div className="mt-6">
        {load.status === "loading" ? (
          <LoadingState label="Loading…" />
        ) : load.status === "error" ? (
          <ErrorState message={load.message} onRetry={fetchData} />
        ) : load.status === "missing" ? (
          <EmptyState
            title="Transfer not found"
            description="It may have been deleted."
            action={
              <Link href="/transfers" className={buttonClass}>
                Back to transfers
              </Link>
            }
          />
        ) : load.recipients.length === 0 ? (
          <EmptyState
            title="Add a recipient first"
            description="A transfer is sent to a recipient."
            action={
              <Link href="/recipients" className={buttonClass}>
                Go to recipients
              </Link>
            }
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label={title}
            className="space-y-4"
          >
            <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <ProvenanceBadge provenance="user-entered" />
              Everything you enter here is saved as entered by you. Nothing is
              looked up or checked.
            </p>

            {Object.keys(errors).length > 0 ? (
              <p
                role="alert"
                className="font-medium text-red-800 dark:text-red-300"
              >
                <span aria-hidden="true">✕ </span>
                Please fix the {Object.keys(errors).length} problem
                {Object.keys(errors).length === 1 ? "" : "s"} below.
              </p>
            ) : null}

            <div>
              <label htmlFor={`${id}-recipientId`} className="font-medium">
                Recipient
              </label>
              <select
                {...field("recipientId")}
                value={values.recipientId}
                onChange={(e) => set("recipientId", e.target.value)}
                className={inputClass}
              >
                <option value="">Select a recipient</option>
                {load.recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {fieldError("recipientId")}
            </div>

            <div>
              <label htmlFor={`${id}-transferDate`} className="font-medium">
                Date sent
              </label>
              <input
                {...field("transferDate")}
                type="date"
                value={values.transferDate}
                onChange={(e) => set("transferDate", e.target.value)}
                className={inputClass}
              />
              {fieldError("transferDate")}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-amount`} className="font-medium">
                  Amount sent
                </label>
                <input
                  {...field("amount")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="100.10"
                  value={values.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  className={inputClass}
                />
                {fieldError("amount")}
              </div>
              <div>
                <label htmlFor={`${id}-currency`} className="font-medium">
                  Sending currency
                </label>
                <select
                  {...field("currency")}
                  value={values.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  className={inputClass}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {fieldError("currency")}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`${id}-receivingCurrency`}
                  className="font-medium"
                >
                  Receiving currency
                </label>
                <select
                  {...field("receivingCurrency")}
                  value={values.receivingCurrency}
                  onChange={(e) => set("receivingCurrency", e.target.value)}
                  className={inputClass}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {fieldError("receivingCurrency")}
              </div>
              <div>
                <label htmlFor={`${id}-exchangeRate`} className="font-medium">
                  Exchange rate
                </label>
                <input
                  {...field("exchangeRate")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="1950.5"
                  value={values.exchangeRate}
                  onChange={(e) => set("exchangeRate", e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Receiving currency per 1 unit of the sending currency.
                </p>
                {fieldError("exchangeRate")}
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-fee`} className="font-medium">
                Fee{" "}
                <span className="font-normal">
                  (in the sending currency, {values.currency})
                </span>
              </label>
              <input
                {...field("fee")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="3.49"
                value={values.fee}
                onChange={(e) => set("fee", e.target.value)}
                className={inputClass}
              />
              {fieldError("fee")}
            </div>

            <div>
              <label htmlFor={`${id}-provider`} className="font-medium">
                Provider
              </label>
              <input
                {...field("provider")}
                type="text"
                autoComplete="off"
                value={values.provider}
                onChange={(e) => set("provider", e.target.value)}
                className={inputClass}
              />
              {fieldError("provider")}
            </div>

            <div>
              <label htmlFor={`${id}-purpose`} className="font-medium">
                Purpose <span className="font-normal">(optional)</span>
              </label>
              <input
                {...field("purpose")}
                type="text"
                autoComplete="off"
                value={values.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                className={inputClass}
              />
              {fieldError("purpose")}
            </div>

            <div>
              <label htmlFor={`${id}-status`} className="font-medium">
                Status
              </label>
              <select
                {...field("status")}
                value={values.status}
                onChange={(e) =>
                  set("status", e.target.value as TransferStatus)
                }
                className={inputClass}
              >
                {TRANSFER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {fieldError("status")}
            </div>

            <div>
              <label htmlFor={`${id}-notes`} className="font-medium">
                Notes <span className="font-normal">(optional)</span>
              </label>
              <textarea
                {...field("notes")}
                rows={3}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                className={inputClass}
              />
              {fieldError("notes")}
            </div>

            {formError ? (
              <p
                role="alert"
                className="font-medium text-red-800 dark:text-red-300"
              >
                <span aria-hidden="true">✕ </span>
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {submitting
                  ? "Saving…"
                  : transferId
                    ? "Save changes"
                    : "Add transfer"}
              </button>
              <Link href="/transfers" className={buttonClass}>
                Cancel
              </Link>
            </div>

            {transferId ? (
              <div className="border-t border-zinc-300 pt-4 dark:border-zinc-700">
                {confirmingDelete ? (
                  <div
                    role="group"
                    aria-label="Confirm deleting this transfer"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-sm">
                      Delete this transfer? This cannot be undone.
                    </span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={submitting}
                      className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className={buttonClass}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className={buttonClass}
                  >
                    Delete transfer
                  </button>
                )}
              </div>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
