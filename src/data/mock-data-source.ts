import {
  DeletionRejectedError,
  NotFoundError,
  SimulatedDataError,
  ValidationError,
} from "./errors";
import { validateRecipientInput } from "./recipient-validation";
import { queryTransfers } from "./transfer-query";
import { validateTransferInput } from "./transfer-validation";
import { sampleRecipients, sampleTransfers } from "./sample-data";
import type {
  CreateRecipientInput,
  DataSource,
  Recipient,
  Repository,
  TransferRepository,
  Transfer,
  UpdateRecipientInput,
} from "./types";

export interface MockDataSourceOptions {
  /** Artificial latency in milliseconds, so loading states can be exercised. */
  delayMs?: number;
  /** When true, every operation rejects with SimulatedDataError. */
  fail?: boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

/**
 * In-memory data source seeded with clearly-labelled sample records.
 *
 * Each instance owns its own store, so a browser reload (or a new test) starts
 * from the same sample data. Amounts and rates stay as decimal strings.
 */
export class MockDataSource implements DataSource {
  readonly kind = "mock" as const;

  private recipientRecords = clone([...sampleRecipients]);
  private transferRecords = clone([...sampleTransfers]);
  private delayMs: number;
  private fail: boolean;

  constructor(options: MockDataSourceOptions = {}) {
    this.delayMs = options.delayMs ?? 120;
    this.fail = options.fail ?? false;
  }

  setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  setFailure(fail: boolean): void {
    this.fail = fail;
  }

  private async ready(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.fail) {
      throw new SimulatedDataError();
    }
  }

  readonly recipients: Repository<
    Recipient,
    CreateRecipientInput,
    UpdateRecipientInput
  > = {
    list: async () => {
      await this.ready();
      return this.recipientRecords.map(clone);
    },

    get: async (id) => {
      await this.ready();
      const recipient = this.recipientRecords.find((item) => item.id === id);
      if (!recipient) {
        throw new NotFoundError("Recipient", id);
      }
      return clone(recipient);
    },

    create: async (input) => {
      await this.ready();
      const fieldErrors = validateRecipientInput(input);
      if (Object.keys(fieldErrors).length > 0) {
        throw new ValidationError(fieldErrors);
      }
      const timestamp = now();
      const recipient: Recipient = {
        ...input,
        name: input.name.trim(),
        id: `recipient-${crypto.randomUUID()}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.recipientRecords.push(recipient);
      return clone(recipient);
    },

    update: async (id, input) => {
      await this.ready();
      const index = this.recipientRecords.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new NotFoundError("Recipient", id);
      }
      const current = this.recipientRecords[index];
      const fieldErrors = validateRecipientInput({ ...current, ...input });
      if (Object.keys(fieldErrors).length > 0) {
        throw new ValidationError(fieldErrors);
      }
      const updated: Recipient = {
        ...current,
        ...input,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: now(),
      };
      this.recipientRecords[index] = updated;
      return clone(updated);
    },

    delete: async (id) => {
      await this.ready();
      const index = this.recipientRecords.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new NotFoundError("Recipient", id);
      }
      const transferCount = this.transferRecords.filter(
        (item) => item.recipientId === id,
      ).length;
      if (transferCount > 0) {
        throw new DeletionRejectedError(
          `This recipient has ${transferCount} transfer${transferCount === 1 ? "" : "s"} and cannot be deleted.`,
        );
      }
      this.recipientRecords.splice(index, 1);
    },
  };

  readonly transfers: TransferRepository = {
    list: async (query) => {
      await this.ready();
      return queryTransfers(this.transferRecords, query);
    },

    get: async (id) => {
      await this.ready();
      const transfer = this.transferRecords.find((item) => item.id === id);
      if (!transfer) {
        throw new NotFoundError("Transfer", id);
      }
      return clone(transfer);
    },

    create: async (input) => {
      await this.ready();
      if (
        !this.recipientRecords.some(
          (recipient) => recipient.id === input.recipientId,
        )
      ) {
        throw new NotFoundError("Recipient", input.recipientId);
      }
      const fieldErrors = validateTransferInput({
        ...input,
        fee: input.fee ?? "0",
      });
      if (Object.keys(fieldErrors).length > 0) {
        throw new ValidationError(fieldErrors);
      }
      const timestamp = now();
      const transfer: Transfer = {
        ...input,
        provider: input.provider.trim(),
        id: `transfer-${crypto.randomUUID()}`,
        status: input.status ?? "pending",
        fee: input.fee ?? "0",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.transferRecords.push(transfer);
      return clone(transfer);
    },

    update: async (id, input) => {
      await this.ready();
      const index = this.transferRecords.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new NotFoundError("Transfer", id);
      }
      const current = this.transferRecords[index];
      if (
        input.recipientId !== undefined &&
        !this.recipientRecords.some(
          (recipient) => recipient.id === input.recipientId,
        )
      ) {
        throw new NotFoundError("Recipient", input.recipientId);
      }
      const fieldErrors = validateTransferInput({ ...current, ...input });
      if (Object.keys(fieldErrors).length > 0) {
        throw new ValidationError(fieldErrors);
      }
      const updated: Transfer = {
        ...current,
        ...input,
        id: current.id,
        recipientId: input.recipientId ?? current.recipientId,
        createdAt: current.createdAt,
        updatedAt: now(),
      };
      this.transferRecords[index] = updated;
      return clone(updated);
    },

    delete: async (id) => {
      await this.ready();
      const index = this.transferRecords.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new NotFoundError("Transfer", id);
      }
      this.transferRecords.splice(index, 1);
    },
  };
}
