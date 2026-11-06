import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockDataSource, ValidationError } from "@/src/data";
import { RecipientsView } from "./recipients-view";

afterEach(cleanup);

const newSource = () => new MockDataSource({ delayMs: 0 });

async function renderView(source = newSource()) {
  render(<RecipientsView dataSource={source} />);
  await screen.findByRole("list", { name: "Recipients" });
  return source;
}

function fillForm(name: string, country: string, notes = "") {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Country"), {
    target: { value: country },
  });
  if (notes) {
    fireEvent.change(screen.getByLabelText(/Notes/), {
      target: { value: notes },
    });
  }
}

describe("RecipientsView list states", () => {
  it("shows loading, then the recipients", async () => {
    render(<RecipientsView dataSource={newSource()} />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
    expect(await screen.findByText("Amara Okafor")).toBeDefined();
    expect(screen.getByText(/Nigeria \(NG\)/)).toBeDefined();
  });

  it("shows the empty state", async () => {
    const source = newSource();
    vi.spyOn(source.recipients, "list").mockResolvedValue([]);
    render(<RecipientsView dataSource={source} />);
    expect(await screen.findByText("No recipients yet")).toBeDefined();
  });

  it("shows an error and recovers on retry", async () => {
    const source = newSource();
    source.setFailure(true);
    render(<RecipientsView dataSource={source} />);
    expect(await screen.findByRole("alert")).toBeDefined();

    source.setFailure(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Amara Okafor")).toBeDefined();
  });
});

describe("RecipientsView create", () => {
  it("shows client validation errors next to the fields", async () => {
    await renderView();
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add recipient" }).at(-1)!,
    );

    const name = screen.getByLabelText("Name");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    const describedBy = name.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toMatch(
      /Name is required/,
    );
    expect(
      screen.getByText(/Select a country/, { selector: "p" }),
    ).toBeDefined();
  });

  it("adds a recipient to the list without a reload", async () => {
    await renderView();
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    fillForm("Kofi Mensah", "GH", "Cousin");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add recipient" }).at(-1)!,
    );

    expect(await screen.findByText("Kofi Mensah")).toBeDefined();
    expect(screen.getByText("Cousin")).toBeDefined();
    expect(screen.getByText(/Ghana \(GH\)/)).toBeDefined();
  });

  it("shows field errors returned by the data layer", async () => {
    const source = await renderView();
    vi.spyOn(source.recipients, "create").mockRejectedValue(
      new ValidationError({ name: "A recipient with this name exists." }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    fillForm("Amara Okafor", "NG");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add recipient" }).at(-1)!,
    );

    expect(
      await screen.findByText("A recipient with this name exists."),
    ).toBeDefined();
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("shows a general error when saving fails", async () => {
    const source = await renderView();
    source.setFailure(true);
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    fillForm("Kofi Mensah", "GH");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add recipient" }).at(-1)!,
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/Simulated/);
  });
});

describe("RecipientsView edit", () => {
  it("edits a recipient in place", async () => {
    await renderView();
    fireEvent.click(screen.getByRole("button", { name: "Edit Priya Sharma" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Luis H." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Luis H.")).toBeDefined();
    expect(screen.queryByText("Priya Sharma")).toBeNull();
  });

  it("shows validation errors when editing", async () => {
    await renderView();
    fireEvent.click(screen.getByRole("button", { name: "Edit Priya Sharma" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(/Name is required/)).toBeDefined();
  });
});

describe("RecipientsView delete", () => {
  it("asks for confirmation and can be cancelled", async () => {
    await renderView();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Priya Sharma" }),
    );
    expect(screen.getByText("Delete Priya Sharma?")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Priya Sharma")).toBeDefined();
    expect(screen.queryByText("Delete Priya Sharma?")).toBeNull();
  });

  it("deletes a recipient after confirmation", async () => {
    const source = await renderView();
    const created = await source.recipients.create({
      name: "Temp Person",
      country: "KE",
    });
    cleanup();
    await renderView(source);

    fireEvent.click(screen.getByRole("button", { name: "Delete Temp Person" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await vi.waitFor(() =>
      expect(screen.queryByText("Temp Person")).toBeNull(),
    );
    await expect(source.recipients.get(created.id)).rejects.toBeDefined();
  });

  it("shows a clear message when deletion is rejected", async () => {
    await renderView();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Amara Okafor" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Amara Okafor was not deleted/);
    expect(alert.textContent).toMatch(/cannot be deleted/);
    expect(screen.getByText("Amara Okafor")).toBeDefined();
  });
});
