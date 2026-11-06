import { ApiDataSource } from "./api-data-source";
import { MockDataSource } from "./mock-data-source";
import type { DataSource } from "./types";

export type DataSourceKind = "mock" | "api";

/**
 * Choose the data implementation once. Components should import `dataSource`
 * or call `getDataSource()` rather than importing sample data directly.
 */
export function createDataSource(
  kind: string | undefined = process.env.NEXT_PUBLIC_DATA_SOURCE,
): DataSource {
  const selected = kind?.trim().toLowerCase() || "mock";

  if (selected === "mock") {
    return new MockDataSource();
  }
  if (selected === "api") {
    return new ApiDataSource();
  }

  throw new Error(
    `Unknown NEXT_PUBLIC_DATA_SOURCE "${selected}". Use "mock" or "api".`,
  );
}

let current: DataSource | undefined;

export function getDataSource(): DataSource {
  current ??= createDataSource();
  return current;
}

export function resetDataSourceForTests(): void {
  current = undefined;
}

export { ApiDataSource } from "./api-data-source";
export { MockDataSource } from "./mock-data-source";
export type { MockDataSourceOptions } from "./mock-data-source";
export {
  DataSourceNotConnectedError,
  DeletionRejectedError,
  NotFoundError,
  SimulatedDataError,
  ValidationError,
} from "./errors";
export type {
  CreateRecipientInput,
  CreateTransferInput,
  DataSource,
  Recipient,
  Repository,
  Transfer,
  TransferListQuery,
  TransferPage,
  TransferRepository,
  TransferStatus,
  UpdateRecipientInput,
  UpdateTransferInput,
} from "./types";
export { COUNTRY_CODES, countryName, isCountryCode } from "./countries";
export { validateRecipientInput } from "./recipient-validation";
export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  isCalendarDate,
  queryTransfers,
  validateTransferQuery,
} from "./transfer-query";
export { TRANSFER_STATUSES } from "./transfer-status";
export { sampleTransferCount } from "./sample-data";
