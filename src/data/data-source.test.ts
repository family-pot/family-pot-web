import { afterEach, describe, expect, it } from "vitest";
import {
  ApiDataSource,
  createDataSource,
  DataSourceNotConnectedError,
  MockDataSource,
  NotFoundError,
  SimulatedDataError,
  resetDataSourceForTests,
} from "./index";

describe("MockDataSource", () => {
  const source = () => new MockDataSource({ delayMs: 0 });

  it("lists the seeded sample data", async () => {
    const dataSource = source();

    expect(await dataSource.recipients.list()).toHaveLength(2);
    expect(
      (await dataSource.transfers.list({ limit: 100 })).items,
    ).toHaveLength(14);
  });

  it("creates, reads, updates and deletes a recipient", async () => {
    const dataSource = source();
    const created = await dataSource.recipients.create({
      name: "Test Person",
      relationship: "Friend",
      country: "GH",
      currency: "GHS",
    });

    expect(created.id).toMatch(/^recipient-/);
    await expect(dataSource.recipients.get(created.id)).resolves.toEqual(
      created,
    );

    const updated = await dataSource.recipients.update(created.id, {
      name: "Updated Person",
    });
    expect(updated.name).toBe("Updated Person");
    expect(updated.createdAt).toBe(created.createdAt);

    await dataSource.recipients.delete(created.id);
    await expect(dataSource.recipients.get(created.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("creates, reads, updates and deletes a transfer", async () => {
    const dataSource = source();
    const [recipient] = await dataSource.recipients.list();
    const created = await dataSource.transfers.create({
      recipientId: recipient.id,
      transferDate: "2026-08-01",
      amount: "7525",
      currency: "USD",
      receivingCurrency: "INR",
      exchangeRate: "12.3456",
      fee: "125",
      provider: "Wise",
    });

    expect(created.status).toBe("pending");
    expect(created.amount).toBe("7525");
    await expect(dataSource.transfers.get(created.id)).resolves.toEqual(
      created,
    );

    const updated = await dataSource.transfers.update(created.id, {
      status: "completed",
    });
    expect(updated.status).toBe("completed");
    expect(updated.recipientId).toBe(recipient.id);

    await dataSource.transfers.delete(created.id);
    await expect(dataSource.transfers.get(created.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("returns not-found errors for unknown ids", async () => {
    const dataSource = source();

    await expect(dataSource.recipients.get("missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      dataSource.transfers.update("missing", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      dataSource.recipients.delete("missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a transfer for an unknown recipient", async () => {
    const dataSource = source();

    await expect(
      dataSource.transfers.create({
        recipientId: "missing",
        transferDate: "2026-08-01",
        amount: "1000",
        currency: "USD",
        receivingCurrency: "INR",
        exchangeRate: "17",
        provider: "Wise",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("can simulate a failure", async () => {
    const dataSource = new MockDataSource({ delayMs: 0, fail: true });

    await expect(dataSource.recipients.list()).rejects.toBeInstanceOf(
      SimulatedDataError,
    );
    dataSource.setFailure(false);
    await expect(dataSource.recipients.list()).resolves.toHaveLength(2);
  });

  it("returns copies so callers cannot mutate the store", async () => {
    const dataSource = source();
    const [recipient] = await dataSource.recipients.list();
    recipient.name = "Mutated locally";

    const [fresh] = await dataSource.recipients.list();
    expect(fresh.name).not.toBe("Mutated locally");
  });
});

describe("data source selection", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    resetDataSourceForTests();
  });

  it("defaults to mock and honours the environment variable", () => {
    delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    expect(createDataSource().kind).toBe("mock");

    process.env.NEXT_PUBLIC_DATA_SOURCE = "api";
    expect(createDataSource().kind).toBe("api");
  });

  it("accepts explicit mock and api values", () => {
    expect(createDataSource("mock")).toBeInstanceOf(MockDataSource);
    expect(createDataSource(" API ")).toBeInstanceOf(ApiDataSource);
  });

  it("rejects an unknown selection", () => {
    expect(() => createDataSource("database")).toThrow(
      'Unknown NEXT_PUBLIC_DATA_SOURCE "database"',
    );
  });

  it("makes every API stub method fail loudly", async () => {
    const api = new ApiDataSource();

    await expect(api.recipients.list()).rejects.toBeInstanceOf(
      DataSourceNotConnectedError,
    );
    await expect(api.transfers.get("anything")).rejects.toBeInstanceOf(
      DataSourceNotConnectedError,
    );
  });
});
