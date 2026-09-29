/**
 * L3 — booking / payment / trial-class API routes, driven against a programmable
 * supabase mock (`../helpers/bookingSupabaseMock`).
 * Cases: BK-API-001 … BK-API-029, plus BK-UT-013/014/015 which are executed here
 * because the id generators are module-private (plan §10.5, D-v1).
 */
jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    refunds: { create: jest.fn() },
    paymentIntents: { create: jest.fn() },
  },
}));

import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import {
  installSupabaseMock,
  SupabaseMock,
} from "../helpers/bookingSupabaseMock";
import {
  seedTables,
  validCreateBooking,
  flatUiCreateBooking,
  jsonRequest,
  FMT_CLASS_ID,
} from "../helpers/bookingFixtures";
import { GET as bookingsGET, POST as bookingsPOST } from "@/app/api/bookings/route";
import { GET as bookingByIdGET } from "@/app/api/bookings/[id]/route";
import { POST as confirmPOST } from "@/app/api/payments/confirm/route";
import { POST as refundPOST } from "@/app/api/payments/refund/route";
import { GET as trialClassesGET } from "@/app/api/trial-classes/route";
import { POST as webhookPOST } from "@/app/api/payments/webhook/route";

let ctl: SupabaseMock;
const savedProvider = process.env.PAYMENT_PROVIDER;

beforeAll(() => {
  // The webhook suite drives the Stripe adapter seam (constructEvent mocked);
  // everything else in this file is provider-agnostic.
  process.env.PAYMENT_PROVIDER = "stripe";
});

afterAll(() => {
  if (savedProvider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = savedProvider;
});

beforeEach(() => {
  jest.clearAllMocks();
  ctl = installSupabaseMock(
    supabase as unknown as { from: jest.Mock; rpc: jest.Mock },
    seedTables(),
    { simulateConfirmRpc: true }
  );
});

function postBooking(body: unknown) {
  return bookingsPOST(
    jsonRequest("http://localhost/api/bookings", body)
  );
}

function getBookings(query = "") {
  return bookingsGET(new Request(`http://localhost/api/bookings${query}`));
}

function postConfirm(body: unknown) {
  return confirmPOST(
    jsonRequest("http://localhost/api/payments/confirm", body)
  );
}

const UUID = "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23";

describe("BK-API POST /api/bookings (L3)", () => {
  test("BK-API-001: nested payload on a class with free seats → 200 + PENDING_PAYMENT", async () => {
    const res = await postBooking(validCreateBooking());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("PENDING_PAYMENT");
    expect(body.data.booking_id).toMatch(/^BOOKING\d{3}-\d{8}$/);
    const inserted = ctl.callsFor("bookings", "insert")[0].payload as any;
    expect(inserted.status).toBe("PENDING_PAYMENT");
    expect(inserted.trial_class_id).toBe(FMT_CLASS_ID);
  });

  test("BK-API-002: [BUG-ASSERT B1] the flat UI payload → 400 VALIDATION_ERROR naming parent/student", async () => {
    const res = await postBooking(flatUiCreateBooking());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fields)).toEqual(
      expect.arrayContaining(["parent", "student"])
    );
    expect(ctl.callsFor("bookings", "insert")).toHaveLength(0);
  });

  test.todo("BK-API-002 Target [FIX B1]: flat UI payload → 200 + PENDING_PAYMENT row");

  test("BK-API-003: missing trial_class_id → 400 with fields.trial_class_id", async () => {
    const payload: any = validCreateBooking();
    delete payload.trial_class_id;
    const res = await postBooking(payload);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.fields.trial_class_id).toBeTruthy();
  });

  test("BK-API-004: format-valid but unknown class id → 404 NOT_FOUND", async () => {
    const res = await postBooking(
      validCreateBooking({ trial_class_id: "MT-Z-20991231T2359-9" })
    );
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toMatch(/not found/i);
  });

  test("BK-API-005: [BUG-ASSERT B5] seed class id TRC-001 → 400 (regex) instead of booking", async () => {
    const res = await postBooking(
      validCreateBooking({ trial_class_id: "TRC-001" })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.fields.trial_class_id).toMatch(/Invalid trial class ID format/);
  });

  test.todo("BK-API-005 Target [FIX B5]: trial_class_id=TRC-001 → 200 (or 404 for a truly unknown class)");

  test("BK-API-006: class with 0 confirmed → booking row created as PENDING_PAYMENT", async () => {
    const res = await postBooking(validCreateBooking());
    expect(res.status).toBe(200);
    const insert = ctl.callsFor("bookings", "insert");
    expect(insert).toHaveLength(1);
    expect((insert[0].payload as any).status).toBe("PENDING_PAYMENT");
  });

  test("BK-API-007: full class (confirmed == max_seats) → 409 CONFLICT", async () => {
    ctl.reset({
      ...seedTables(),
      trial_classes: [
        {
          id: FMT_CLASS_ID,
          class_id: "CLS-001",
          class_name: "FULL",
          subject: "MATH",
          start_time: "2026-10-01T10:00:00+08:00",
          max_seats: 2,
        },
      ],
      bookings: [
        { id: "BKG-F1", student_id: "STU-001", trial_class_id: FMT_CLASS_ID, status: "CONFIRMED" },
        { id: "BKG-F2", student_id: "STU-002", trial_class_id: FMT_CLASS_ID, status: "CONFIRMED" },
      ],
      students: seedTables().students,
      parents: seedTables().parents,
    });
    const res = await postBooking(validCreateBooking());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("No seats available for this class");
    expect(ctl.callsFor("bookings", "insert")).toHaveLength(0);
  });

  test("BK-API-008: [BUG-ASSERT B20] seat-count query error → count null → guard bypassed, booking created", async () => {
    ctl.program("bookings", { count: null, error: { message: "boom" } });
    const res = await postBooking(validCreateBooking());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(ctl.callsFor("bookings", "insert")).toHaveLength(1);
  });

  test.todo(
    "BK-API-008 Target [FIX B20]: a failing seat-count query → 500 DATABASE_ERROR, never a silently-open seat guard"
  );

  test("BK-API-009: parent email already exists → no parents.insert (reuses existing id)", async () => {
    const res = await postBooking(validCreateBooking());
    expect(res.status).toBe(200);
    expect(ctl.callsFor("parents", "insert")).toHaveLength(0);
    const parentLookup = ctl
      .callsFor("parents", "select")
      .find((c) => c.filters?.some(([col]) => col === "email"));
    expect(parentLookup?.filters).toContainEqual(["email", "alice@example.com"]);
  });

  test("BK-API-010: [BUG-ASSERT L11] new parent id and residential_id embed the raw phone", async () => {
    const res = await postBooking(
      validCreateBooking({
        parent: {
          first_name: "alice",
          last_name: "lee",
          email: "brand.new@example.com",
          phone: "+65 9123 4567",
        },
      })
    );
    expect(res.status).toBe(200);
    const insert = ctl.callsFor("parents", "insert")[0].payload as any;
    expect(insert.id).toContain("+65 9123 4567");
    expect(insert.id).toMatch(/^AL-\+65 9123 4567-\d{8}$/);
    expect(insert.residential_id).toBe("+65 9123 4567");
  });

  test.todo(
    "BK-API-010 Target [FIX L11]: parent id is derived without PII and residential_id comes from the payload, not the phone"
  );

  test("BK-API-011: [BUG-ASSERT L1] student lookup keys on residential_id = grade; grade/email never stored", async () => {
    const res = await postBooking(validCreateBooking());
    expect(res.status).toBe(200);
    const lookup = ctl
      .callsFor("students", "select")
      .find((c) => c.filters?.some(([col]) => col === "residential_id"));
    expect(lookup?.filters).toContainEqual(["residential_id", "4"]);
    const insert = ctl.callsFor("students", "insert")[0].payload as any;
    expect(insert.residential_id).toBe("4");
    expect(insert).not.toHaveProperty("grade");
    expect(insert).not.toHaveProperty("email");
    const seeded = seedTables().students;
    expect(seeded.every((s) => s.residential_id !== "4")).toBe(true);
  });

  test.todo(
    "BK-API-011 Target [FIX L1]: lookup by the student's real residential_id; grade and email are persisted"
  );

  test("BK-API-012: [BUG-ASSERT L1] a second child of the same grade attaches to the first child's student row", async () => {
    const first = await postBooking(
      validCreateBooking({
        student: { first_name: "charlie", last_name: "lee", grade: 4 },
      })
    );
    const second = await postBooking(
      validCreateBooking({
        student: { first_name: "daisy", last_name: "lee", grade: 4 },
      })
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const inserts = ctl.callsFor("students", "insert");
    expect(inserts).toHaveLength(1); // second booking found the first child's row
    const bookingsInserted = ctl.callsFor("bookings", "insert").map((c) => c.payload as any);
    expect(bookingsInserted[0].student_id).toBe(bookingsInserted[1].student_id);
  });

  test.todo(
    "BK-API-012 Target [FIX L1]: two children in the same grade get two distinct student rows and two distinct student_ids"
  );

  test("BK-API-013: [BUG-ASSERT D-B08] booking PK collision on insert → 500 (no retry)", async () => {
    ctl.program("bookings", { passThrough: true }); // the seat-count select
    ctl.program("bookings", {
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (id) already exists.",
      },
    });
    const res = await postBooking(validCreateBooking());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DATABASE_ERROR");
    expect(body.error.message).toBe("Failed to create booking");
  });

  test.todo(
    "BK-API-013 Target [FIX D-B08]: id generation retries on collision → 200, never a user-visible 500"
  );
});

describe("BK-UT id generators, executed through POST /api/bookings (L1, plan D-v1)", () => {
  test("BK-UT-013: generated booking ids always match BOOKING<000-999>-<YYYYMMDD>", async () => {
    const FIRST = "ABCDEFGHIJKL".split("");
    const LAST = "ZYXWVUTSRQPO".split("");
    // deterministic, distinct random values so this test is not subject to the
    // 1000-value/day birthday collisions it would otherwise hit (see BK-UT-014)
    let n = -1;
    const spy = jest
      .spyOn(Math, "random")
      .mockImplementation(() => (n += 1) / 1000);
    const ids: string[] = [];
    try {
      for (let i = 0; i < 12; i += 1) {
        const res = await postBooking(
          validCreateBooking({
            parent: {
              first_name: `p${i}`,
              last_name: `q${i}`,
              email: `gen${i}@example.com`,
              phone: `+65 9000 000${i}`,
            },
            student: {
              first_name: FIRST[i],
              last_name: LAST[i],
              grade: (i % 6) + 1,
            },
          })
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        ids.push(body.data.booking_id);
      }
    } finally {
      spy.mockRestore();
    }
    for (const id of ids) {
      expect(id).toMatch(/^BOOKING\d{3}-\d{8}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("BK-UT-014: [BUG-ASSERT D-B08] identical random values collide → second booking 500s (no retry)", async () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.4242);
    try {
      const first = await postBooking(
        validCreateBooking({
          parent: { first_name: "a", last_name: "b", email: "a@example.com", phone: "+65 9000 0002" },
          student: { first_name: "a", last_name: "b", grade: 1 },
        })
      );
      expect(first.status).toBe(200);
      const second = await postBooking(
        validCreateBooking({
          parent: { first_name: "c", last_name: "d", email: "c@example.com", phone: "+65 9000 0003" },
          student: { first_name: "c", last_name: "d", grade: 2 },
        })
      );
      const body = await second.json();
      expect(second.status).toBe(500);
      expect(body.error.code).toBe("DATABASE_ERROR");
    } finally {
      spy.mockRestore();
    }
  });

  test.todo(
    "BK-UT-014 Target [FIX D-B08]: with a deterministic random source the second booking still returns 200 with a distinct id"
  );

  test("BK-UT-015: [BUG-ASSERT L11] generateSmartId embeds the phone number in the parent PK", async () => {
    await postBooking(
      validCreateBooking({
        parent: {
          first_name: "alice",
          last_name: "lee",
          email: "phone.pk@example.com",
          phone: "+65 9111 2222",
        },
      })
    );
    const payload = ctl.callsFor("parents", "insert")[0].payload as any;
    expect(payload.id).toBe(`AL-+65 9111 2222-${new Date().toISOString().split("T")[0].replace(/-/g, "")}`);
  });

  test.todo(
    "BK-UT-015 Target [FIX L11]: parent id does not contain the raw phone number"
  );
});

describe("BK-API GET routes (L3)", () => {
  test("BK-API-014: GET /api/bookings returns raw rows with no joins", async () => {
    const res = await getBookings();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(6);
    expect(body.data[0]).toHaveProperty("status");
    expect(body.data[0]).not.toHaveProperty("students");
    expect(body.data[0]).not.toHaveProperty("trial_classes");
  });

  test.todo(
    "BK-API-014 Target [FIX B11]: GET /api/bookings joins parent/trial class data for admin consumers"
  );

  test("BK-API-015: ?status=CONFIRMED filters by status", async () => {
    const res = await getBookings("?status=CONFIRMED");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(4);
    expect(body.data.every((b: any) => b.status === "CONFIRMED")).toBe(true);
    const call = ctl.callsFor("bookings", "select")[0];
    expect(call.filters).toContainEqual(["status", "CONFIRMED"]);
  });

  test("BK-API-016: [BUG-ASSERT §6] ?status=COMPLETED is accepted by the schema but can never match a row", async () => {
    const res = await getBookings("?status=COMPLETED");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    const call = ctl.callsFor("bookings", "select")[0];
    expect(call.filters).toContainEqual(["status", "COMPLETED"]);
    const stored = new Set(ctl.rows("bookings").map((b) => b.status));
    expect(stored.has("COMPLETED")).toBe(false);
  });

  test.todo("BK-API-016 Target [FIX §6]: status query enum == DB CHECK set (no COMPLETED)");

  test("BK-API-017: [BUG-ASSERT B5] ?trial_class_id=TRC-001 → 400", async () => {
    const res = await getBookings("?trial_class_id=TRC-001");
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(ctl.callsFor("bookings", "select")).toHaveLength(0);
  });

  test.todo("BK-API-017 Target [FIX B5]: ?trial_class_id=TRC-001 → 200 with that class's rows");

  test("BK-API-018: [BUG-ASSERT] ?parent_email is validated then ignored — no filter applied", async () => {
    const res = await getBookings("?parent_email=alice@example.com");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(6);
    const call = ctl.callsFor("bookings", "select")[0];
    expect(call.filters?.some(([col]) => col === "parent_email")).toBe(false);
    expect(call.filters ?? []).toHaveLength(0);
  });

  test.todo("BK-API-018 Target: ?parent_email returns only that parent's bookings");

  test("BK-API-019: GET /api/bookings/BOOKING001-20260928 → 200 with the booking", async () => {
    ctl.rows("bookings").push({
      id: "BOOKING001-20260928",
      student_id: "STU-001",
      trial_class_id: "TRC-002",
      status: "PENDING_PAYMENT",
    });

    const res = await bookingByIdGET(new Request("http://x"), {
      params: Promise.resolve({ id: "BOOKING001-20260928" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.id).toBe("BOOKING001-20260928");
    expect(
      ctl.callsFor("bookings", "select")[0].filters
    ).toContainEqual(["id", "BOOKING001-20260928"]);
  });

  test("BK-API-019b: a malformed booking id still → 400 with the id field", async () => {
    const res = await bookingByIdGET(new Request("http://x"), {
      params: Promise.resolve({ id: "not-a-booking-id" }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.fields.id).toMatch(/Invalid booking ID format/);
    expect(ctl.callsFor("bookings", "select")).toHaveLength(0);
  });

  test("BK-API-020: GET /api/bookings/<unknown uuid> → 404 NOT_FOUND", async () => {
    const res = await bookingByIdGET(new Request("http://x"), {
      params: Promise.resolve({ id: UUID }),
    });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("BK-API POST /api/payments/confirm (L3)", () => {
  // BK-API-021…026 need a booking whose id survives `ConfirmPaymentSchema`
  // (uuid-only, fix_plan B4) — seed one with a uuid-shaped id.
  const uuidBooking = {
    id: UUID,
    student_id: "STU-004",
    trial_class_id: "TRC-002",
    status: "PENDING_PAYMENT",
    registered_at: "2026-09-29T10:00:00+08:00",
  };

  beforeEach(() => {
    ctl.rows("bookings").push({ ...uuidBooking });
  });

  function setBookingStatus(status: string) {
    const row = ctl.rows("bookings").find((b) => b.id === UUID);
    if (row) row.status = status;
  }

  test("BK-API-021: valid pending booking + 'success' → RPC called with SUCCESS, attempt recorded", async () => {
    const res = await postConfirm({
      booking_id: UUID,
      payment_result: "success",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("CONFIRMED");
    const rpc = ctl.rpcCalls()[0];
    expect(rpc.name).toBe("confirm_trial_booking");
    expect(rpc.params).toEqual({
      p_booking_id: UUID,
      p_payment_result: "SUCCESS",
    });
    const attempts = ctl.callsFor("payment_attempts", "insert");
    expect(attempts).toHaveLength(1);
    expect((attempts[0].payload as any).booking_id).toBe(UUID);
    const updates = ctl.callsFor("payment_attempts", "update");
    expect((updates[0].payload as any).status).toBe("SUCCESS");
    // booking lookup used the pending status guard
    expect(
      ctl.callsFor("bookings", "select")[0].filters
    ).toContainEqual(["id", UUID]);
  });

  test("BK-API-021b: [BUG-ASSERT L5] the response reports the RPC return code as if it were a status", async () => {
    ctl.programRpc({ data: "NO_SEATS_AVAILABLE", error: null });
    const res = await postConfirm({
      booking_id: UUID,
      payment_result: "success",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("NO_SEATS_AVAILABLE");
    const dbStatuses = new Set(
      ["PENDING_PAYMENT", "CONFIRMED", "PAYMENT_FAILED", "CANCELLED", "REFUNDED"]
    );
    expect(dbStatuses.has(body.data.status)).toBe(false);
    expect(dbStatuses.has(String(ctl.rows("bookings")[0].status))).toBe(true);
  });

  test.todo(
    "BK-API-021b Target [FIX L5]: the response carries the stored status; the RPC code is reported separately"
  );

  test("BK-API-022: payment_result 'SUCCESS' (what the UI sends) → 200 and the booking is confirmed", async () => {
    const res = await postConfirm({
      booking_id: UUID,
      payment_result: "SUCCESS",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("CONFIRMED");
    const rpc = ctl.rpcCalls()[0];
    expect(rpc.name).toBe("confirm_trial_booking");
    expect(rpc.params).toEqual({
      p_booking_id: UUID,
      p_payment_result: "SUCCESS",
    });
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
  });

  test("BK-API-023: non-pending booking → 409 with the shared error envelope", async () => {
    setBookingStatus("CONFIRMED");
    const res = await postConfirm({
      booking_id: UUID,
      payment_result: "success",
    });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "Booking is not in pending payment status. Current status: CONFIRMED",
        fields: undefined,
        statusCode: 409,
      },
    });
    expect(ctl.rpcCalls()).toHaveLength(0);
  });

  test("BK-API-024: unknown booking id → 404 and the RPC is never reached (D-B06 guard)", async () => {
    const res = await postConfirm({
      booking_id: "11111111-2222-4333-8444-555555555555",
      payment_result: "success",
    });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(ctl.rpcCalls()).toHaveLength(0);
  });

  test("BK-API-025: RPC error → 500 DATABASE_ERROR and the attempt is marked FAILED", async () => {
    ctl.programRpc({ data: null, error: { message: "rpc exploded" } });
    const res = await postConfirm({
      booking_id: UUID,
      payment_result: "success",
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.message).toBe("Payment processing failed");
    const updates = ctl.callsFor("payment_attempts", "update");
    expect((updates[0].payload as any).status).toBe("FAILED");
  });

  test("BK-API-026: a failed payment_attempts insert fails the flow (500 DATABASE_ERROR)", async () => {
    ctl.program("payment_attempts", {
      data: null,
      error: { message: "attempt insert failed" },
    });
    const res = await postConfirm({
      booking_id: UUID,
      payment_result: "success",
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DATABASE_ERROR");
    expect(body.error.message).toBe("Failed to record payment attempt");
    // the RPC is never reached once bookkeeping failed
    expect(ctl.rpcCalls()).toHaveLength(0);
  });
});

describe("BK-API POST /api/payments/webhook (L3)", () => {
  function webhookRequest(type: string, bookingId: string) {
    // Real Stripe signs the *event JSON* that is also the request body; the
    // mocked constructEvent simply parses it back (the seam is still asserted).
    const event = {
      id: "evt_1",
      type,
      data: { object: { id: "pi_123", metadata: { booking_id: bookingId } } },
    };
    (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(
      (payload: string) => JSON.parse(payload)
    );
    return new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=sig" },
      body: JSON.stringify(event),
    });
  }

  test("BK-API-027: webhook payment_intent.succeeded routes through the seat-capacity RPC", async () => {
    const res = await webhookPOST(webhookRequest("payment_intent.succeeded", "BKG-004"));
    expect(res.status).toBe(200);

    const rpc = ctl.rpcCalls();
    expect(rpc).toHaveLength(1);
    expect(rpc[0].name).toBe("confirm_trial_booking");
    expect(rpc[0].params).toEqual({
      p_booking_id: "BKG-004",
      p_payment_result: "SUCCESS",
    });

    // no bare bookings UPDATE anywhere — the RPC owns the transition (L2)
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(
      ctl.rows("bookings").find((b) => b.id === "BKG-004")!.status
    ).toBe("CONFIRMED");

    const inserts = ctl.callsFor("payment_attempts", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toMatchObject({
      booking_id: "BKG-004",
      status: "INITIATED",
      txn_id: "pi_123",
    });
    const updates = ctl.callsFor("payment_attempts", "update");
    expect((updates[0].payload as any).status).toBe("SUCCESS");
  });

  test("BK-API-028: out-of-order payment_failed after succeeded is ignored (CONFIRMED never clobbered)", async () => {
    await webhookPOST(webhookRequest("payment_intent.succeeded", "BKG-004"));
    const res = await webhookPOST(
      webhookRequest("payment_intent.payment_failed", "BKG-004")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.ignored).toBe(true);
    expect(body.data?.reason).toBe("already_confirmed");

    expect(ctl.rpcCalls()).toHaveLength(1);
    expect(ctl.callsFor("bookings", "update")).toHaveLength(0);
    expect(
      ctl.rows("bookings").find((b) => b.id === "BKG-004")!.status
    ).toBe("CONFIRMED");
    expect(ctl.callsFor("payment_attempts", "insert")).toHaveLength(1);
  });

  test("BK-API-028b: missing stripe-signature header → 400 object envelope", async () => {
    const res = await webhookPOST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Missing stripe-signature header",
      statusCode: 400,
    });
  });
});

describe("BK-API GET /api/trial-classes (L3)", () => {
  function getTrialClasses(query = "") {
    return trialClassesGET(
      new Request(`http://localhost/api/trial-classes${query}`)
    );
  }

  test("BK-API-029: seats are derived from CONFIRMED rows only (pending does not consume a seat)", async () => {
    const res = await getTrialClasses();
    const body = await res.json();
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(body.data.map((c: any) => [c.id, c]));
    expect(byId["TRC-002"].confirmed_count).toBe(3);
    expect(byId["TRC-002"].seats_remaining).toBe(1); // the last-seat fixture
    expect(byId["TRC-001"].confirmed_count).toBe(1); // PAYMENT_FAILED row ignored
    expect(byId["TRC-001"].seats_remaining).toBe(3);
    expect(byId["TRC-003"].seats_remaining).toBe(4);
  });

  test("BK-API-029b: [BUG-ASSERT L9] one count query per class (N+1), 5 classes → 5 bookings queries", async () => {
    await getTrialClasses();
    expect(ctl.callsFor("bookings", "select")).toHaveLength(
      seedTables().trial_classes.length
    );
  });

  test.todo(
    "BK-API-029b Target [FIX L9]: a single aggregate query computes every class's confirmed count"
  );

  test("BK-API-029c: [BUG-ASSERT B20] a failing count query silently reports the class as empty", async () => {
    ctl.program("bookings", { count: null, error: { message: "rls denied" } });
    const res = await getTrialClasses();
    const body = await res.json();
    const trc001 = body.data.find((c: any) => c.id === "TRC-001");
    expect(trc001.seats_remaining).toBe(trc001.max_seats);
    expect(trc001.confirmed_count).toBe(0);
  });

  test.todo(
    "BK-API-029c Target [FIX B20]: a failing count query → 500 DATABASE_ERROR, never a full-capacity lie"
  );
});
