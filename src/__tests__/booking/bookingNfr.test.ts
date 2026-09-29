/**
 * L6 — non-functional / robustness of the booking surface.
 * Cases: BK-NFR-001 … BK-NFR-008
 *
 * NFR-003's card-level display assertion lives in `bookingUi.test.tsx`
 * (BK-NFR-003b) because it needs jsdom — see plan §10.5 (D-v2).
 */
jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { supabase } from "@/lib/supabase";
import {
  installSupabaseMock,
  SupabaseMock,
} from "../helpers/bookingSupabaseMock";
import {
  seedTables,
  validCreateBooking,
  jsonRequest,
} from "../helpers/bookingFixtures";
import { GET as trialClassesGET } from "@/app/api/trial-classes/route";
import { POST as bookingsPOST } from "@/app/api/bookings/route";
import { POST as confirmPOST } from "@/app/api/payments/confirm/route";
import { POST as notificationsPOST } from "@/app/api/notifications/route";

let ctl: SupabaseMock;

beforeEach(() => {
  jest.clearAllMocks();
  ctl = installSupabaseMock(
    supabase as unknown as { from: jest.Mock; rpc: jest.Mock },
    seedTables()
  );
});

function getTrialClasses(query = "") {
  return trialClassesGET(
    new Request(`http://localhost/api/trial-classes${query}`)
  );
}

function postBooking(body: unknown) {
  return bookingsPOST(jsonRequest("http://localhost/api/bookings", body));
}

function postConfirm(body: unknown) {
  return confirmPOST(
    jsonRequest("http://localhost/api/payments/confirm", body)
  );
}

const CLASS_ID = "MT-M-20261001T1000-4";

describe("BK-NFR query behaviour (L6)", () => {
  test("BK-NFR-001: [BUG-ASSERT L9] one count query per class — 5 classes → 5 bookings queries", async () => {
    await getTrialClasses();
    expect(ctl.callsFor("bookings", "select")).toHaveLength(5);
    expect(ctl.callsFor("trial_classes", "select")).toHaveLength(1);
  });

  test.todo("BK-NFR-001 Target [FIX L9]: a single aggregate query serves every class's seat count");

  test("BK-NFR-002: max_seats = 0 → seats_remaining is 0 (not undefined, not NaN, not negative)", async () => {
    ctl.reset({
      ...seedTables(),
      trial_classes: [
        {
          id: CLASS_ID,
          class_id: "CLS-001",
          class_name: "ZERO SEATS",
          subject: "MATH",
          start_time: "2026-10-01T10:00:00+08:00",
          max_seats: 0,
        },
      ],
      bookings: [],
    });
    const res = await getTrialClasses();
    const body = await res.json();
    const cls = body.data[0];
    expect(cls.seats_remaining).toBe(0);
    expect(cls.confirmed_count).toBe(0);
    expect(Number.isFinite(cls.seats_remaining)).toBe(true);
  });

  test.todo(
    "BK-NFR-002 Target: a zero-capacity class is excluded from booking (or rejected at creation)"
  );

  test("BK-NFR-003: [BUG-ASSERT L9] confirmed > max_seats → seats_remaining goes negative (unclamped)", async () => {
    ctl.reset({
      ...seedTables(),
      trial_classes: [
        {
          id: CLASS_ID,
          class_id: "CLS-001",
          class_name: "OVERBOOKED",
          subject: "MATH",
          start_time: "2026-10-01T10:00:00+08:00",
          max_seats: 4,
        },
      ],
      bookings: [
        { id: "B1", student_id: "STU-001", trial_class_id: CLASS_ID, status: "CONFIRMED" },
        { id: "B2", student_id: "STU-002", trial_class_id: CLASS_ID, status: "CONFIRMED" },
        { id: "B3", student_id: "STU-003", trial_class_id: CLASS_ID, status: "CONFIRMED" },
        { id: "B4", student_id: "STU-004", trial_class_id: CLASS_ID, status: "CONFIRMED" },
        { id: "B5", student_id: "STU-005", trial_class_id: CLASS_ID, status: "CONFIRMED" },
      ],
    });
    const res = await getTrialClasses();
    const body = await res.json();
    expect(body.data[0].seats_remaining).toBe(-1);
    expect(body.data[0].seats_remaining).toBeLessThan(0);
  });

  test.todo("BK-NFR-003 Target [FIX L9]: seats_remaining is clamped to [0, max_seats]");

  test("BK-NFR-004: ?available=true drops full classes but keeps past-dated ones", async () => {
    ctl.reset({
      ...seedTables(),
      trial_classes: [
        {
          id: "TRC-FULL",
          class_id: "CLS-001",
          class_name: "FULL CLASS",
          subject: "MATH",
          start_time: "2026-10-01T10:00:00+08:00",
          max_seats: 2,
        },
        {
          id: "TRC-PAST",
          class_id: "CLS-001",
          class_name: "PAST CLASS",
          subject: "MATH",
          start_time: "2020-01-01T10:00:00+08:00",
          max_seats: 4,
        },
      ],
      bookings: [
        { id: "BF1", student_id: "STU-001", trial_class_id: "TRC-FULL", status: "CONFIRMED" },
        { id: "BF2", student_id: "STU-002", trial_class_id: "TRC-FULL", status: "CONFIRMED" },
      ],
    });
    const res = await getTrialClasses("?available=true");
    const body = await res.json();
    const ids = body.data.map((c: any) => c.id);
    expect(ids).not.toContain("TRC-FULL");
    expect(ids).toContain("TRC-PAST"); // [BUG-ASSERT] a class that already ran is still advertised
  });

  test.todo("BK-NFR-004 Target [D-B22]: ?available=true also excludes classes that have already started");

  test("BK-NFR-007: repeated seat-count reads are identical (no torn/inconsistent counts)", async () => {
    const first = await (await getTrialClasses()).json();
    const second = await (await getTrialClasses()).json();
    expect(second).toEqual(first);
    expect(first.data.find((c: any) => c.id === "TRC-002").seats_remaining).toBe(1);
  });
});

describe("BK-NFR payload and throughput (L6)", () => {
  function bookingWithStudentName(name: string) {
    const payload: any = validCreateBooking();
    payload.student.first_name = name;
    return payload;
  }

  test("BK-NFR-005: zod enforces the 100-char name cap (101 → 400)", async () => {
    const okRes = await postBooking(bookingWithStudentName("A".repeat(100)));
    expect(okRes.status).toBe(200);
    const longRes = await postBooking(bookingWithStudentName("A".repeat(101)));
    expect(longRes.status).toBe(400);
    const body = await longRes.json();
    expect(body.error.fields["student.first_name"]).toMatch(/too long/i);
  });

  test("BK-NFR-006: 50 sequential creates complete in under 2s (mocked data layer)", async () => {
    // deterministic distinct random values: this case measures throughput, the
    // 1000-value/day id collisions are pinned separately by BK-UT-014 / BK-API-013
    let n = -1;
    const spy = jest
      .spyOn(Math, "random")
      .mockImplementation(() => (n += 1) / 1000);
    const started = Date.now();
    let created = 0;
    try {
      for (let i = 0; i < 50; i += 1) {
        const payload: any = validCreateBooking();
        payload.parent.first_name = `n${i}`;
        payload.parent.last_name = `p${i}`;
        payload.parent.email = `nfr${i}@example.com`;
        payload.parent.phone = `+65 9${String(i).padStart(4, "0")}`;
        payload.student.first_name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i % 26];
        payload.student.last_name = "X";
        payload.student.grade = 1 + Math.floor(i / 26);
        const res = await postBooking(payload);
        if (res.status === 200) created += 1;
      }
    } finally {
      spy.mockRestore();
    }
    const elapsed = Date.now() - started;
    expect(created).toBe(50);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("BK-NFR error envelope consistency (L6)", () => {
  test("BK-NFR-008: [BUG-ASSERT B8] envelopes still disagree across the API surface", async () => {
    // object envelope (schema failure)
    const schemaFail = await postBooking({}); // invalid payload
    const schemaBody = await schemaFail.json();
    expect(typeof schemaBody.error).toBe("object");
    expect(schemaBody.error.code).toBe("VALIDATION_ERROR");

    // 404 (unknown booking) is an object …
    const conflict = await postConfirm({
      booking_id: "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23",
      payment_result: "success",
    });
    const conflictBody = await conflict.json();
    expect(typeof conflictBody.error).toBe("object");

    // … and the confirm 409 is an object too (fixed by payment_mockup M1, D3)
    ctl.rows("bookings").push({
      id: "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23",
      student_id: "STU-004",
      trial_class_id: "TRC-002",
      status: "CONFIRMED",
    });
    const conflict409 = await postConfirm({
      booking_id: "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23",
      payment_result: "success",
    });
    const body409 = await conflict409.json();
    expect(conflict409.status).toBe(409);
    expect(typeof body409.error).toBe("object");
    expect(body409.error.code).toBe("CONFLICT");

    // … but other booking-facing routes still answer bare strings
    const notif = await notificationsPOST(
      jsonRequest("http://localhost/api/notifications", {
        type: "booking_confirmed",
        booking_id: "nope",
      })
    );
    const notifBody = await notif.json();
    expect(notif.status).toBe(404);
    expect(typeof notifBody.error).toBe("string");
  });

  test.todo(
    "BK-NFR-008 Target [FIX B8]: every booking endpoint uses one error envelope ({success:false, error:{code,message,statusCode}})"
  );
});
