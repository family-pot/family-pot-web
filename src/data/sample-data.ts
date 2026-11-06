import type { Recipient, Transfer } from "./types";

// SAMPLE DATA ONLY. These records are not real people or real transfers.
// Amounts, rates and fees are strings so no floating-point maths is involved.
export const sampleRecipients: readonly Recipient[] = Object.freeze([
  {
    id: "sample-recipient-amara",
    name: "Amara Okafor",
    relationship: "Sister",
    country: "NG",
    currency: "NGN",
    createdAt: "2026-01-04T09:00:00.000Z",
    updatedAt: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "sample-recipient-luis",
    name: "Luis Hernández",
    relationship: "Father",
    country: "MX",
    currency: "MXN",
    createdAt: "2026-01-06T09:00:00.000Z",
    updatedAt: "2026-01-06T09:00:00.000Z",
  },
]);

export const sampleTransfers: readonly Transfer[] = Object.freeze([
  {
    id: "sample-transfer-1",
    recipientId: "sample-recipient-amara",
    amount: "250.00",
    currency: "USD",
    exchangeRate: "1540.25",
    fee: "3.49",
    status: "completed",
    createdAt: "2026-01-10T10:30:00.000Z",
    updatedAt: "2026-01-10T10:32:00.000Z",
  },
  {
    id: "sample-transfer-2",
    recipientId: "sample-recipient-luis",
    amount: "120.50",
    currency: "USD",
    exchangeRate: "17.0833",
    fee: "2.99",
    status: "pending",
    createdAt: "2026-01-12T14:15:00.000Z",
    updatedAt: "2026-01-12T14:15:00.000Z",
  },
]);
