import { describe, expect, it } from "vitest";
import {
  DeletionRejectedError,
  MockDataSource,
  ValidationError,
  countryName,
  isCountryCode,
  validateRecipientInput,
} from "./index";

describe("validateRecipientInput", () => {
  it("accepts valid input", () => {
    expect(
      validateRecipientInput({ name: "Ada", country: "NG", notes: "Sister" }),
    ).toEqual({});
  });

  it("reports each invalid field", () => {
    expect(
      validateRecipientInput({
        name: "  ",
        country: "Nigeria",
        notes: "x".repeat(501),
      }),
    ).toEqual({
      name: "Name is required.",
      country: "Select a valid country.",
      notes: "Notes must be at most 500 characters.",
    });
    expect(validateRecipientInput({ name: "Ada" }).country).toBe(
      "Select a country.",
    );
  });
});

describe("countries", () => {
  it("knows ISO codes and names", () => {
    expect(isCountryCode("NG")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(countryName("NG")).toBe("Nigeria");
  });
});

describe("MockDataSource recipient rules", () => {
  const source = () => new MockDataSource({ delayMs: 0 });

  it("rejects invalid create and update with field errors", async () => {
    const ds = source();
    const error = await ds.recipients
      .create({ name: "", country: "NG" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors.name).toBe(
      "Name is required.",
    );

    const [first] = await ds.recipients.list();
    await expect(
      ds.recipients.update(first.id, { country: "ZZ" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects deleting a recipient that still has transfers", async () => {
    const ds = source();
    const transfers = await ds.transfers.list();
    const withTransfers = transfers[0].recipientId;
    await expect(ds.recipients.delete(withTransfers)).rejects.toBeInstanceOf(
      DeletionRejectedError,
    );
    await expect(ds.recipients.get(withTransfers)).resolves.toBeDefined();
  });
});
