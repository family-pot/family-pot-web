export type TransferStatus = "pending" | "completed" | "failed" | "cancelled";

export interface Recipient {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 code, for example NG. See `src/data/countries.ts`. */
  country: string;
  notes?: string;
  relationship?: string;
  /** ISO 4217 code for the currency the recipient is paid in. */
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  recipientId: string;
  /** Calendar date the money was sent, `YYYY-MM-DD`. */
  transferDate: string;
  /**
   * Amount sent, as a string of whole MINOR units of `currency` (ADR 0004):
   * "15000" with GBP is 150.00. Never a floating-point number.
   */
  amount: string;
  /** Sending currency, ISO 4217, for example GBP. */
  currency: string;
  /** Receiving currency, ISO 4217, for example NGN. */
  receivingCurrency: string;
  /** Units of the receiving currency per 1 unit of the sending currency, as a decimal string. */
  exchangeRate: string;
  /** Fee in minor units of the SENDING currency, as a string ("0" when there is none). */
  fee: string;
  provider: string;
  purpose?: string;
  notes?: string;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
}

export type CreateRecipientInput = Omit<
  Recipient,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateRecipientInput = Partial<CreateRecipientInput>;

export type CreateTransferInput = Omit<
  Transfer,
  "id" | "createdAt" | "updatedAt" | "status" | "fee"
> &
  Partial<Pick<Transfer, "status" | "fee">>;

export type UpdateTransferInput = Partial<
  Omit<Transfer, "id" | "createdAt" | "updatedAt">
>;

/** Filters and paging for listing transfers. All filters are optional and combine with AND. */
export interface TransferListQuery {
  recipientId?: string;
  /** Inclusive, `YYYY-MM-DD`. */
  dateFrom?: string;
  /** Inclusive, `YYYY-MM-DD`. */
  dateTo?: string;
  /** Exact provider name, case-insensitive. */
  provider?: string;
  status?: TransferStatus;
  /** Page size, 1 to 100 (default 20). */
  limit?: number;
  /** The `nextCursor` of the previous page. */
  cursor?: string;
}

/**
 * One page of transfers, newest first (`transferDate` descending, then `id`
 * descending). Cursor-based so pages never repeat or skip an item when data
 * changes between requests; this mirrors the API (family-pot-api API-12).
 */
export interface TransferPage {
  items: Transfer[];
  limit: number;
  hasMore: boolean;
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

export interface Repository<T, CreateInput, UpdateInput> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface TransferRepository extends Omit<
  Repository<Transfer, CreateTransferInput, UpdateTransferInput>,
  "list"
> {
  list(query?: TransferListQuery): Promise<TransferPage>;
}

/**
 * The only data entry point pages and components should use.
 *
 * The mock implementation lets the UI run before the API exists. The API
 * implementation must match this interface when the backend is connected.
 */
export interface DataSource {
  readonly kind: "mock" | "api";
  readonly recipients: Repository<
    Recipient,
    CreateRecipientInput,
    UpdateRecipientInput
  >;
  readonly transfers: TransferRepository;
}
