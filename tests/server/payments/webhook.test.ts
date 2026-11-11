import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  paymentFindUnique: vi.fn(),
  confirmPayment: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    paymentLog: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
    payment: {
      findUnique: mocks.paymentFindUnique,
    },
  },
}));

vi.mock("@/server/payments/confirm", () => ({
  confirmPayment: mocks.confirmPayment,
}));

vi.mock("@/lib/env", () => ({
  env: {
    FLUTTERWAVE_WEBHOOK_HASH: "webhook-secret",
    FLUTTERWAVE_SECRET_KEY: "secret-key",
    NODE_ENV: "test",
  },
}));

import { processPaymentWebhook } from "@/server/payments/webhook";

const baseLog = {
  id: "log-1",
  memberId: "member-1",
  idempotencyKey: "idempotency-1",
  reference: "spotter_reference_1",
  type: "INITIATED" as const,
  purpose: "RENEWAL" as const,
  amountKobo: 3_000_000,
  currency: "NGN",
  status: "PENDING" as const,
};

function webhookBody() {
  return {
    event: "charge.completed",
    data: {
      id: 123,
      tx_ref: baseLog.reference,
      flw_ref: "flw-ref",
      amount: 30_000,
      currency: "NGN",
      status: "successful",
    },
  };
}

function verifyResponse(status: string, amount = 30_000) {
  return {
    ok: true,
    json: async () => ({
      status: "success",
      data: {
        id: 123,
        tx_ref: baseLog.reference,
        flw_ref: "flw-ref",
        amount,
        currency: "NGN",
        status,
      },
    }),
  };
}

describe("processPaymentWebhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.findFirst.mockImplementation(
      ({ where }: { where: { type: string } }) => {
        if (where.type === "INITIATED") return Promise.resolve(baseLog);
        if (where.type === "CONFIRMED") return Promise.resolve(null);
        return Promise.resolve(null);
      }
    );
    mocks.create.mockResolvedValue({});
    mocks.paymentFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a missing or wrong verif-hash before reading the log", async () => {
    expect(await processPaymentWebhook(null, webhookBody())).toEqual({
      success: false,
      status: 401,
    });
    expect(await processPaymentWebhook("wrong-hash", webhookBody())).toEqual({
      success: false,
      status: 401,
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "WEBHOOK_REJECTED",
      }),
    });
  });

  it("rejects an unknown reference", async () => {
    mocks.findFirst.mockResolvedValue(null);

    expect(
      await processPaymentWebhook("webhook-secret", webhookBody())
    ).toEqual({
      success: false,
      status: 404,
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "WEBHOOK_REJECTED",
        reason: "UNKNOWN_REFERENCE",
      }),
    });
  });

  it("requires a gateway transaction id", async () => {
    const result = await processPaymentWebhook("webhook-secret", {
      event: "charge.completed",
      data: { tx_ref: baseLog.reference },
    });

    expect(result).toEqual({ success: false, status: 400 });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "VERIFY_FAILED",
        reason: "MISSING_TRANSACTION_ID",
        verificationError: "Webhook did not include a gateway transaction id.",
      }),
    });
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it("rejects a verify response that does not match the payment log", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("successful", 31_000));

    const result = await processPaymentWebhook(
      "webhook-secret",
      webhookBody()
    );

    expect(result).toEqual({ success: false, status: 400 });
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "VERIFY_MISMATCH",
        reason: "DETAILS_MISMATCH",
        verificationError: "Gateway verification did not match the payment log.",
      }),
    });
  });

  it("confirms only after the gateway verify call matches", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("successful"));

    const result = await processPaymentWebhook(
      "webhook-secret",
      webhookBody()
    );

    expect(result).toEqual({ success: true, status: 200 });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/transactions/123/verify",
      {
        headers: {
          Authorization: "Bearer secret-key",
        },
      }
    );
    expect(mocks.confirmPayment).toHaveBeenCalledWith({
      reference: baseLog.reference,
      evidence: {
        gatewayTransactionId: "123",
        gatewayReference: "flw-ref",
        gatewayStatus: "successful",
        verifiedAmountKobo: 3_000_000,
        verifiedCurrency: "NGN",
        webhookReceivedAt: expect.any(Date),
      },
      paidAt: expect.any(Date),
    });
  });

  it("does not verify an already successful log again", async () => {
    mocks.findFirst.mockImplementation(
      ({ where }: { where: { type: string } }) => {
        if (where.type === "INITIATED") return Promise.resolve(baseLog);
        if (where.type === "CONFIRMED")
          return Promise.resolve({ id: "confirmed-1" });
        return Promise.resolve(null);
      }
    );

    const result = await processPaymentWebhook(
      "webhook-secret",
      webhookBody()
    );

    expect(result).toEqual({ success: true, status: 200 });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it("records a gateway-confirmed failed payment without confirming it", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("failed"));

    const result = await processPaymentWebhook(
      "webhook-secret",
      webhookBody()
    );

    expect(result).toEqual({ success: true, status: 200 });
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "GATEWAY_FAILED",
        status: "FAILED",
        gatewayStatus: "failed",
        verificationError: "Gateway reported the transaction as failed.",
      }),
    });
  });

  it("keeps a pending gateway status on the log", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("pending"));

    const result = await processPaymentWebhook(
      "webhook-secret",
      webhookBody()
    );

    expect(result).toEqual({ success: true, status: 200 });
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "GATEWAY_PENDING",
        status: "PENDING",
        gatewayStatus: "pending",
      }),
    });
  });

  it("acknowledges other Flutterwave events without touching the log", async () => {
    const result = await processPaymentWebhook("webhook-secret", {
      event: "transfer.completed",
      data: { id: 456 },
    });

    expect(result).toEqual({ success: true, status: 200 });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
