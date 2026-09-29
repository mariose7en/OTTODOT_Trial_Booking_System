/**
 * Race scenarios for the payment writer (payment_mockup R4/R12 at route
 * level): duplicate, out-of-order and N-way parallel webhook deliveries plus a
 * webhook-vs-HTTP-confirm storm on one booking — the mock-level twin of the
 * ⛔ E2 harness scenarios RC-010/011/023.
 *
 * Invariants asserted for every storm (payment_mockup §5.2 + I5/I8/I10):
 *   - exactly one attempt reaches SUCCESS (one payment in the ledger),
 *   - the booking settles on CONFIRMED and is never demoted,
 *   - no `bookings` UPDATE is issued outside the writer's RPC path,
 *   - every delivery answers 200 (Stripe stops retrying).
 * The barrier is `Promise.all` over already-built requests — no timers (R9).
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
import { POST as emitPOST } from "@/app/api/mock/payments/emit/route";
import { mockControls } from "@/lib/payments/mock";

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

async function createIntent() {
  const res = await createIntentPOST(
    jsonPost("http://localhost/api/payments/create-intent", { booking_id: BOOKING })
  );
  return (await res.json()).data as {
    payment_intent_id: string;
    client_secret: string;
  };
}

async function emit(body: Record<string, unknown>) {
  const res = await emitPOST(
    jsonPost("http://localhost/api/mock/payments/emit", body)
  );
  return { res, body: await res.json() };
}

function successAttempts(): any[] {
  return ctl
    .rows("payment_attempts")
    .filter(
      (a) => a.booking_id === BOOKING && a.status === "SUCCESS"
    );
}

/** The storm invariants shared by every scenario below. */
function expectSingleConfirmedTransition() {
  expect(bookingRow().status).toBe("CONFIRMED");
  expect(successAttempts()).toHaveLength(1);
  expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
  const rpc = ctl.rpcCalls();
  expect(rpc.length).toBeGreaterThanOrEqual(1);
  for (const call of rpc) {
    expect(call.params).toMatchObject({ p_booking_id: BOOKING });
  }
}

describe("RC-010 style webhook storm (R4)", () => {
  test("10 parallel succeeded deliveries settle on one CONFIRMED transition", async () => {
    await createIntent();

    const { res, body } = await emit({
      booking_id: BOOKING,
      delivery: "parallel:10",
    });

    expect(res.status).toBe(200);
    expect(body.data.delivered).toBe(10);
    expect(body.data.delivery).toBe("parallel:10");
    expect(body.data.statuses).toHaveLength(10);
    expect(body.data.statuses.every((s: number) => s === 200)).toBe(true);

    expectSingleConfirmedTransition();
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
  });
});

describe("RC-023 style out-of-order storm (R4/I5)", () => {
  test("interleaved succeeded/failed deliveries settle on CONFIRMED, never demoted", async () => {
    await createIntent();

    const { res, body } = await emit({
      booking_id: BOOKING,
      events: [
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
      ],
      delivery: "parallel:5",
    });

    expect(res.status).toBe(200);
    expect(body.data.delivered).toBe(10);
    expect(body.data.statuses.every((s: number) => s === 200)).toBe(true);

    expectSingleConfirmedTransition();
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
  });
});

describe("webhook vs HTTP confirm on one booking (RC-023 / R12)", () => {
  test("exactly one writer wins; the loser reports 409 or an acknowledged ignore", async () => {
    const intent = await createIntent();

    const [emitted, confirmed] = await Promise.all([
      emit({ booking_id: BOOKING }),
      confirmPOST(
        jsonPost("http://localhost/api/payments/confirm", {
          booking_id: BOOKING,
          payment_result: "success",
          payment_intent_id: intent.payment_intent_id,
        })
      ),
    ]);

    expect(emitted.res.status).toBe(200);
    expect([200, 409]).toContain(confirmed.status);
    if (confirmed.status === 409) {
      expect((await confirmed.json()).error).toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    }

    expectSingleConfirmedTransition();
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
  });
});
