// Turns what a person types ("100.10") into the strings the data layer and API
// use (ADR 0004), with string maths only. No `Number`, `parseFloat` or `*` on
// amounts anywhere, so "100.10" can never become 100.09999999999999.
import { currencyExponent } from "./money";

export type ParseResult =
  { ok: true; value: string } | { ok: false; message: string };

/** Largest amount a Postgres bigint (and so the API) can hold: 2^63 - 1. */
const MAX_MINOR_UNITS = (BigInt(1) << BigInt(63)) - BigInt(1);

/** Digits with an optional decimal part: "100", "100.10", "0.5". No signs, commas or exponents. */
const DECIMAL_TEXT = /^(\d+)(?:\.(\d+))?$/;

function notANumber(example: string): ParseResult {
  return {
    ok: false,
    message: `Enter a number using digits and a decimal point only, for example ${example}.`,
  };
}

/**
 * Converts typed money ("100.10") to whole minor units as a string ("10010").
 * `allowZero` is for fees. Rejects more decimal places than the currency has
 * (a GBP amount of 1.005 is an error, not a silent rounding).
 */
export function parseAmountInput(
  text: string,
  currency: string,
  { allowZero }: { allowZero: boolean },
): ParseResult {
  const typed = text.trim();
  if (typed === "") {
    return { ok: false, message: "Enter an amount." };
  }
  if (typed.startsWith("-")) {
    return {
      ok: false,
      message: allowZero
        ? "The fee cannot be negative."
        : "The amount must be greater than zero.",
    };
  }
  const match = DECIMAL_TEXT.exec(typed);
  if (!match) return notANumber("100.10");

  const exponent = currencyExponent(currency);
  const whole = match[1];
  const fraction = match[2] ?? "";
  if (fraction.length > exponent) {
    return {
      ok: false,
      message:
        exponent === 0
          ? `${currency} has no decimal places.`
          : `${currency} amounts have at most ${exponent} decimal place${exponent === 1 ? "" : "s"}.`,
    };
  }

  // BigInt of the digits strips leading zeros ("007.5" is fine) and is exact.
  const minor = BigInt(whole + fraction.padEnd(exponent, "0"));
  if (minor > MAX_MINOR_UNITS) {
    return { ok: false, message: "That amount is too large." };
  }
  if (minor === BigInt(0) && !allowZero) {
    return { ok: false, message: "The amount must be greater than zero." };
  }
  return { ok: true, value: minor.toString() };
}

/** Exchange rates keep at most 12 decimal places (the API's numeric(24,12)). */
export const RATE_MAX_DECIMALS = 12;

/**
 * Validates a typed exchange rate and returns it as a canonical decimal string
 * (no leading zeros, no trailing zeros): "1950.50" becomes "1950.5".
 */
export function parseRateInput(text: string): ParseResult {
  const typed = text.trim();
  if (typed === "") {
    return { ok: false, message: "Enter an exchange rate." };
  }
  if (typed.startsWith("-")) {
    return {
      ok: false,
      message: "The exchange rate must be greater than zero.",
    };
  }
  const match = DECIMAL_TEXT.exec(typed);
  if (!match) return notANumber("1950.5");

  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (
    (match[2] ?? "").length > RATE_MAX_DECIMALS &&
    fraction.length > RATE_MAX_DECIMALS
  ) {
    return {
      ok: false,
      message: `The exchange rate has at most ${RATE_MAX_DECIMALS} decimal places.`,
    };
  }
  const whole = BigInt(match[1]).toString();
  if (whole === "0" && fraction === "") {
    return {
      ok: false,
      message: "The exchange rate must be greater than zero.",
    };
  }
  return { ok: true, value: fraction === "" ? whole : `${whole}.${fraction}` };
}
