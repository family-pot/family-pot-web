import { SUPPORTED_CURRENCIES } from "@/src/lib/money";
import { TRANSFER_STATUSES } from "./transfer-status";
import { isCalendarDate } from "./transfer-query";
import type { CreateTransferInput } from "./types";

const MINOR_UNITS = /^(0|[1-9]\d*)$/;
const RATE = /^(0|[1-9]\d*)(\.\d{1,12})?$/;
const MAX_MINOR_UNITS = (BigInt(1) << BigInt(63)) - BigInt(1);

export const EARLIEST_TRANSFER_DATE = "2000-01-01";
export const MAX_DAYS_IN_FUTURE = 1;

/** A real date from 2000-01-01 up to one day after today (UTC), like the API. */
export function isAllowedTransferDate(
  value: unknown,
  now = new Date(),
): boolean {
  if (!isCalendarDate(value) || value < EARLIEST_TRANSFER_DATE) return false;
  const latest = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + MAX_DAYS_IN_FUTURE,
  );
  return new Date(`${value}T00:00:00Z`).getTime() <= latest;
}

function minorUnitsProblem(
  value: unknown,
  { positive }: { positive: boolean },
): string | undefined {
  if (typeof value !== "string" || !MINOR_UNITS.test(value)) {
    return "must be a whole number of minor units, as a string.";
  }
  const amount = BigInt(value);
  if (amount > MAX_MINOR_UNITS) return "is too large.";
  if (positive && amount === BigInt(0)) return "must be greater than zero.";
  return undefined;
}

/**
 * Field-keyed problems with a transfer (empty when valid). Shared by the form
 * (client validation) and the data sources, so both report the same errors.
 * Field names are the ones of `CreateTransferInput`.
 */
export function validateTransferInput(
  input: Partial<CreateTransferInput>,
  now = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  const currencies = SUPPORTED_CURRENCIES as readonly string[];

  if (!input.recipientId) errors.recipientId = "Choose a recipient.";
  if (!isAllowedTransferDate(input.transferDate, now)) {
    errors.transferDate = `Enter a real date, from ${EARLIEST_TRANSFER_DATE} to at most ${MAX_DAYS_IN_FUTURE} day after today.`;
  }

  const amountProblem = minorUnitsProblem(input.amount, { positive: true });
  if (amountProblem) errors.amount = `Amount ${amountProblem}`;
  const feeProblem =
    input.fee === undefined
      ? undefined
      : minorUnitsProblem(input.fee, { positive: false });
  if (feeProblem) errors.fee = `Fee ${feeProblem}`;

  if (!input.currency || !currencies.includes(input.currency)) {
    errors.currency = `Choose a sending currency (${currencies.join(", ")}).`;
  }
  if (
    !input.receivingCurrency ||
    !currencies.includes(input.receivingCurrency)
  ) {
    errors.receivingCurrency = `Choose a receiving currency (${currencies.join(", ")}).`;
  }
  if (
    typeof input.exchangeRate !== "string" ||
    !RATE.test(input.exchangeRate) ||
    /^0(\.0+)?$/.test(input.exchangeRate)
  ) {
    errors.exchangeRate =
      "Exchange rate must be a positive decimal with at most 12 decimal places.";
  }

  const provider = input.provider?.trim() ?? "";
  if (provider === "") errors.provider = "Enter the provider.";
  else if (provider.length > 100)
    errors.provider = "Provider must be at most 100 characters.";
  if ((input.purpose?.length ?? 0) > 200)
    errors.purpose = "Purpose must be at most 200 characters.";
  if ((input.notes?.length ?? 0) > 500)
    errors.notes = "Notes must be at most 500 characters.";
  if (
    input.status !== undefined &&
    !(TRANSFER_STATUSES as readonly string[]).includes(input.status)
  ) {
    errors.status = `Status must be one of ${TRANSFER_STATUSES.join(", ")}.`;
  }
  return errors;
}
