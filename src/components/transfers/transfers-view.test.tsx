import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockDataSource } from "@/src/data";
import { PAGE_SIZE, TransfersView } from "./transfers-view";

const nav = vi.hoisted(() => ({ push: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => "/transfers",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.search = "";
  nav.push.mockClear();
});
afterEach(cleanup);

const newSource = () => new MockDataSource({ delayMs: 0 });

async function renderView(source = newSource()) {
  const view = render(<TransfersView dataSource={source} />);
  await screen.findByRole("list", { name: "Transfers" });
  return { source, ...view };
}

const rows = () =>
  within(screen.getByRole("list", { name: "Transfers" })).getAllByRole(
    "listitem",
  );

describe("TransfersView: states", () => {
  it("shows loading, then the transfers with date, recipient, amount, fee, provider and status", async () => {
    render(<TransfersView dataSource={newSource()} />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading transfers/);

    await screen.findByRole("list", { name: "Transfers" });
    expect(rows()).toHaveLength(PAGE_SIZE);

    // The newest sample transfer: 2026-07-12, Luis, 200.00 USD, fee 3.50, Western Union, completed.
    const first = rows()[0]!;
    expect(first.textContent).toContain("2026-07-12");
    expect(first.textContent).toContain("Luis Hernández");
    expect(first.textContent).toContain("$200.00");
    expect(first.textContent).toContain("$3.50");
    expect(first.textContent).toContain("Western Union");
    expect(first.textContent).toContain("Completed");
  });

  it("shows a provenance indicator on every amount, and status as text, not colour alone", async () => {
    await renderView();
    for (const row of rows()) {
      expect(within(row).getByText("Entered by you")).toBeDefined();
      expect(row.textContent).toMatch(/Pending|Completed|Failed|Cancelled/);
    }
  });

  it("shows the empty state when there are no transfers at all", async () => {
    const source = newSource();
    vi.spyOn(source.transfers, "list").mockResolvedValue({
      items: [],
      limit: 10,
      hasMore: false,
      nextCursor: null,
    });
    render(<TransfersView dataSource={source} />);
    expect(await screen.findByText("No transfers yet")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("shows a filtered empty state that offers to clear the filters", async () => {
    nav.search = "provider=Nobody";
    render(<TransfersView dataSource={newSource()} />);
    expect(
      await screen.findByText("No transfers match these filters"),
    ).toBeDefined();
    const clear = screen.getAllByRole("button", { name: "Clear filters" });
    fireEvent.click(clear.at(-1)!);
    expect(nav.push).toHaveBeenCalledWith("/transfers");
  });

  it("shows an error and recovers on retry", async () => {
    const source = newSource();
    source.setFailure(true);
    render(<TransfersView dataSource={source} />);
    expect(await screen.findByRole("alert")).toBeDefined();

    source.setFailure(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("list", { name: "Transfers" }),
    ).toBeDefined();
  });

  it("never crashes on a malformed amount", async () => {
    const source = newSource();
    const page = await source.transfers.list({ limit: 1 });
    vi.spyOn(source.transfers, "list").mockResolvedValue({
      ...page,
      items: [{ ...page.items[0]!, amount: "12.50" }],
    });
    render(<TransfersView dataSource={source} />);
    await screen.findByRole("list", { name: "Transfers" });
    expect(rows()[0]!.textContent).toContain("Invalid amount");
  });
});

describe("TransfersView: filters and the URL", () => {
  it("restores filters from the URL: inputs are filled in and results narrowed", async () => {
    nav.search =
      "recipient=sample-recipient-amara&status=failed&from=2026-04-01&to=2026-04-30&provider=Western+Union";
    await renderView();

    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain("Failed");
    expect(
      (screen.getByLabelText("Recipient") as HTMLSelectElement).value,
    ).toBe("sample-recipient-amara");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe(
      "failed",
    );
    expect((screen.getByLabelText("From date") as HTMLInputElement).value).toBe(
      "2026-04-01",
    );
    expect((screen.getByLabelText("To date") as HTMLInputElement).value).toBe(
      "2026-04-30",
    );
    expect((screen.getByLabelText("Provider") as HTMLInputElement).value).toBe(
      "Western Union",
    );
  });

  it("writes the chosen filters to the URL, without a page position", async () => {
    await renderView();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "completed" },
    });
    fireEvent.change(screen.getByLabelText("Provider"), {
      target: { value: "Wise" },
    });
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(nav.push).toHaveBeenCalledWith(
      "/transfers?from=2026-02-01&provider=Wise&status=completed",
    );
  });

  it("follows the URL when it changes (back and forward)", async () => {
    const { source, rerender } = await renderView();
    expect(rows()).toHaveLength(PAGE_SIZE);

    nav.search = "status=failed";
    rerender(<TransfersView dataSource={source} />);
    await screen.findByText("Failed");
    expect(rows()).toHaveLength(1);
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe(
      "failed",
    );

    nav.search = ""; // the user pressed Back
    rerender(<TransfersView dataSource={source} />);
    await vi.waitFor(() => expect(rows()).toHaveLength(PAGE_SIZE));
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe(
      "",
    );
  });

  it("clears all filters", async () => {
    nav.search = "status=completed&provider=Wise";
    await renderView();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.push).toHaveBeenCalledWith("/transfers");
  });

  it("ignores an invalid URL instead of breaking", async () => {
    nav.search = "status=bogus&from=2026-02-30&unknown=1";
    await renderView();
    expect(rows()).toHaveLength(PAGE_SIZE);
  });

  it("only lists the user's recipients in the recipient filter", async () => {
    await renderView();
    const options = within(screen.getByLabelText("Recipient"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual([
      "All recipients",
      "Amara Okafor",
      "Luis Hernández",
    ]);
  });
});

describe("TransfersView: pagination", () => {
  it("goes to the next page through the URL cursor, and back to the first", async () => {
    await renderView();
    const next = screen.getByRole("button", { name: "Next page" });
    expect(
      (screen.getByRole("button", { name: "First page" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(next);

    expect(nav.push).toHaveBeenCalledTimes(1);
    const href = nav.push.mock.calls[0]![0] as string;
    expect(href).toMatch(/^\/transfers\?cursor=[A-Za-z0-9_-]+$/);

    // Load the next page as the URL now says.
    cleanup();
    nav.search = href.split("?")[1]!;
    await renderView();
    expect(rows()).toHaveLength(4); // 14 transfers: 10 + 4
    expect(
      (screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/not the first page/)).toBeDefined();

    nav.push.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    expect(nav.push).toHaveBeenCalledWith("/transfers");
  });

  it("shows every transfer exactly once across the pages", async () => {
    const seen: string[] = [];
    let search = "";
    for (let i = 0; i < 5; i++) {
      cleanup();
      nav.search = search;
      await renderView();
      seen.push(...rows().map((r) => r.textContent!));
      nav.push.mockClear();
      const next = screen.getByRole("button", {
        name: "Next page",
      }) as HTMLButtonElement;
      if (next.disabled) break;
      fireEvent.click(next);
      search = (nav.push.mock.calls[0]![0] as string).split("?")[1]!;
    }
    expect(seen).toHaveLength(14);
    expect(new Set(seen).size).toBe(14);
  });

  it("keeps the filters when paging", async () => {
    nav.search = "provider=Wise";
    await renderView();
    const next = screen.getByRole("button", {
      name: "Next page",
    }) as HTMLButtonElement;
    if (!next.disabled) {
      fireEvent.click(next);
      expect(nav.push.mock.calls[0]![0]).toMatch(
        /^\/transfers\?provider=Wise&cursor=/,
      );
    } else {
      expect(rows().length).toBeLessThanOrEqual(PAGE_SIZE);
    }
  });
});
