/**
 * GET /api/admin/students — admin student list with derived booking_count.
 * Also pins the missing `dynamic = "force-dynamic"` caching gap (fix_plan §7 P2).
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
import { GET } from "@/app/api/admin/students/route";

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

describe("GET /api/admin/students", () => {
  test("returns the declared projection with booking_count derived from the embedded bookings array", async () => {
    ctl.rows("students").push({
      id: "STU-901",
      first_name: "GEMMA",
      last_name: "TAN",
      email: "gemma@example.com",
      grade: 4,
      created_at: "2026-09-20T10:00:00+08:00",
      bookings: [{ id: "BKG-901" }, { id: "BKG-902" }],
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const gema = body.data.find((s: any) => s.id === "STU-901");
    expect(gema).toMatchObject({
      first_name: "GEMMA",
      email: "gemma@example.com",
      booking_count: 2,
    });
    expect(Object.keys(gema).sort()).toEqual([
      "booking_count",
      "created_at",
      "email",
      "first_name",
      "grade",
      "id",
      "last_name",
    ]);

    const [call] = ctl.callsFor("students", "select");
    expect(call.op).toBe("select");
    expect(call.columns).toContain("bookings (id)");
  });

  test("students with no embedded bookings → booking_count 0, [] never crashes", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    for (const row of body.data) {
      expect(row.booking_count).toBe(0);
    }
  });

  test("rows are ordered by created_at descending", async () => {
    ctl.rows("students").push(
      {
        id: "STU-A",
        first_name: "AAA",
        last_name: "A",
        email: "a@example.com",
        grade: 1,
        created_at: "2026-01-01T10:00:00+08:00",
        bookings: [],
      },
      {
        id: "STU-B",
        first_name: "BBB",
        last_name: "B",
        email: "b@example.com",
        grade: 2,
        created_at: "2026-06-01T10:00:00+08:00",
        bookings: [],
      }
    );

    const res = await GET();
    const body = await res.json();
    const ids = body.data.map((s: any) => s.id);

    expect(ids.indexOf("STU-B")).toBeLessThan(ids.indexOf("STU-A"));
  });

  test("supabase error object → 500 DATABASE_ERROR carrying the database message", async () => {
    ctl.program("students", {
      error: { code: "42501", message: "permission denied for table students" },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DATABASE_ERROR");
    expect(body.error.message).toContain("permission denied for table students");
    expect(body.error.message).toContain("42501");
  });

  test("[BUG-ASSERT] GET() takes no request → no way to attach dynamic = force-dynamic, so Next 14 caches the PII response", async () => {
    // The handler signature is () — there is no request argument to branch on,
    // and the module exports nothing but GET.
    const route = require("@/app/api/admin/students/route");
    expect(route.GET.length).toBe(0);
    expect(route.dynamic).toBeUndefined();
    expect(route.revalidate).toBeUndefined();
  });

  test.todo(
    "Target [FIX §7 P2]: export const dynamic = 'force-dynamic' so student PII is never cached"
  );
});
