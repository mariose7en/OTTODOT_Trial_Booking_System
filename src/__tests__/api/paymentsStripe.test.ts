/**
 * Stripe-facing payment routes: POST /api/payments/{create-intent,refund,webhook}.
 * Contract-level assertions: booking ids come from the shared id-schema (B4),
 * every failure path answers with the shared object envelope (B8), the price
 * comes from src/lib/payments/price.ts (D4), confirmation goes through
 * `confirm_trial_booking` (L2) and refunds record a REFUNDED ledger row against
 * the real payment intent (L4/D9). The suite runs with PAYMENT_PROVIDER=stripe
 * against a mocked `@/lib/stripe` — the mock-mode twin lives in
 * `paymentsMock.test.ts` (contract parity, R11).
 */
jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { create: jest.fn() },
    refunds: { create: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  },
}));

import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import {
  installSupabaseMock,
  SupabaseMock,
} from "../helpers/bookingSupabaseMock";
import { POST as createIntentPOST } from "@/app/api/payments/create-intent/route";
import { POST as refundPOST } from "@/app/api/payments/refund/route";
import { POST as webhookPOST } from "@/app/api/payments/webhook/route";
import { TRIAL_CLASS_PRICE_CENTS } from "@/lib/payments/price";

const mockCreateIntent = stripe.paymentIntents.create as unknown as jest.Mock;
const mockRefund = stripe.refunds.create as unknown as jest.Mock;
const mockConstructEvent = stripe.webhooks.constructEvent as unknown as jest.Mock;

let ctl: SupabaseMock;
let errSpy: jest.SpyInstance;
const savedProvider = process.env.PAYMENT_PROVIDER;

const UUID = "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23";

function pendingBooking(extra: Record<string, unknown> = {}) {
  return {
    id: UUID,
    trial_class_id: "MT-M-20261001T1000-4",
    status: "PENDING_PAYMENT",
    students: [{ first_name: "CHARLIE", last_name: "LEE" }],
    ...extra,
  };
}

function jsonPost(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const createIntent = (body: unknown) =>
  createIntentPOST(jsonPost("http://localhost/api/payments/create-intent", body));

const refund = (body: unknown) =>
  refundPOST(jsonPost("http://localhost/api/payments/refund", body));

const webhook = (event: unknown, sig: string | null = "t=1,v1=abc") => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sig !== null) headers["stripe-signature"] = sig;
  return webhookPOST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers,
      body: JSON.stringify(event),
    })
  );
};

beforeAll(() => {
  // this suite is the Stripe-adapter contract test: the routes must reach the
  // mocked `@/lib/stripe` module through the provider port (R11 parity).
  process.env.PAYMENT_PROVIDER = "stripe";
});

afterAll(() => {
  if (savedProvider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = savedProvider;
});

beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  ctl = installSupabaseMock(
    supabase as unknown as { from: jest.Mock; rpc: jest.Mock },
    {
      trial_classes: [
        {
          id: "MT-M-20261001T1000-4",
          class_name: "Math Trial Class",
          subject: "MATH",
        },
      ],
      bookings: [],
      payment_attempts: [],
    },
    { simulateConfirmRpc: true }
  );
  mockCreateIntent.mockResolvedValue({
    client_secret: "pi_secret_123",
    id: "pi_123",
  });
  mockRefund.mockResolvedValue({ id: "re_123", status: "succeeded", amount: 2000 });
  mockConstructEvent.mockImplementation((body: string) => JSON.parse(body));
});

afterEach(() => errSpy.mockRestore());

describe("POST /api/payments/create-intent", () => {
  test("booking ids minted by this app (BOOKING001-…) pass the shared id-schema and reach the DB", async () => {
    const res = await createIntent({ booking_id: "BOOKING001-20261001" });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(ctl.callsFor("bookings", "select")[0].filters).toContainEqual([
      "id",
      "BOOKING001-20261001",
    ]);
    expect(mockCreateIntent).not.toHaveBeenCalled();
  });

  test("a malformed booking id → 400 with the id field", async () => {
    const res = await createIntent({ booking_id: "not-an-id" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.booking_id).toBe("Invalid booking ID format");
    expect(ctl.callsFor("bookings", "select")).toHaveLength(0);
    expect(mockCreateIntent).not.toHaveBeenCalled();
  });

  test("missing booking_id → 400 VALIDATION_ERROR", async () => {
    const res = await createIntent({});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toHaveProperty("booking_id");
  });

  test("unknown booking → 404 object envelope", async () => {
    const res = await createIntent({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "NOT_FOUND",
      message: `Booking with ID ${UUID} not found`,
      statusCode: 404,
    });
    expect(mockCreateIntent).not.toHaveBeenCalled();
  });

  test("booking not awaiting payment → 400 object envelope, no Stripe call", async () => {
    ctl.rows("bookings").push(pendingBooking({ status: "CONFIRMED" }));

    const res = await createIntent({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "BOOKING_ERROR",
      message: "Booking is not in pending payment status",
      statusCode: 400,
    });
    expect(mockCreateIntent).not.toHaveBeenCalled();
  });

  test("trial class row missing → 404 object envelope", async () => {
    ctl.rows("bookings").push(pendingBooking({ trial_class_id: "TRC-404" }));

    const res = await createIntent({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(String(body.error.message)).toMatch(/Trial class/);
    expect(mockCreateIntent).not.toHaveBeenCalled();
  });

  test("pending booking → intent priced from the shared price constant", async () => {
    ctl.rows("bookings").push(pendingBooking());

    const res = await createIntent({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: { client_secret: "pi_secret_123", payment_intent_id: "pi_123" },
    });
    expect(mockCreateIntent).toHaveBeenCalledTimes(1);
    expect(mockCreateIntent.mock.calls[0][0]).toMatchObject({
      amount: TRIAL_CLASS_PRICE_CENTS,
      currency: "usd",
      metadata: {
        booking_id: UUID,
        trial_class_id: "MT-M-20261001T1000-4",
        student_name: "CHARLIE LEE",
        class_name: "Math Trial Class",
      },
    });

    const lookup = ctl.callsFor("trial_classes", "select")[0];
    expect(lookup.filters).toContainEqual(["id", "MT-M-20261001T1000-4"]);
  });

  test("[BUG-ASSERT] students returned as an object (as notifications/route treats them) → 500 TypeError", async () => {
    ctl.rows("bookings").push(
      pendingBooking({
        students: { first_name: "CHARLIE", last_name: "LEE" },
      })
    );

    const res = await createIntent({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toContain(
      "Cannot read properties of undefined"
    );
    expect(mockCreateIntent).not.toHaveBeenCalled();
  });

  test.todo(
    "Target [fix_plan types/booking.ts row]: one documented cardinality for students (array or object) honoured by every route"
  );
});

describe("POST /api/payments/refund", () => {
  test("booking ids minted by this app pass the shared id-schema and reach the DB", async () => {
    const res = await refund({ booking_id: "BOOKING001-20261001" });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(ctl.callsFor("bookings", "select")[0].filters).toContainEqual([
      "id",
      "BOOKING001-20261001",
    ]);
  });

  test("unknown booking → 404 object envelope", async () => {
    const res = await refund({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  test("only CONFIRMED bookings are refundable → 400 object envelope", async () => {
    ctl.rows("bookings").push({
      id: UUID,
      status: "PENDING_PAYMENT",
      payment_attempts: [],
    });

    const res = await refund({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "BOOKING_ERROR",
      message: "Only confirmed bookings can be refunded",
    });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  test("confirmed booking without a successful attempt → 400 object envelope", async () => {
    ctl.rows("bookings").push({
      id: UUID,
      status: "CONFIRMED",
      payment_attempts: [{ id: "A1", txn_id: "TXN-1", status: "FAILED" }],
    });

    const res = await refund({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "BOOKING_ERROR",
      message: "No successful payment found for this booking",
    });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  test("refund hands the recorded Stripe payment_intent to the provider (D9)", async () => {
    ctl.rows("bookings").push({
      id: UUID,
      status: "CONFIRMED",
      payment_attempts: [
        { id: "ATTEMPT002-20260924", txn_id: "pi_real_9", status: "SUCCESS" },
      ],
    });

    await refund({ booking_id: UUID, reason: "changed my mind" });

    expect(mockRefund).toHaveBeenCalledTimes(1);
    const arg = mockRefund.mock.calls[0][0];
    expect(arg.payment_intent).toBe("pi_real_9");
    expect(arg).toMatchObject({
      reason: "requested_by_customer",
      metadata: { booking_id: UUID, admin_reason: "changed my mind" },
    });
  });

  test("a legacy synthetic TXN-… id is refused with a 400 instead of being sent to Stripe", async () => {
    ctl.rows("bookings").push({
      id: UUID,
      status: "CONFIRMED",
      payment_attempts: [
        { id: "ATTEMPT002-20260924", txn_id: "TXN-2", status: "SUCCESS" },
      ],
    });

    const res = await refund({ booking_id: UUID, reason: "changed my mind" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "BOOKING_ERROR",
      message: "No payment intent recorded for this booking",
    });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  test("the refund moves the successful attempt to REFUNDED (one payment in the ledger)", async () => {
    ctl.rows("bookings").push({
      id: UUID,
      status: "CONFIRMED",
      payment_attempts: [
        { id: "ATTEMPT002-20260924", txn_id: "pi_real_9", status: "SUCCESS" },
      ],
    });

    const res = await refund({ booking_id: UUID });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      refund_id: "re_123",
      status: "succeeded",
      amount: 2000,
    });

    expect(ctl.rows("bookings")[0].status).toBe("REFUNDED");

    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(0);
    const updates = ctl.callsFor("payment_attempts", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ status: "REFUNDED" });
    expect(updates[0].filters).toContainEqual(["id", "ATTEMPT002-20260924"]);
  });
});

describe("POST /api/payments/webhook", () => {
  const succeeded = (bookingId?: string) => ({
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_webhook_1",
        metadata: bookingId === undefined ? {} : { booking_id: bookingId },
      },
    },
  });

  test("missing stripe-signature header → 400 object envelope, signature never checked", async () => {
    const res = await webhook(succeeded("X"), null);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Missing stripe-signature header",
      statusCode: 400,
    });
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(ctl.calls).toHaveLength(0);
  });

  test("signature verification failure → 400 'Invalid signature'", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const res = await webhook(succeeded("X"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid signature",
      statusCode: 400,
    });
    expect(mockConstructEvent).toHaveBeenCalledTimes(1);
    expect(mockConstructEvent.mock.calls[0][1]).toBe("t=1,v1=abc");
    expect(ctl.calls).toHaveLength(0);
  });

  test("payment_intent.succeeded → confirmation goes through the RPC, never a bare status update", async () => {
    ctl.rows("bookings").push({
      id: "BOOKING001-20261001",
      status: "PENDING_PAYMENT",
    });

    const res = await webhook(succeeded("BOOKING001-20261001"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });

    const rpc = ctl.rpcCalls();
    expect(rpc).toHaveLength(1);
    expect(rpc[0].name).toBe("confirm_trial_booking");
    expect(rpc[0].params).toEqual({
      p_booking_id: "BOOKING001-20261001",
      p_payment_result: "SUCCESS",
    });

    // L2: no direct bookings UPDATE — the RPC owns the transition
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(ctl.rows("bookings")[0].status).toBe("CONFIRMED");

    const inserts = ctl.callsFor("payment_attempts", "insert");
    expect(inserts[0].payload).toMatchObject({
      booking_id: "BOOKING001-20261001",
      status: "INITIATED",
      txn_id: "pi_webhook_1",
    });
    const updates = ctl.callsFor("payment_attempts", "update");
    expect((updates[0].payload as any).status).toBe("SUCCESS");
  });

  test("late payment_intent.payment_failed does not demote a CONFIRMED booking", async () => {
    ctl.rows("bookings").push({
      id: "BOOKING001-20261001",
      status: "CONFIRMED",
    });

    const res = await webhook({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_late", metadata: { booking_id: "BOOKING001-20261001" } } },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ ignored: true, reason: "already_confirmed" });
    expect(ctl.rows("bookings")[0].status).toBe("CONFIRMED");
    expect(ctl.rpcCalls()).toHaveLength(0);
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(0);
  });

  test("event without metadata.booking_id → 200 success and zero writes", async () => {
    const res = await webhook(succeeded());

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(ctl.calls).toHaveLength(0);
  });

  test("unhandled event type → 200 success (acknowledged, nothing written)", async () => {
    const res = await webhook({ type: "charge.refunded", data: { object: {} } });

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(ctl.calls).toHaveLength(0);
    expect(mockConstructEvent).toHaveBeenCalled();
  });
});
