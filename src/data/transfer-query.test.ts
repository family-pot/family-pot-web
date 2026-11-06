import { describe, expect, it } from "vitest";
import {
  MockDataSource,
  ValidationError,
  queryTransfers,
  sampleTransferCount,
} from "./index";
import { decodeCursor, encodeCursor, isCalendarDate } from "./transfer-query";
import { sampleTransfers } from "./sample-data";

const all = [...sampleTransfers];
const expectedOrder = [...all]
  .sort((a, b) =>
    a.transferDate === b.transferDate
      ? a.id < b.id
        ? 1
        : -1
      : a.transferDate < b.transferDate
        ? 1
        : -1,
  )
  .map((t) => t.id);

function walk(query: Parameters<typeof queryTransfers>[1] = {}) {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 100; i++) {
    const page = queryTransfers(all, { ...query, cursor });
    ids.push(...page.items.map((t) => t.id));
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error("did not terminate");
}

describe("sample transfers", () => {
  it("is large enough for pagination to matter and uses minor-unit strings", () => {
    expect(sampleTransferCount).toBe(all.length);
    expect(all.length).toBeGreaterThan(10);
    for (const t of all) {
      expect(t.amount).toMatch(/^(0|[1-9]\d*)$/);
      expect(t.fee).toMatch(/^(0|[1-9]\d*)$/);
    }
  });
});

describe("queryTransfers: ordering and pagination", () => {
  it("sorts newest first with the id as tiebreak", () => {
    expect(queryTransfers(all, { limit: 100 }).items.map((t) => t.id)).toEqual(
      expectedOrder,
    );
  });

  it.each([1, 3, 5, 13, 14, 15, 100])(
    "walks every page with limit %i: no duplicates, no gaps",
    (limit) => {
      const ids = walk({ limit });
      expect(ids).toEqual(expectedOrder);
      expect(new Set(ids).size).toBe(all.length);
    },
  );

  it("reports hasMore and a null cursor on the last page, even on an exact boundary", () => {
    const first = queryTransfers(all, { limit: 7 });
    expect(first.hasMore).toBe(true);
    const second = queryTransfers(all, { limit: 7, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(7);
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it("defaults to 20 per page", () => {
    expect(queryTransfers(all).limit).toBe(20);
  });

  it("returns copies, so callers cannot change the store", () => {
    const [first] = queryTransfers(all, { limit: 1 }).items;
    first.provider = "Mutated";
    expect(
      queryTransfers(all, { limit: 100 }).items.some(
        (t) => t.provider === "Mutated",
      ),
    ).toBe(false);
  });

  it("stays correct when an item is removed between pages", () => {
    const page1 = queryTransfers(all, { limit: 5 });
    const remaining = all.filter((t) => t.id !== expectedOrder[8]); // not yet paged
    const page2 = queryTransfers(remaining, {
      limit: 100,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.map((t) => t.id)).toEqual(
      expectedOrder.slice(5).filter((id) => id !== expectedOrder[8]),
    );
  });
});

describe("queryTransfers: filters", () => {
  const ids = (q: Parameters<typeof queryTransfers>[1]) => walk(q);
  const expectIds = (filter: (t: (typeof all)[number]) => boolean) =>
    expectedOrder.filter((id) => filter(all.find((t) => t.id === id)!));

  it("filters by recipient, provider (case-insensitive), status and date range (inclusive)", () => {
    expect(ids({ recipientId: "sample-recipient-priya" })).toEqual(
      expectIds((t) => t.recipientId === "sample-recipient-priya"),
    );
    expect(ids({ provider: "WISE" })).toEqual(
      expectIds((t) => t.provider === "Wise"),
    );
    expect(ids({ provider: " wise " })).toEqual(
      expectIds((t) => t.provider === "Wise"),
    );
    expect(ids({ status: "failed" })).toEqual(
      expectIds((t) => t.status === "failed"),
    );
    expect(ids({ dateFrom: "2026-03-10", dateTo: "2026-04-11" })).toEqual(
      expectIds(
        (t) => t.transferDate >= "2026-03-10" && t.transferDate <= "2026-04-11",
      ),
    );
    expect(ids({ dateFrom: "2026-04-11", dateTo: "2026-04-11" })).toHaveLength(
      1,
    );
  });

  it("combines filters and returns an empty page when nothing matches", () => {
    expect(
      ids({
        recipientId: "sample-recipient-amara",
        status: "completed",
        provider: "Wise",
      }),
    ).toEqual(
      expectIds(
        (t) =>
          t.recipientId === "sample-recipient-amara" &&
          t.status === "completed" &&
          t.provider === "Wise",
      ),
    );
    const none = queryTransfers(all, { provider: "Nobody" });
    expect(none).toEqual({
      items: [],
      limit: 20,
      hasMore: false,
      nextCursor: null,
    });
  });

  it("is exact for the provider, not a prefix", () => {
    expect(queryTransfers(all, { provider: "Wis" }).items).toEqual([]);
  });
});

describe("queryTransfers: invalid queries", () => {
  const fieldsOf = (q: Parameters<typeof queryTransfers>[1]) => {
    try {
      queryTransfers(all, q);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      return Object.keys((error as ValidationError).fieldErrors);
    }
    return [];
  };

  it("rejects bad dates, a reversed range, a bad status, limits and cursors", () => {
    expect(fieldsOf({ dateFrom: "2026-02-30" })).toEqual(["dateFrom"]);
    expect(fieldsOf({ dateTo: "yesterday" })).toEqual(["dateTo"]);
    expect(fieldsOf({ dateFrom: "2026-05-01", dateTo: "2026-04-01" })).toEqual([
      "dateFrom",
    ]);
    expect(fieldsOf({ status: "done" as never })).toEqual(["status"]);
    for (const limit of [0, -1, 101, 1.5])
      expect(fieldsOf({ limit })).toEqual(["limit"]);
    expect(fieldsOf({ cursor: "garbage" })).toEqual(["cursor"]);
  });

  it("is also what the mock data source throws", async () => {
    const source = new MockDataSource({ delayMs: 0 });
    await expect(
      source.transfers.list({ cursor: "nope" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("cursor and date helpers", () => {
  it("round-trips a cursor and rejects ones we did not issue", () => {
    const cursor = encodeCursor("2026-04-11", "sample-transfer-08");
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({
      transferDate: "2026-04-11",
      id: "sample-transfer-08",
    });
    for (const bad of [
      "",
      "garbage",
      btoa("[]"),
      btoa('["2026-02-30","x"]'),
      btoa('["2026-01-01","a b"]'),
    ]) {
      expect(decodeCursor(bad), bad).toBeUndefined();
    }
  });

  it("validates calendar dates", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    for (const bad of [
      "2025-02-29",
      "2026-13-01",
      "2026-1-1",
      "",
      "tomorrow",
      20260101,
      null,
    ]) {
      expect(isCalendarDate(bad), String(bad)).toBe(false);
    }
  });
});
