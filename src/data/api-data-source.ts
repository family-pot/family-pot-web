import { DataSourceNotConnectedError } from "./errors";
import type {
  CreateRecipientInput,
  DataSource,
  Recipient,
  Repository,
  TransferRepository,
  UpdateRecipientInput,
} from "./types";

function notConnected(method: string): never {
  throw new DataSourceNotConnectedError(method);
}

/**
 * Placeholder for the real REST implementation.
 *
 * Every method fails loudly instead of returning invented data, so switching
 * NEXT_PUBLIC_DATA_SOURCE to "api" before the API exists cannot silently look
 * like a successful request.
 */
export class ApiDataSource implements DataSource {
  readonly kind = "api" as const;

  readonly recipients: Repository<
    Recipient,
    CreateRecipientInput,
    UpdateRecipientInput
  > = {
    list: async () => notConnected("recipients.list"),
    get: async () => notConnected("recipients.get"),
    create: async () => notConnected("recipients.create"),
    update: async () => notConnected("recipients.update"),
    delete: async () => notConnected("recipients.delete"),
  };

  readonly transfers: TransferRepository = {
    list: async () => notConnected("transfers.list"),
    get: async () => notConnected("transfers.get"),
    create: async () => notConnected("transfers.create"),
    update: async () => notConnected("transfers.update"),
    delete: async () => notConnected("transfers.delete"),
  };
}
