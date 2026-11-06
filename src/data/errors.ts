export class NotFoundError extends Error {
  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`${resource} with id "${id}" was not found`);
    this.name = "NotFoundError";
  }
}

export class SimulatedDataError extends Error {
  constructor() {
    super("Simulated data-source failure");
    this.name = "SimulatedDataError";
  }
}

export class DataSourceNotConnectedError extends Error {
  constructor(method: string) {
    super(
      `${method} is not available yet: the API data source is not connected`,
    );
    this.name = "DataSourceNotConnectedError";
  }
}

/** Field-level problems, keyed by field name, e.g. `{ name: "Name is required." }`. */
export class ValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super("Some fields are invalid");
    this.name = "ValidationError";
  }
}

/** The record exists but may not be deleted, for example it still has transfers. */
export class DeletionRejectedError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "DeletionRejectedError";
  }
}
