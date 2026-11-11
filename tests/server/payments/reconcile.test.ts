import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  accessLogCreate: vi.fn(),
  confirmPayment: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    paymentLog: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
    privateAccessLog: {
      create: mocks.accessLogCreate,
    },
  },
}));

vi.mock("@/server/payments/confirm", () => ({
  confirmPayment: mocks.confirmPayment,
}));

vi.mock("@/lib/env", () => ({
  env: {
    FLUTTERWAVE_SECRET_KEY: "secret-key",
    NODE_ENV: "test",
  },
}));

import { reconcileMemberPayment } from "@/server/payments/reconcile";

const initiated = {
  reference: "spotter_reference_1",
  memberId: "member-1",
  amountKobo: 3_000_000,
  currency: "NGN",
};

type Where = { type: string | { in: string[] } };

function withResolution(resolution: string | null) {
  mocks.findFirst.mockImplementation(({ where }: { where: Where }) => {
    if (where.type === "INITIATED") return Promise.resolve(initiated);
    if (typeof where.type === "object") {
      return Promise.resolve(resolution ? { type: resolution } : null);
    }
    return Promise.resolve(null);
  });
}

function verifyResponse(status: string, amount = 30_000) {
  return {
    ok: true,
    json: async () => ({
      status: "success",
      data: {
        id: 123,
        tx_ref: initiated.reference,
        flw_ref: "flw-ref",
        amount,
        currency: "NGN",
        status,
      },
    }),
  };
}

describe("reconcileMemberPayment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.create.mockResolvedValue({});
    mocks.accessLogCreate.mockResolvedValue({});
    withResolution(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads only the session member's own payment and logs the read", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("pending"));

    await reconcileMemberPayment("member-1");

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: "member-1",
          type: "INITIATED",
        }),
      })
    );
    expect(mocks.accessLogCreate).toHaveBeenCalledWith({
      data: {
        sessionMemberId: "member-1",
        targetMemberId: "member-1",
        functionName: "getMemberLatestPayment",
      },
    });
  });

  it("returns none when she has no recent payment", async () => {
    mocks.findFirst.mockResolvedValue(null);

    expect(await reconcileMemberPayment("member-1")).toBe("none");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not ask the gateway again once confirmed", async () => {
    withResolution("CONFIRMED");

    expect(await reconcileMemberPayment("member-1")).toBe("confirmed");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it("does not ask the gateway again after a mismatch", async () => {
    withResolution("VERIFY_MISMATCH");

    expect(await reconcileMemberPayment("member-1")).toBe("review");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("verifies by her server generated reference and confirms on a match", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("successful"));

    expect(await reconcileMemberPayment("member-1")).toBe("confirmed");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=spotter_reference_1",
      { headers: { Authorization: "Bearer secret-key" } }
    );
    expect(mocks.confirmPayment).toHaveBeenCalledWith({
      reference: initiated.reference,
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

  it("stays pending without a log row while the gateway has no transaction yet", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    expect(await reconcileMemberPayment("member-1")).toBe("pending");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it("stays pending without a log row while the gateway reports pending", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("pending"));

    expect(await reconcileMemberPayment("member-1")).toBe("pending");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses an amount that does not match and records the mismatch", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("successful", 31_000));

    expect(await reconcileMemberPayment("member-1")).toBe("review");
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "VERIFY_MISMATCH",
        reason: "DETAILS_MISMATCH",
      }),
    });
  });

  it("reports failed only when the gateway says so", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("failed"));

    expect(await reconcileMemberPayment("member-1")).toBe("failed");
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "GATEWAY_FAILED",
        status: "FAILED",
      }),
    });
  });

  it("treats a lost race with the webhook as confirmed", async () => {
    mocks.fetch.mockResolvedValue(verifyResponse("successful"));
    mocks.confirmPayment.mockRejectedValue(new Error("unique constraint"));
    mocks.findFirst.mockImplementation(({ where }: { where: Where }) => {
      if (where.type === "INITIATED") return Promise.resolve(initiated);
      if (where.type === "CONFIRMED") return Promise.resolve({ id: "c-1" });
      return Promise.resolve(null);
    });

    expect(await reconcileMemberPayment("member-1")).toBe("confirmed");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
