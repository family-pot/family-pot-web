import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockDataSource,
  NotFoundError,
  ValidationError,
  type CreateTransferInput,
} from "@/src/data";
import { formatMoney } from "@/src/lib/money";
import { TransferForm, buildTransferInput } from "./transfer-form";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }) }));

beforeEach(() => nav.push.mockClear());
afterEach(cleanup);

const newSource = () => new MockDataSource({ delayMs: 0 });

async function renderForm(
  props: { transferId?: string; source?: MockDataSource } = {},
) {
  const source = props.source ?? newSource();
  render(<TransferForm transferId={props.transferId} dataSource={source} />);
  await screen.findByRole("form", {
    name: props.transferId ? "Edit transfer" : "Add transfer",
  });
  return source;
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Fills a valid transfer; individual tests override one field to break it. */
function fillValid(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    Recipient: "sample-recipient-amara",
    "Date sent": "2026-11-01",
    "Amount sent": "100.10",
    "Sending currency": "GBP",
    "Receiving currency": "NGN",
    "Exchange rate": "1950.50",
    Fee: "3.49",
    Provider: "Wise",
    ...overrides,
  };
  for (const [label, value] of Object.entries(fields))
    type(new RegExp(`^${label}`), value);
}
const submit = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /Add transfer|Save changes/ }),
  );

describe("TransferForm: create", () => {
  it("creates a transfer with exactly the digits entered and goes back to the list", async () => {
    const source = await renderForm();
    fillValid();
    type(/^Purpose/, "Rent");
    type(/^Notes/, "  March  ");
    type("Status", "completed");
    submit();

    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/transfers"));
    const { items } = await source.transfers.list({
      provider: "Wise",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      recipientId: "sample-recipient-amara",
      transferDate: "2026-11-01",
      amount: "10010", // 100.10 typed, stored as whole minor units, never a float
      currency: "GBP",
      receivingCurrency: "NGN",
      exchangeRate: "1950.5", // canonical: no trailing zero
      fee: "349",
      provider: "Wise",
      purpose: "Rent",
      notes: "March",
      status: "completed",
    });
    // And it is displayed as exactly 100.10.
    expect(formatMoney(items[0]!.amount, items[0]!.currency)).toBe("£100.10");
  });

  it("explains that the values are user-entered", async () => {
    await renderForm();
    expect(screen.getByText("Entered by you")).toBeDefined();
    expect(screen.getByText(/saved as entered by you/i)).toBeDefined();
  });

  it("treats a blank fee as no fee and offers the supported currencies and every status", async () => {
    const source = await renderForm();
    fillValid({ Fee: "" });
    submit();
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalled());
    const { items } = await source.transfers.list({
      provider: "Wise",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
    });
    expect(items[0]!.fee).toBe("0");

    cleanup();
    await renderForm();
    const currencies = within(screen.getByLabelText("Sending currency"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(currencies).toEqual([
      "GBP",
      "USD",
      "EUR",
      "CAD",
      "NGN",
      "GHS",
      "KES",
      "INR",
      "PHP",
    ]);
    const statuses = within(screen.getByLabelText("Status"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(statuses).toEqual(["Pending", "Completed", "Failed", "Cancelled"]);
  });

  it("labels every field accessibly", async () => {
    await renderForm();
    for (const label of [
      "Recipient",
      "Date sent",
      "Amount sent",
      "Sending currency",
      "Receiving currency",
      "Exchange rate",
      /^Fee/,
      "Provider",
      /^Purpose/,
      "Status",
      /^Notes/,
    ]) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }
  });
});

describe("TransferForm: precision", () => {
  it.each([
    ["100.10", "10010"],
    ["0.1", "10"],
    ["0.01", "1"],
    ["1.15", "115"],
    ["4.35", "435"],
    ["19.99", "1999"],
    ["90071992547409.93", "9007199254740993"],
  ])("stores %s as %s minor units", async (typed, minor) => {
    const source = await renderForm();
    fillValid({ "Amount sent": typed, Provider: `P ${typed}` });
    submit();
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalled());
    const { items } = await source.transfers.list({ provider: `P ${typed}` });
    expect(items[0]!.amount).toBe(minor);
  });
});

describe("TransferForm: validation", () => {
  const expectError = (field: string | RegExp, message: RegExp) => {
    const input = screen.getByLabelText(field);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = document.getElementById(
      input.getAttribute("aria-describedby")!,
    );
    expect(described?.textContent).toMatch(message);
  };

  it("requires a recipient", async () => {
    await renderForm();
    fillValid({ Recipient: "" });
    submit();
    expectError("Recipient", /Choose a recipient/);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("rejects a zero, negative, malformed or over-precise amount, each with a clear message", async () => {
    await renderForm();
    for (const [typed, message] of [
      ["0", /greater than zero/],
      ["-5", /greater than zero/],
      ["", /Enter an amount/],
      ["abc", /digits and a decimal point/],
      ["1,000", /digits and a decimal point/],
      ["1.005", /at most 2 decimal places/],
    ] as const) {
      fillValid({ "Amount sent": typed });
      submit();
      expectError("Amount sent", message);
    }
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("rejects a negative or malformed fee but allows zero", async () => {
    await renderForm();
    fillValid({ Fee: "-1" });
    submit();
    expectError(/^Fee/, /cannot be negative/);
    fillValid({ Fee: "x" });
    submit();
    expectError(/^Fee/, /digits and a decimal point/);
    fillValid({ Fee: "0" });
    submit();
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalled());
  });

  it("rejects an invalid exchange rate", async () => {
    await renderForm();
    for (const [typed, message] of [
      ["", /Enter an exchange rate/],
      ["0", /greater than zero/],
      ["abc", /digits and a decimal point/],
      ["1.0000000000001", /at most 12 decimal places/],
    ] as const) {
      fillValid({ "Exchange rate": typed });
      submit();
      expectError("Exchange rate", message);
    }
  });

  it("rejects bad dates and a missing provider", async () => {
    await renderForm();
    fillValid({ "Date sent": "2999-01-01" });
    submit();
    expectError("Date sent", /real date/);
    fillValid({ "Date sent": "" });
    submit();
    expectError("Date sent", /real date/);
    fillValid({ Provider: "  " });
    submit();
    expectError("Provider", /Enter the provider/);
  });

  it("shows every problem at once, a summary, and clears them once fixed", async () => {
    await renderForm();
    fillValid({
      Recipient: "",
      "Amount sent": "0",
      "Exchange rate": "",
      Provider: "",
    });
    submit();
    expect(screen.getByRole("alert").textContent).toMatch(/fix the 4 problems/);
    fillValid();
    submit();
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalled());
  });

  it("does not call the data source when invalid", async () => {
    const source = await renderForm();
    const create = vi.spyOn(source.transfers, "create");
    fillValid({ "Amount sent": "" });
    submit();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("buildTransferInput", () => {
  const values = {
    recipientId: "r",
    transferDate: "2026-11-01",
    amount: "100.10",
    currency: "GBP",
    receivingCurrency: "NGN",
    exchangeRate: "1950.50",
    fee: "",
    provider: " Wise ",
    purpose: "",
    status: "pending" as const,
    notes: "",
  };

  it("converts text to the data-layer input and omits empty optionals", () => {
    const result = buildTransferInput(values);
    expect(result).toEqual({
      ok: true,
      input: {
        recipientId: "r",
        transferDate: "2026-11-01",
        amount: "10010",
        currency: "GBP",
        receivingCurrency: "NGN",
        exchangeRate: "1950.5",
        fee: "0",
        provider: "Wise",
        status: "pending",
      } satisfies CreateTransferInput,
    });
  });

  it("returns field-keyed errors instead of an input", () => {
    const result = buildTransferInput({
      ...values,
      amount: "x",
      currency: "XXX",
    });
    expect(result.ok).toBe(false);
    // The amount cannot be read without a valid currency (its decimal places
    // depend on it), so the currency is what gets reported.
    expect(result).toMatchObject({
      errors: { currency: expect.stringMatching(/sending currency/) },
    });
    // With a valid currency the amount text itself is reported.
    expect(buildTransferInput({ ...values, amount: "x" })).toMatchObject({
      ok: false,
      errors: { amount: expect.stringMatching(/digits and a decimal point/) },
    });
  });
});

describe("TransferForm: data-layer errors", () => {
  it("shows field errors returned by the data layer next to the field", async () => {
    const source = await renderForm();
    vi.spyOn(source.transfers, "create").mockRejectedValue(
      new ValidationError({ provider: "That provider is not allowed." }),
    );
    fillValid();
    submit();
    expect(
      await screen.findByText("That provider is not allowed."),
    ).toBeDefined();
    expect(screen.getByLabelText("Provider").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("shows a message when the chosen recipient no longer exists", async () => {
    const source = await renderForm();
    vi.spyOn(source.transfers, "create").mockRejectedValue(
      new NotFoundError("Recipient", "x"),
    );
    fillValid();
    submit();
    expect(await screen.findByText(/no longer exists/)).toBeDefined();
  });

  it("shows a general error when saving fails, and lets the person retry", async () => {
    const source = await renderForm();
    source.setFailure(true);
    fillValid();
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Simulated/);
    expect(nav.push).not.toHaveBeenCalled();
    source.setFailure(false);
    submit();
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/transfers"));
  });
});

describe("TransferForm: edit and delete", () => {
  const id = "sample-transfer-01"; // 2026-01-10, Amara, 250.00 GBP, fee 3.49, rate 1980.5, Wise

  it("fills the form from the transfer and shows decimals exactly as stored", async () => {
    await renderForm({ transferId: id });
    expect(
      (screen.getByLabelText("Amount sent") as HTMLInputElement).value,
    ).toBe("250.00");
    expect((screen.getByLabelText(/^Fee/) as HTMLInputElement).value).toBe(
      "3.49",
    );
    expect(
      (screen.getByLabelText("Exchange rate") as HTMLInputElement).value,
    ).toBe("1980.5");
    expect(
      (screen.getByLabelText("Recipient") as HTMLSelectElement).value,
    ).toBe("sample-recipient-amara");
    expect((screen.getByLabelText("Provider") as HTMLInputElement).value).toBe(
      "Wise",
    );
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe(
      "completed",
    );
  });

  it("saves changes, keeping untouched values exactly", async () => {
    const source = await renderForm({ transferId: id });
    type("Amount sent", "100.10");
    type("Status", "failed");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/transfers"));

    const updated = await source.transfers.get(id);
    expect(updated).toMatchObject({
      amount: "10010",
      status: "failed",
      fee: "349",
      exchangeRate: "1980.5",
      provider: "Wise",
    });
  });

  it("validates edits too", async () => {
    await renderForm({ transferId: id });
    type("Amount sent", "0");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      screen.getByLabelText("Amount sent").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("deletes only after confirmation, and can be cancelled", async () => {
    const source = await renderForm({ transferId: id });
    expect(screen.queryByRole("button", { name: "Confirm delete" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete transfer" }));
    expect(screen.getByText(/Delete this transfer/)).toBeDefined();
    fireEvent.click(
      within(screen.getByRole("group")).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("button", { name: "Confirm delete" })).toBeNull();
    await expect(source.transfers.get(id)).resolves.toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Delete transfer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith("/transfers"));
    await expect(source.transfers.get(id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("shows an error if deleting fails, and keeps the transfer", async () => {
    const source = await renderForm({ transferId: id });
    vi.spyOn(source.transfers, "delete").mockRejectedValue(
      new Error("Could not delete right now."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete transfer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Could not delete right now/,
    );
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("has no delete button when creating", async () => {
    await renderForm();
    expect(
      screen.queryByRole("button", { name: "Delete transfer" }),
    ).toBeNull();
  });
});

describe("TransferForm: loading and edge states", () => {
  it("shows loading first", () => {
    render(<TransferForm dataSource={newSource()} />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
  });

  it("says so when the transfer does not exist", async () => {
    render(<TransferForm transferId="nope" dataSource={newSource()} />);
    expect(await screen.findByText("Transfer not found")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Back to transfers" })
        .getAttribute("href"),
    ).toBe("/transfers");
  });

  it("asks to add a recipient first when there are none", async () => {
    const source = newSource();
    vi.spyOn(source.recipients, "list").mockResolvedValue([]);
    render(<TransferForm dataSource={source} />);
    expect(await screen.findByText("Add a recipient first")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Go to recipients" })
        .getAttribute("href"),
    ).toBe("/recipients");
  });

  it("shows a load error and recovers on retry", async () => {
    const source = newSource();
    source.setFailure(true);
    render(<TransferForm dataSource={source} />);
    expect(await screen.findByRole("alert")).toBeDefined();
    source.setFailure(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("form", { name: "Add transfer" }),
    ).toBeDefined();
  });
});
