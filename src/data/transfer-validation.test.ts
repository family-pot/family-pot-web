import { describe, expect, it } from "vitest";
import { MockDataSource, NotFoundError, ValidationError } from "./index";
import {
  isAllowedTransferDate,
  validateTransferInput,
} from "./transfer-validation";

const now = new Date("2026-11-05T12:00:00Z");
const valid = {
  recipientId: "r1",
  transferDate: "2026-11-01",
  amount: "10010",
  currency: "GBP",
  receivingCurrency: "NGN",
  exchangeRate: "1950.5",
  fee: "349",
  provider: "Wise",
  status: "pending" as const,
};
const errors = (overrides: Record<string, unknown>) =>
  validateTransferInput({ ...valid, ...overrides } as never, now);

describe("validateTransferInput", () => {
  it("accepts a valid transfer", () => {
    expect(validateTransferInput(valid, now)).toEqual({});
  });

  it("requires a recipient, provider and a supported pair of currencies", () => {
    expect(errors({ recipientId: "" })).toHaveProperty("recipientId");
    expect(errors({ provider: "  " })).toHaveProperty("provider");
    expect(errors({ currency: "XXX" })).toHaveProperty("currency");
    expect(errors({ receivingCurrency: "JPY" })).toHaveProperty(
      "receivingCurrency",
    );
  });

  it("requires a positive amount and a non-negative fee, as minor-unit strings", () => {
    for (const amount of ["0", "-1", "1.5", "", 100, "9223372036854775808"]) {
      expect(errors({ amount }), String(amount)).toHaveProperty("amount");
    }
    expect(errors({ fee: "0" })).toEqual({});
    for (const fee of ["-1", "1.5", 5]) {
      expect(errors({ fee }), String(fee)).toHaveProperty("fee");
    }
  });

  it("requires a positive rate with at most 12 decimals", () => {
    for (const exchangeRate of [
      "0",
      "0.0",
      "-1",
      "abc",
      "1.0000000000001",
      "",
      5,
    ]) {
      expect(errors({ exchangeRate }), String(exchangeRate)).toHaveProperty(
        "exchangeRate",
      );
    }
  });

  it("applies the date rule: real, from 2000-01-01, at most 1 day ahead", () => {
    for (const transferDate of ["2026-11-05", "2026-11-06", "2000-01-01"]) {
      expect(errors({ transferDate }), transferDate).toEqual({});
    }
    for (const transferDate of [
      "2026-11-07",
      "1999-12-31",
      "2026-02-30",
      "",
      "soon",
    ]) {
      expect(errors({ transferDate }), transferDate).toHaveProperty(
        "transferDate",
      );
    }
    expect(
      isAllowedTransferDate("2026-11-06", new Date("2026-11-05T23:59:59Z")),
    ).toBe(true);
    expect(
      isAllowedTransferDate("2026-11-07", new Date("2026-11-05T23:59:59Z")),
    ).toBe(false);
  });

  it("limits lengths and checks the status", () => {
    expect(errors({ provider: "p".repeat(101) })).toHaveProperty("provider");
    expect(errors({ purpose: "p".repeat(201) })).toHaveProperty("purpose");
    expect(errors({ notes: "n".repeat(501) })).toHaveProperty("notes");
    expect(errors({ status: "done" })).toHaveProperty("status");
  });
});

describe("MockDataSource transfers apply the same rules", () => {
  const source = () => new MockDataSource({ delayMs: 0 });
  const base = { ...valid, recipientId: "sample-recipient-amara" };

  it("rejects invalid creates and updates with field errors", async () => {
    const ds = source();
    const error = await ds.transfers
      .create({ ...base, amount: "0", exchangeRate: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys((error as ValidationError).fieldErrors).sort()).toEqual([
      "amount",
      "exchangeRate",
    ]);

    const [first] = (await ds.transfers.list()).items;
    await expect(
      ds.transfers.update(first.id, { currency: "XXX" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("reports an unknown recipient as not found, on create and on update", async () => {
    const ds = source();
    await expect(
      ds.transfers.create({ ...base, recipientId: "nope" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const [first] = (await ds.transfers.list()).items;
    await expect(
      ds.transfers.update(first.id, { recipientId: "nope" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("defaults the fee to zero and can move a transfer to another recipient", async () => {
    const ds = source();
    const created = await ds.transfers.create({ ...base, fee: undefined });
    expect(created.fee).toBe("0");
    const moved = await ds.transfers.update(created.id, {
      recipientId: "sample-recipient-priya",
    });
    expect(moved.recipientId).toBe("sample-recipient-priya");
  });
});
