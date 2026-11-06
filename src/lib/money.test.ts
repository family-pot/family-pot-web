import { describe, expect, it } from "vitest";
import {
  MoneyFormatError,
  SUPPORTED_CURRENCIES,
  currencyExponent,
  formatMoney,
  minorUnitsToDecimal,
} from "./money";

describe("currencyExponent", () => {
  it("is 2 for every MVP currency, 0 for JPY and 3 for KWD", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(currencyExponent(currency)).toBe(2);
    }
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("KWD")).toBe(3);
  });

  it("rejects unknown currencies, including prototype keys", () => {
    expect(() => currencyExponent("XXX")).toThrow(MoneyFormatError);
    expect(() => currencyExponent("toString")).toThrow(MoneyFormatError);
    expect(() => currencyExponent("gbp")).toThrow(MoneyFormatError);
  });
});

describe("minorUnitsToDecimal", () => {
  it("places the decimal point by the currency exponent, with string maths", () => {
    expect(minorUnitsToDecimal("15000", "GBP")).toBe("150.00");
    expect(minorUnitsToDecimal("5", "GBP")).toBe("0.05");
    expect(minorUnitsToDecimal("0", "GBP")).toBe("0.00");
    expect(minorUnitsToDecimal("1234", "JPY")).toBe("1234");
    expect(minorUnitsToDecimal("1234", "KWD")).toBe("1.234");
    expect(minorUnitsToDecimal("7", "KWD")).toBe("0.007");
  });

  it("rejects anything that is not a canonical whole number of minor units", () => {
    for (const bad of ["", "-5", "1.5", "01", " 1", "1e3", "abc", "15,000"]) {
      expect(() => minorUnitsToDecimal(bad, "GBP"), bad).toThrow(
        MoneyFormatError,
      );
    }
    expect(() => minorUnitsToDecimal(150 as unknown as string, "GBP")).toThrow(
      MoneyFormatError,
    );
  });

  it("rejects amounts above the API's bigint maximum", () => {
    expect(minorUnitsToDecimal("9223372036854775807", "GBP")).toBe(
      "92233720368547758.07",
    );
    expect(() => minorUnitsToDecimal("9223372036854775808", "GBP")).toThrow(
      /maximum/,
    );
  });
});

describe("formatMoney", () => {
  it("formats 2-decimal currencies", () => {
    expect(formatMoney("15000", "GBP")).toBe("£150.00");
    expect(formatMoney("29257500", "NGN")).toBe("NGN\u00a0292,575.00");
    expect(formatMoney("1999", "USD", "en-US")).toBe("$19.99");
    expect(formatMoney("5", "EUR", "en-IE")).toBe("€0.05");
  });

  it("handles 0-decimal and 3-decimal currencies", () => {
    expect(formatMoney("28500", "JPY", "en-US")).toBe("¥28,500");
    expect(formatMoney("3800", "KWD", "en-US")).toBe("KWD\u00a03.800");
    expect(formatMoney("1", "KWD", "en-US")).toBe("KWD\u00a00.001");
  });

  it("formats zero and tiny amounts", () => {
    expect(formatMoney("0", "GBP")).toBe("£0.00");
    expect(formatMoney("1", "GBP")).toBe("£0.01");
  });

  it("is exact above Number.MAX_SAFE_INTEGER, where floats lose digits", () => {
    // 9007199254740993 is 2^53 + 1: Number() would round it to ...992.
    expect(Number("9007199254740993")).toBe(9007199254740992);
    expect(formatMoney("9007199254740993", "JPY", "en-US")).toBe(
      "¥9,007,199,254,740,993",
    );
    expect(formatMoney("9007199254740993", "GBP", "en-US")).toBe(
      "£90,071,992,547,409.93",
    );
    expect(formatMoney("9223372036854775807", "GBP", "en-US")).toBe(
      "£92,233,720,368,547,758.07",
    );
  });

  it("never turns the amount into a number", () => {
    // If `Number(...)` were called, this poisoned value would be observed.
    const original = globalThis.Number;
    let calls = 0;
    globalThis.Number = new Proxy(original, {
      apply(target, thisArg, args: [unknown]) {
        calls++;
        return Reflect.apply(target, thisArg, args);
      },
    });
    try {
      formatMoney("9007199254740993", "GBP", "en-US");
    } finally {
      globalThis.Number = original;
    }
    expect(calls).toBe(0);
  });

  it("follows the locale", () => {
    expect(formatMoney("123456789", "EUR", "de-DE")).toBe("1.234.567,89 €");
    expect(formatMoney("123456789", "GBP", "en-GB")).toBe("£1,234,567.89");
  });

  it("throws instead of showing a wrong number", () => {
    expect(() => formatMoney("12.50", "GBP")).toThrow(MoneyFormatError);
    expect(() => formatMoney("100", "XXX")).toThrow(MoneyFormatError);
  });
});
