import { describe, expect, it } from "vitest";
import { parseAmountInput, parseRateInput } from "./decimal-input";
import { formatMoney, minorUnitsToDecimal } from "./money";

const amount = (text: string, currency = "GBP", allowZero = false) =>
  parseAmountInput(text, currency, { allowZero });
const ok = (value: string) => ({ ok: true, value });

describe("parseAmountInput: decimal text to minor-unit strings", () => {
  it("converts typed decimals exactly", () => {
    expect(amount("100.10")).toEqual(ok("10010"));
    expect(amount("100.1")).toEqual(ok("10010"));
    expect(amount("100")).toEqual(ok("10000"));
    expect(amount("0.1")).toEqual(ok("10"));
    expect(amount("0.01")).toEqual(ok("1"));
    expect(amount("0.30")).toEqual(ok("30"));
    expect(amount("19.99")).toEqual(ok("1999"));
    expect(amount("1.15")).toEqual(ok("115")); // 1.15 * 100 is 114.99999999999999 as a float
    expect(amount("4.35")).toEqual(ok("435")); // 4.35 * 100 is 434.99999999999994 as a float
    expect(amount("0.07")).toEqual(ok("7"));
  });

  it("trims whitespace and strips leading zeros", () => {
    expect(amount("  100.10  ")).toEqual(ok("10010"));
    expect(amount("007.50")).toEqual(ok("750"));
    expect(amount("0")).toEqual({
      ok: false,
      message: "The amount must be greater than zero.",
    });
  });

  it("is exact for very large amounts, where floats lose digits", () => {
    expect(amount("90071992547409.93")).toEqual(ok("9007199254740993"));
    expect(amount("92233720368547758.07")).toEqual(ok("9223372036854775807")); // the bigint maximum
    expect(amount("92233720368547758.08")).toEqual({
      ok: false,
      message: "That amount is too large.",
    });
  });

  it("follows the currency's decimal places (0, 2 and 3)", () => {
    expect(amount("500", "JPY")).toEqual(ok("500"));
    expect(amount("1.234", "KWD")).toEqual(ok("1234"));
    expect(amount("1.2", "KWD")).toEqual(ok("1200"));
    expect(amount("500.5", "JPY")).toEqual({
      ok: false,
      message: "JPY has no decimal places.",
    });
    expect(amount("1.005", "GBP")).toEqual({
      ok: false,
      message: "GBP amounts have at most 2 decimal places.",
    });
    expect(amount("1.2345", "KWD")).toEqual({
      ok: false,
      message: "KWD amounts have at most 3 decimal places.",
    });
  });

  it("rejects text that is not a plain decimal, with a clear message", () => {
    for (const bad of [
      "abc",
      "1,000.50",
      "1e3",
      ".5",
      "5.",
      "1.2.3",
      "$10",
      "10 000",
      "０１",
    ]) {
      const result = amount(bad);
      expect(result.ok, bad).toBe(false);
      expect(result.ok === false && result.message).toMatch(
        /digits and a decimal point/,
      );
    }
  });

  it("rejects empty and negative input, saying why", () => {
    expect(amount("")).toEqual({ ok: false, message: "Enter an amount." });
    expect(amount("   ")).toEqual({ ok: false, message: "Enter an amount." });
    expect(amount("-5")).toEqual({
      ok: false,
      message: "The amount must be greater than zero.",
    });
    expect(amount("-0.01", "GBP", true)).toEqual({
      ok: false,
      message: "The fee cannot be negative.",
    });
  });

  it("allows a zero fee only when asked", () => {
    expect(amount("0", "GBP", true)).toEqual(ok("0"));
    expect(amount("0.00", "GBP", true)).toEqual(ok("0"));
    expect(amount("0", "GBP", false).ok).toBe(false);
  });

  it("never passes through a JavaScript float", () => {
    const originalNumber = globalThis.Number;
    const originalParseFloat = globalThis.parseFloat;
    const calls: string[] = [];
    globalThis.Number = new Proxy(originalNumber, {
      apply(target, thisArg, args: [unknown]) {
        calls.push("Number");
        return Reflect.apply(target, thisArg, args);
      },
    });
    globalThis.parseFloat = ((value: string) => {
      calls.push("parseFloat");
      return originalParseFloat(value);
    }) as typeof parseFloat;
    try {
      parseAmountInput("100.10", "GBP", { allowZero: false });
      parseAmountInput("90071992547409.93", "GBP", { allowZero: false });
      parseRateInput("1950.50");
    } finally {
      globalThis.Number = originalNumber;
      globalThis.parseFloat = originalParseFloat;
    }
    expect(calls).toEqual([]);
  });

  it("round-trips with the display helpers: typed text, stored value and shown amount agree", () => {
    for (const typed of [
      "100.10",
      "0.01",
      "19.99",
      "1.15",
      "90071992547409.93",
      "0.10",
    ]) {
      const parsed = amount(typed);
      expect(parsed.ok).toBe(true);
      const stored = (parsed as { value: string }).value;
      // Back to text for editing: the same digits (a trailing zero is kept).
      expect(minorUnitsToDecimal(stored, "GBP")).toBe(
        typed.includes(".")
          ? typed.padEnd(typed.indexOf(".") + 3, "0")
          : `${typed}.00`,
      );
    }
    expect(formatMoney("10010", "GBP", "en-GB")).toBe("£100.10");
  });
});

describe("parseRateInput", () => {
  it("returns a canonical decimal string", () => {
    expect(parseRateInput("1950.5")).toEqual(ok("1950.5"));
    expect(parseRateInput("1950.50")).toEqual(ok("1950.5"));
    expect(parseRateInput("2000.000")).toEqual(ok("2000"));
    expect(parseRateInput("007.25")).toEqual(ok("7.25"));
    expect(parseRateInput(" 0.5 ")).toEqual(ok("0.5"));
    expect(parseRateInput("0.000000000001")).toEqual(ok("0.000000000001"));
    expect(parseRateInput("123456789012.123456789012")).toEqual(
      ok("123456789012.123456789012"),
    );
  });

  it("allows trailing zeros beyond 12 places but not 13 significant decimals", () => {
    expect(parseRateInput("1.5000000000000")).toEqual(ok("1.5"));
    expect(parseRateInput("1.0000000000001").ok).toBe(false);
  });

  it("rejects zero, negative, empty and non-numeric input", () => {
    expect(parseRateInput("")).toEqual({
      ok: false,
      message: "Enter an exchange rate.",
    });
    expect(parseRateInput("0")).toEqual({
      ok: false,
      message: "The exchange rate must be greater than zero.",
    });
    expect(parseRateInput("0.000")).toEqual({
      ok: false,
      message: "The exchange rate must be greater than zero.",
    });
    expect(parseRateInput("-1")).toEqual({
      ok: false,
      message: "The exchange rate must be greater than zero.",
    });
    for (const bad of ["abc", "1,5", "1e3", ".5", "5.", "1.2.3"]) {
      expect(parseRateInput(bad).ok, bad).toBe(false);
    }
  });
});
