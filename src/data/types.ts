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
  /** Decimal string, never a floating-point number. */
  amount: string;
  /** ISO 4217 code, for example USD or NGN. */
  currency: string;
  /** Decimal string, never a floating-point number. */
  exchangeRate: string | null;
  /** Decimal string, never a floating-point number. */
  fee: string | null;
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
  "id" | "createdAt" | "updatedAt" | "status" | "exchangeRate" | "fee"
> &
  Partial<Pick<Transfer, "status" | "exchangeRate" | "fee">>;

export type UpdateTransferInput = Partial<
  Pick<Transfer, "amount" | "currency" | "exchangeRate" | "fee" | "status">
>;

export interface Repository<T, CreateInput, UpdateInput> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
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
  readonly transfers: Repository<
    Transfer,
    CreateTransferInput,
    UpdateTransferInput
  >;
}
