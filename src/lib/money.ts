// Display helpers for ADR 0004: an amount is a string of whole MINOR units
// plus an ISO 4217 code ("15000" with GBP is 150.00). Nothing here converts an
// amount to a JavaScript number, so large and small values stay exact.

/** Decimal places of the minor unit, mirroring the table in family-pot-api. */
const EXPONENTS: Record<string, number> = {
  GBP: 2,
  USD: 2,
  EUR: 2,
  CAD: 2,
  NGN: 2,
  GHS: 2,
  KES: 2,
  INR: 2,
  PHP: 2,
  // Known so 0- and 3-decimal currencies format correctly; not MVP currencies.
  JPY: 0,
  KWD: 3,
};

/** The currencies the product accepts today (ADR 0004). */
export const SUPPORTED_CURRENCIES = [
  "GBP",
  "USD",
  "EUR",
  "CAD",
  "NGN",
  "GHS",
  "KES",
  "INR",
  "PHP",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const MINOR_UNITS = /^(0|[1-9]\d*)$/;
/** Largest amount a Postgres bigint (and so the API) can hold: 2^63 - 1. */
const MAX_MINOR_UNITS = (BigInt(1) << BigInt(63)) - BigInt(1);

export const DEFAULT_LOCALE = "en-GB";

export class MoneyFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyFormatError";
  }
}

/** Decimal places in the currency's minor unit (0 for JPY, 2 for GBP, 3 for KWD). */
export function currencyExponent(currency: string): number {
  // Own keys only: `EXPONENTS["toString"]` would otherwise find an inherited function.
  if (!Object.prototype.hasOwnProperty.call(EXPONENTS, currency)) {
    throw new MoneyFormatError(`Unknown currency "${currency}".`);
  }
  return EXPONENTS[currency];
}

/**
 * Turns whole minor units into a plain decimal string of major units, using
 * string maths only: ("15000", "GBP") -> "150.00", ("5", "GBP") -> "0.05",
 * ("1234", "JPY") -> "1234".
 */
export function minorUnitsToDecimal(
  minorUnits: string,
  currency: string,
): string {
  if (typeof minorUnits !== "string" || !MINOR_UNITS.test(minorUnits)) {
    throw new MoneyFormatError(
      `"${String(minorUnits)}" is not a whole number of minor units.`,
    );
  }
  if (BigInt(minorUnits) > MAX_MINOR_UNITS) {
    throw new MoneyFormatError("Amount is larger than the supported maximum.");
  }
  const exponent = currencyExponent(currency);
  if (exponent === 0) return minorUnits;
  const padded = minorUnits.padStart(exponent + 1, "0");
  return `${padded.slice(0, -exponent)}.${padded.slice(-exponent)}`;
}

/**
 * Formats an amount for display, for example `formatMoney("15000", "GBP")` is
 * "£150.00". `Intl.NumberFormat` accepts a decimal STRING and formats it
 * exactly, so the amount never becomes a float. Throws `MoneyFormatError` for
 * anything that is not a valid amount, rather than showing a wrong number.
 */
export function formatMoney(
  minorUnits: string,
  currency: string,
  locale: string = DEFAULT_LOCALE,
): string {
  const decimal = minorUnitsToDecimal(minorUnits, currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    // The lib typings only list number | bigint here, but a decimal string is
    // supported (Intl.NumberFormat v3) and is the whole point: no float.
    decimal as unknown as number,
  );
}
