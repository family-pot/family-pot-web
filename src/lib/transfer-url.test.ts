import { describe, expect, it } from "vitest";
import {
  buildTransferSearchParams,
  filtersToQuery,
  hasActiveFilters,
  parseTransferSearchParams,
  transferHref,
} from "./transfer-url";

const parse = (query: string) =>
  parseTransferSearchParams(new URLSearchParams(query));

describe("parseTransferSearchParams", () => {
  it("reads every filter and the page position", () => {
    expect(
      parse(
        "recipient=sample-recipient-amara&from=2026-01-01&to=2026-06-30&provider=Wise&status=completed&cursor=abc_-1",
      ),
    ).toEqual({
      recipientId: "sample-recipient-amara",
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
      provider: "Wise",
      status: "completed",
      cursor: "abc_-1",
    });
  });

  it("returns no filters for an empty query", () => {
    expect(parse("")).toEqual({});
    expect(hasActiveFilters(parse(""))).toBe(false);
  });

  it("ignores invalid and unknown values instead of failing", () => {
    expect(
      parse(
        "status=done&from=2026-02-30&to=nope&recipient=a b&unknown=1&provider=",
      ),
    ).toEqual({});
    expect(parse("provider=" + "p".repeat(101))).toEqual({});
    expect(parse("cursor=" + "c".repeat(201))).toEqual({});
  });

  it("drops the 'to' date of a reversed range", () => {
    expect(parse("from=2026-05-01&to=2026-04-01")).toEqual({
      dateFrom: "2026-05-01",
    });
  });

  it("trims whitespace", () => {
    expect(parse("provider=%20Wise%20&status=%20failed")).toEqual({
      provider: "Wise",
      status: "failed",
    });
  });
});

describe("buildTransferSearchParams and transferHref", () => {
  it("writes a stable order and omits empty values", () => {
    const params = buildTransferSearchParams({
      status: "pending",
      provider: "Wise",
      cursor: undefined,
      dateFrom: "2026-01-01",
    });
    expect(params.toString()).toBe(
      "from=2026-01-01&provider=Wise&status=pending",
    );
  });

  it("builds the href, with no question mark when there are no filters", () => {
    expect(transferHref("/transfers", {})).toBe("/transfers");
    expect(transferHref("/transfers", { status: "failed" })).toBe(
      "/transfers?status=failed",
    );
  });

  it("encodes special characters and round-trips them", () => {
    const filters = { provider: "Western Union & Co" };
    const href = transferHref("/transfers", filters);
    expect(href).toBe("/transfers?provider=Western+Union+%26+Co");
    expect(parse(href.split("?")[1]!)).toEqual(filters);
  });

  it("round-trips every filter", () => {
    const filters = {
      recipientId: "r-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      provider: "Wise",
      status: "completed" as const,
      cursor: "c1",
    };
    expect(parse(buildTransferSearchParams(filters).toString())).toEqual(
      filters,
    );
  });
});

describe("filtersToQuery and hasActiveFilters", () => {
  it("adds the page size", () => {
    expect(filtersToQuery({ status: "failed" }, 10)).toEqual({
      status: "failed",
      limit: 10,
    });
  });

  it("treats the cursor as position, not a filter", () => {
    expect(hasActiveFilters({ cursor: "c" })).toBe(false);
    expect(hasActiveFilters({ provider: "Wise" })).toBe(true);
  });
});
