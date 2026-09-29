/**
 * PayMock at the route level (payment_mockup M3): create-intent → charge →
 * emit → confirm → refund through the real routes, the dev control plane and
 * its production guard (D10).
 *
 * Runs with **no Stripe env**: the provider resolves to `mock` and webhook
 * signatures are verified with `whsec_mock` (D6). The Stripe twin of the same
 * contract lives in `paymentsStripe.test.ts` (R11 parity).
 *
 * Coverage: R1 (intent for a booking id), R3/R4 (signed deliveries incl.
 * duplicate/out-of-order), R5 (`REFUNDED` ledger row + `re_mock_…`), R8
 * (object envelope on every failure path), R10 (plan/reset/state), R12
 * (one state machine, no direct `UPDATE`).
 */
jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { supabase } from "@/lib/supabase";
import {
  installSupabaseMock,
  SupabaseMock,
} from "../helpers/bookingSupabaseMock";
import { seedTables } from "../helpers/bookingFixtures";
import { POST as createIntentPOST } from "@/app/api/payments/create-intent/route";
import { POST as confirmPOST } from "@/app/api/payments/confirm/route";
import { POST as refundPOST } from "@/app/api/payments/refund/route";
import { POST as webhookPOST } from "@/app/api/payments/webhook/route";
import { POST as planPOST } from "@/app/api/mock/payments/plan/route";
import { POST as emitPOST } from "@/app/api/mock/payments/emit/route";
import { POST as resetPOST } from "@/app/api/mock/payments/reset/route";
import { GET as stateGET } from "@/app/api/mock/payments/state/route";
import { mockControls } from "@/lib/payments/mock";
import { mockStore } from "@/lib/payments/mock/store";
import { buildEvent, buildWebhookRequest } from "@/lib/payments/mock/emit";
import { TRIAL_CLASS_PRICE_CENTS } from "@/lib/payments/price";

const BOOKING = "BOOKING001-20261001";

const ENV_KEYS = [
  "PAYMENT_PROVIDER",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];
const savedEnv: Record<string, string | undefined> = {};

let ctl: SupabaseMock;
let errSpy: jest.SpyInstance;

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) process.env[key] = savedEnv[key];
});

beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  mockControls.reset();
  ctl = installSupabaseMock(
    supabase as unknown as { from: jest.Mock; rpc: jest.Mock },
    freshTables(),
    { simulateConfirmRpc: true }
  );
});

afterEach(() => errSpy.mockRestore());

function freshTables() {
  const base = seedTables();
  return {
    ...base,
    bookings: [
      ...base.bookings.filter((b) => b.id !== BOOKING),
      {
        id: BOOKING,
        student_id: "STU-999",
        trial_class_id: "TRC-002",
        status: "PENDING_PAYMENT",
        registered_at: "2026-10-01T09:00:00+08:00",
        students: [{ first_name: "CHARLIE", last_name: "LEE" }],
      },
    ],
  };
}

function bookingRow(): Record<string, any> {
  return ctl.rows("bookings").find((b) => b.id === BOOKING) as any;
}

function jsonPost(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createIntent(booking_id = BOOKING) {
  const res = await createIntentPOST(
    jsonPost("http://localhost/api/payments/create-intent", { booking_id })
  );
  return { res, body: await res.json() };
}

async function plan(body: Record<string, unknown>) {
  const res = await planPOST(jsonPost("http://localhost/api/mock/payments/plan", body));
  return { res, body: await res.json() };
}

async function emit(body: Record<string, unknown>) {
  const res = await emitPOST(jsonPost("http://localhost/api/mock/payments/emit", body));
  return { res, body: await res.json() };
}

async function reset() {
  return resetPOST();
}

async function state() {
  const res = await stateGET();
  return { res, body: await res.json() };
}

async function refund(body: Record<string, unknown>) {
  const res = await refundPOST(
    jsonPost("http://localhost/api/payments/refund", body)
  );
  return { res, body: await res.json() };
}

/** Direct signed delivery (bypasses the control plane) for state-machine pins. */
async function deliver(type: "payment_intent.succeeded" | "payment_intent.payment_failed") {
  const intent = mockStore.findIntentByBooking(BOOKING);
  if (!intent) throw new Error("no mock intent for the booking under test");
  // the route checks the signature timestamp against the wall clock (300 s
  // tolerance), so it must be signed "now"
  const res = await webhookPOST(
    buildWebhookRequest(
      buildEvent(intent, type, Math.floor(Date.now() / 1000))
    )
  );
  return { res, body: await res.json() };
}

describe("R1 create-intent on the mock provider", () => {
  test("creates a pi_mock intent at TRIAL_CLASS_PRICE_CENTS and leaves the booking pending", async () => {
    const { res, body } = await createIntent();

    expect(res.status).toBe(200);
    expect(body.data.payment_intent_id).toMatch(/^pi_mock_\d+_\d{8}$/);
    expect(body.data.client_secret).toMatch(/^pi_mock_.*_secret_\d+$/);

    const snap = await state();
    expect(snap.body.data.intents).toHaveLength(1);
    expect(snap.body.data.intents[0]).toMatchObject({
      id: body.data.payment_intent_id,
      booking_id: BOOKING,
      amount_cents: TRIAL_CLASS_PRICE_CENTS,
      currency: "usd",
      status: "requires_payment_method",
      metadata: expect.objectContaining({ booking_id: BOOKING }),
    });

    // the intent is bookkeeping only: no ledger row, no status change
    expect(bookingRow().status).toBe("PENDING_PAYMENT");
    expect(ctl.callsFor("payment_attempts")).toHaveLength(0);
    expect(ctl.rpcCalls()).toHaveLength(0);
  });
});

describe("R3/R4/R12 webhook delivery through the control plane", () => {
  test("scripted success confirms via confirm_trial_booking — never a direct bookings UPDATE", async () => {
    const intent = await createIntent();
    const { res, body } = await emit({ booking_id: BOOKING });

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      delivered: 1,
      delivery: "once",
      event_types: ["payment_intent.succeeded"],
      statuses: [200],
      intent_id: intent.body.data.payment_intent_id,
    });

    const rpc = ctl.rpcCalls();
    expect(rpc).toHaveLength(1);
    expect(rpc[0].params).toEqual({
      p_booking_id: BOOKING,
      p_payment_result: "SUCCESS",
    });

    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(bookingRow().status).toBe("CONFIRMED");

    const inserts = ctl.callsFor("payment_attempts", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toMatchObject({
      booking_id: BOOKING,
      status: "INITIATED",
      txn_id: intent.body.data.payment_intent_id,
    });
    const updates = ctl.callsFor("payment_attempts", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ status: "SUCCESS" });
  });

  test("scripted failure marks the booking PAYMENT_FAILED with a FAILED attempt", async () => {
    await createIntent();
    const planned = await plan({ booking_id: BOOKING, outcome: "failure" });
    expect(planned.res.status).toBe(200);

    const { body } = await emit({ booking_id: BOOKING });
    expect(body.data.event_types).toEqual(["payment_intent.payment_failed"]);
    expect(body.data.statuses).toEqual([200]);

    const rpc = ctl.rpcCalls();
    expect(rpc).toHaveLength(1);
    expect(rpc[0].params).toMatchObject({ p_payment_result: "FAILED" });
    expect(bookingRow().status).toBe("PAYMENT_FAILED");
    expect(ctl.callsFor("payment_attempts", "update")[0].payload).toEqual({
      status: "FAILED",
    });
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
  });

  test("duplicate delivery is idempotent (I8): one RPC, one attempt, zero UPDATEs", async () => {
    await createIntent();
    const { res, body } = await emit({
      booking_id: BOOKING,
      delivery: "duplicate",
    });

    expect(res.status).toBe(200);
    expect(body.data.delivered).toBe(2);
    expect(body.data.statuses).toEqual([200, 200]);

    expect(ctl.rpcCalls()).toHaveLength(1);
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(bookingRow().status).toBe("CONFIRMED");
  });

  test("a late payment_failed after success is ignored (I5) and never reaches the RPC", async () => {
    await createIntent();
    await emit({ booking_id: BOOKING });

    const { res, body } = await deliver("payment_intent.payment_failed");
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      ignored: true,
      reason: "already_confirmed",
      status: "CONFIRMED",
    });

    expect(ctl.rpcCalls()).toHaveLength(1);
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(bookingRow().status).toBe("CONFIRMED");
  });

  test("RC-017: a cancelled booking is never resurrected by a success event", async () => {
    await createIntent();
    bookingRow().status = "CANCELLED";

    const { res, body } = await deliver("payment_intent.succeeded");
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      ignored: true,
      reason: "not_bookable",
      status: "CANCELLED",
    });

    expect(bookingRow().status).toBe("CANCELLED");
    expect(ctl.rpcCalls()).toHaveLength(0);
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(0);
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
  });

  test("HTTP confirm applies once, then answers 409 CONFLICT with the object envelope", async () => {
    const intent = await createIntent();
    const intentId = intent.body.data.payment_intent_id;
    mockControls.charge(intentId);

    const first = await confirmPOST(
      jsonPost("http://localhost/api/payments/confirm", {
        booking_id: BOOKING,
        payment_result: "success",
        payment_intent_id: intentId,
      })
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      success: true,
      data: { booking_id: BOOKING, status: "CONFIRMED" },
    });
    expect(
      ctl.callsFor("payment_attempts", "insert")[0].payload
    ).toMatchObject({ txn_id: intentId, status: "INITIATED" });

    const second = await confirmPOST(
      jsonPost("http://localhost/api/payments/confirm", {
        booking_id: BOOKING,
        payment_result: "success",
        payment_intent_id: intentId,
      })
    );
    const body = await second.json();
    expect(second.status).toBe(409);
    expect(body.error).toMatchObject({ code: "CONFLICT", statusCode: 409 });

    expect(ctl.rpcCalls()).toHaveLength(1);
    expect(bookingRow().status).toBe("CONFIRMED");
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
  });
});

describe("R5 refund on the mock provider", () => {
  async function confirmPaidBooking() {
    const intent = await createIntent();
    const intentId = intent.body.data.payment_intent_id;
    mockControls.charge(intentId);
    await emit({ booking_id: BOOKING });
    return intentId;
  }

  test("refund records re_mock_…, REFUNDED booking and a single REFUNDED ledger row", async () => {
    await confirmPaidBooking();

    const { res, body } = await refund({
      booking_id: BOOKING,
      reason: "changed my mind",
    });

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      refund_id: expect.stringMatching(/^re_mock_\d+_\d{8}$/),
      status: "succeeded",
      amount: TRIAL_CLASS_PRICE_CENTS,
    });

    expect(bookingRow().status).toBe("REFUNDED");
    expect(
      ctl.callsFor("payment_attempts", "update").map((c) => c.payload)
    ).toEqual([{ status: "SUCCESS" }, { status: "REFUNDED" }]);
    // one payment in the ledger — never a second SUCCESS row
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);

    const snap = await state();
    expect(snap.body.data.refunds).toHaveLength(1);
    expect(snap.body.data.refunds[0]).toMatchObject({
      id: body.data.refund_id,
      status: "succeeded",
    });
  });

  test("refunding a pending booking is refused with the object envelope", async () => {
    await createIntent();
    const { res, body } = await refund({ booking_id: BOOKING });

    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "BOOKING_ERROR",
      statusCode: 400,
      message: "Only confirmed bookings can be refunded",
    });
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
  });
});

describe("R8 uniform error envelopes on every payment route", () => {
  test("create-intent for an unknown booking → 404 NOT_FOUND object", async () => {
    const { res, body } = await createIntent("BOOKING999-20261001");
    expect(res.status).toBe(404);
    expect(body).toMatchObject({ success: false });
    expect(body.error).toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
      message: "Booking with ID BOOKING999-20261001 not found",
    });
  });

  test("create-intent with a malformed id → 400 VALIDATION_ERROR with fields", async () => {
    const { res, body } = await createIntent("not-an-id");
    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      message: "Validation failed",
      fields: { booking_id: expect.any(String) },
    });
  });

  test("webhook without a signature → 400 VALIDATION_ERROR, nothing written", async () => {
    const res = await webhookPOST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        body: "{}",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      message: "Missing stripe-signature header",
    });
    expect(ctl.calls).toHaveLength(0);
  });

  test("webhook with a bad signature → 400 'Invalid signature', nothing written", async () => {
    const res = await webhookPOST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
        body: JSON.stringify({ type: "payment_intent.succeeded" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid signature",
    });
    expect(ctl.calls).toHaveLength(0);
  });

  test("emit for an unknown booking → 400 VALIDATION_ERROR", async () => {
    const { res, body } = await emit({ booking_id: "BOOKING404-20261001" });
    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      message: expect.stringMatching(/No mock intent found/),
    });
  });

  test("plan with an unsupported outcome → 400 VALIDATION_ERROR", async () => {
    const { res, body } = await plan({ booking_id: BOOKING, outcome: "explode" });
    expect(res.status).toBe(400);
    expect(body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(body.error.fields.outcome).toMatch(/outcome/);
  });
});

describe("R10/D10 control plane lifecycle and production guard", () => {
  test("reset clears intents, scripts, refunds and the id sequence", async () => {
    const intent = await createIntent();
    mockControls.charge(intent.body.data.payment_intent_id);
    await emit({ booking_id: BOOKING });
    await refund({ booking_id: BOOKING });

    let snap = await state();
    expect(snap.body.data.intents).toHaveLength(1);
    expect(snap.body.data.refunds).toHaveLength(1);
    expect(snap.body.data.sequence).toBeGreaterThan(0);

    const resetRes = await reset();
    expect(resetRes.status).toBe(200);

    snap = await state();
    expect(snap.body.data).toMatchObject({
      intents: [],
      refunds: [],
      scripts: [],
      sequence: 0,
    });
  });

  test("D10: every /api/mock/* route answers 404 once PAYMENT_PROVIDER=stripe", async () => {
    process.env.PAYMENT_PROVIDER = "stripe";
    try {
      const s = await stateGET();
      expect(s.status).toBe(404);
      expect(await s.json()).toMatchObject({
        success: false,
        error: { code: "NOT_FOUND", statusCode: 404 },
      });

      const e = await emitPOST(
        jsonPost("http://localhost/api/mock/payments/emit", {
          booking_id: BOOKING,
        })
      );
      expect(e.status).toBe(404);

      const p = await planPOST(
        jsonPost("http://localhost/api/mock/payments/plan", {
          booking_id: BOOKING,
          outcome: "failure",
        })
      );
      expect(p.status).toBe(404);

      const r = await resetPOST();
      expect(r.status).toBe(404);
    } finally {
      delete process.env.PAYMENT_PROVIDER;
    }
  });

  test("D10: the control plane also 404s in production (NODE_ENV=production)", async () => {
    // `process.env.NODE_ENV` is typed read-only under Next's typings — the
    // guard reads it at request time, so simulating production is a cast.
    const env = process.env as Record<string, string | undefined>;
    const savedNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const s = await stateGET();
      expect(s.status).toBe(404);
      expect(await s.json()).toMatchObject({
        success: false,
        error: { code: "NOT_FOUND", statusCode: 404 },
      });
    } finally {
      env.NODE_ENV = savedNodeEnv;
    }
  });
});
