/**
 * GET /api/payments/history — route behind src/app/payments/history/page.tsx:44.
 * Pins B18 (auth uuid compared to bookings.student_id → always []) and covers
 * the D-B25 fix (supabase error objects map to DATABASE_ERROR, not INTERNAL_ERROR).
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
import { GET } from "@/app/api/payments/history/route";

let ctl: SupabaseMock;
let errSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  ctl = installSupabaseMock(
    supabase as unknown as { from: jest.Mock; rpc: jest.Mock },
    seedTables()
  );
});

afterEach(() => errSpy.mockRestore());

/** What the page sends: the Supabase auth user id (a uuid). */
const AUTH_USER_ID = "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23";

const history = (query = `user_id=${AUTH_USER_ID}`) =>
  GET(new Request(`http://localhost/api/payments/history?${query}`));

describe("GET /api/payments/history", () => {
  test("[BUG-ASSERT B18] the auth uuid is compared to bookings.student_id (STU-…) → 200 with an empty list", async () => {
    const res = await history();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);

    const [bookingsCall] = ctl.callsFor("bookings", "select");
    expect(bookingsCall.filters).toContainEqual(["student_id", AUTH_USER_ID]);

    // the column stores fixture ids, never an auth uuid
    const studentIds = ctl.rows("students").map((s) => s.id);
    expect(studentIds).toContain("STU-001");
    expect(studentIds).not.toContain(AUTH_USER_ID);

    // no bookings matched → payment_attempts never queried
    expect(ctl.callsFor("payment_attempts", "select")).toHaveLength(0);
  });

  test.todo(
    "Target [FIX B18]: resolve bookings via auth user → parents.auth_user_id → students, then query payment_attempts"
  );

  test("missing user_id → 400 VALIDATION_ERROR", async () => {
    const res = await history("");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toHaveProperty("user_id");
    expect(ctl.callsFor("bookings", "select")).toHaveLength(0);
  });

  test("non-uuid user_id → 400 VALIDATION_ERROR.fields.user_id (same z.uuid gate as B4)", async () => {
    const res = await history("user_id=STU-001");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.user_id).toBe("Invalid user ID format");
    expect(ctl.callsFor("bookings", "select")).toHaveLength(0);
  });

  test("a user that does own bookings → payment_attempts fetched with .in(booking_id, …)", async () => {
    ctl.rows("bookings").push({
      id: "BKG-901",
      student_id: AUTH_USER_ID,
      trial_class_id: "TRC-002",
      status: "CONFIRMED",
      registered_at: "2026-09-28T10:00:00+08:00",
    });
    ctl.rows("payment_attempts").push({
      id: "ATTEMPT901-20260928",
      booking_id: "BKG-901",
      status: "SUCCESS",
      txn_id: "TXN-9",
      created_at: "2026-09-28T11:00:00+08:00",
    });

    const res = await history();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ booking_id: "BKG-901", status: "SUCCESS" });

    const paymentsCall = ctl.callsFor("payment_attempts", "select")[0];
    const inFilter = paymentsCall.filters?.find(([col]) => col === "booking_id");
    expect(inFilter?.[2]).toBe("in");
    expect(inFilter?.[1]).toEqual(["BKG-901"]);
    expect(paymentsCall.columns).toContain("created_at");
  });

  test("a supabase error object maps to DATABASE_ERROR 500 carrying the database message and code", async () => {
    ctl.program("bookings", {
      error: { code: "42P01", message: 'relation "bookings" does not exist' },
    });

    const res = await history();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("DATABASE_ERROR");
    expect(body.error.message).toContain('relation "bookings" does not exist');
    expect(body.error.message).toContain("42P01");
    expect(errSpy).toHaveBeenCalled();
  });
});
