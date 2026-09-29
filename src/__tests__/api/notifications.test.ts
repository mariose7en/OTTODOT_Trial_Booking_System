/**
 * POST /api/notifications and POST /api/notifications/send-reminders —
 * the only email-producing routes in the app.
 * Pins L7 (false email success), L6 (server-local "tomorrow" window),
 * B19 (embedded-column filter without !inner), L14 (no reminder dedup),
 * B8 (string error envelopes); D-B25/D-B27 are fixed — a supabase select
 * error now answers 500 DATABASE_ERROR, distinct from a genuine 404.
 */
jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import {
  installSupabaseMock,
  SupabaseMock,
} from "../helpers/bookingSupabaseMock";
import { POST as notifyPOST } from "@/app/api/notifications/route";
import { POST as remindersPOST } from "@/app/api/notifications/send-reminders/route";

const mockSendEmail = sendEmail as unknown as jest.Mock;

let ctl: SupabaseMock;
let errSpy: jest.SpyInstance;

function completeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "BOOKING001-20261001",
    status: "CONFIRMED",
    students: {
      first_name: "CHARLIE",
      last_name: "LEE",
      parents: {
        first_name: "ALICE",
        last_name: "LEE",
        email: "alice@example.com",
      },
    },
    trial_classes: {
      class_name: "Math Trial Class",
      subject: "MATH",
      start_time: "2026-10-01T10:00:00+08:00",
      end_time: "2026-10-01T11:00:00+08:00",
      location: "Online Zoom",
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSendEmail.mockResolvedValue(true);
  errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  ctl = installSupabaseMock(
    supabase as unknown as { from: jest.Mock; rpc: jest.Mock },
    { bookings: [completeBooking()] }
  );
});

afterEach(() => errSpy.mockRestore());

const notify = (body: unknown) =>
  notifyPOST(
    new Request("http://localhost/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/notifications", () => {
  test("[BUG-ASSERT B8] missing type → 400 with a STRING error, not the object envelope errors.ts produces", async () => {
    const res = await notify({ booking_id: "BOOKING001-20261001" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
    expect(body.error).toBe("type and booking_id are required");
    expect(ctl.callsFor("bookings", "select")).toHaveLength(0);
  });

  test.todo(
    "Target [FIX B8]: one error envelope — { success, error: { code, message, fields? } } from every route"
  );

  test("missing booking_id → 400 string error", async () => {
    const res = await notify({ type: "booking_confirmed" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
  });

  test("unknown booking → 404 string error", async () => {
    const res = await notify({ type: "booking_confirmed", booking_id: "nope" });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Booking not found");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test("a database failure surfaces as DATABASE_ERROR, not a fake 404", async () => {
    ctl.program("bookings", {
      error: { code: "57014", message: "canceling statement due to timeout" },
    });

    const res = await notify({
      type: "booking_confirmed",
      booking_id: "BOOKING001-20261001",
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DATABASE_ERROR");
    expect(body.error.message).toContain("canceling statement due to timeout");
    expect(body.error.message).toContain("57014");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test("a genuine not-found (PostgREST 0-rows) still answers 404", async () => {
    const res = await notify({
      type: "booking_confirmed",
      booking_id: "BOOKING999-20991231",
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Booking not found");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test.todo(
    "Target [FIX D-B27]: a supabase select error → 500 DATABASE_ERROR, distinct from a genuine 404"
  );

  test("booking without parent/class data → 400 'Incomplete booking data'", async () => {
    ctl.reset({
      bookings: [completeBooking({ students: { first_name: "CHARLIE" } })],
    });

    const res = await notify({
      type: "booking_confirmed",
      booking_id: "BOOKING001-20261001",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Incomplete booking data");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["booking_confirmed", "Booking Confirmed - Math Trial Class"],
    ["payment_failed", "Payment Failed - Math Trial Class"],
    ["booking_reminder", "Reminder: Math Trial Class is tomorrow!"],
  ])(
    "type=%s → 200 and reports whatever sendEmail returned (L7 false positive)",
    async (type, subject) => {
      const res = await notify({ type, booking_id: "BOOKING001-20261001" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({
        success: true,
        data: { email_sent: true, type, booking_id: "BOOKING001-20261001" },
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@example.com",
          subject,
          html: expect.stringContaining("OTTODOT"),
        })
      );
    }
  );

  test("[BUG-ASSERT L7] email_sent mirrors sendEmail's unverifiable 'true' — SMTP not configured still reports success", async () => {
    // sendEmail resolves true without touching a transporter (see lib/email.test);
    // the route has no way to distinguish that from a real delivery.
    mockSendEmail.mockResolvedValue(true);

    const res = await notify({
      type: "booking_confirmed",
      booking_id: "BOOKING001-20261001",
    });
    const body = await res.json();

    expect(body.data.email_sent).toBe(true);
  });

  test.todo(
    "Target [FIX L7]: sendEmail returns false (or 'skipped') without SMTP config, so email_sent cannot lie"
  );

  test("sendEmail returning false still answers 200 with email_sent: false (no retry, no log)", async () => {
    mockSendEmail.mockResolvedValue(false);

    const res = await notify({
      type: "booking_confirmed",
      booking_id: "BOOKING001-20261001",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.email_sent).toBe(false);
  });

  test("unknown type → 400 naming the type", async () => {
    const res = await notify({
      type: "seat_gone_cya",
      booking_id: "BOOKING001-20261001",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Unknown notification type: seat_gone_cya");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

/** ISO of tomorrow's midnight expressed in UTC, for the Asia/Singapore comparison. */
function sgMidnightTomorrowUtcMs(): number {
  const sgTomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [y, m, d] = sgTomorrow.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000; // 00:00 SGT = 16:00Z prev day
}

describe("POST /api/notifications/send-reminders", () => {
  const tomorrowMorningIso = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
    return d.toISOString();
  };

  test("no confirmed bookings tomorrow → 200 'No reminders to send'", async () => {
    ctl.reset({ bookings: [] });

    const res = await remindersPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ message: "No reminders to send", count: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test("tomorrow's confirmed bookings → one email per parent, counts in the response", async () => {
    const start = tomorrowMorningIso();
    ctl.reset({
      bookings: [
        completeBooking({ id: "BKG-701", trial_classes: { class_name: "Math Trial Class", subject: "MATH", start_time: start, location: "Online" } }),
        completeBooking({
          id: "BKG-702",
          students: {
            first_name: "DAISY",
            last_name: "LEE",
            parents: { first_name: "ALICE", last_name: "LEE", email: "alice@example.com" },
          },
          trial_classes: { class_name: "Science Trial Class", subject: "SCIENCE", start_time: start, location: "Lab 2" },
        }),
      ],
    });

    const res = await remindersPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      message: "Sent 2 reminders, 0 failed",
      count: 2,
      failed: 0,
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alice@example.com" })
    );
  });

  test("a booking whose relation is incomplete is skipped, not crashed on", async () => {
    ctl.reset({
      bookings: [
        completeBooking({ id: "BKG-701", trial_classes: { class_name: "Math", subject: "MATH", start_time: tomorrowMorningIso(), location: "Online" } }),
        completeBooking({ id: "BKG-702", students: null }),
      ],
    });

    const res = await remindersPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.count).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test("sendEmail failures are counted, response stays 200", async () => {
    mockSendEmail.mockResolvedValueOnce(false);
    ctl.reset({
      bookings: [
        completeBooking({ id: "BKG-701", trial_classes: { class_name: "Math", subject: "MATH", start_time: tomorrowMorningIso(), location: "Online" } }),
      ],
    });

    const res = await remindersPOST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      message: "Sent 0 reminders, 1 failed",
      count: 0,
      failed: 1,
    });
  });

  test("[BUG-ASSERT L14] two calls in a row send the same reminders twice — nothing is deduplicated", async () => {
    ctl.reset({
      bookings: [
        completeBooking({ id: "BKG-701", trial_classes: { class_name: "Math", subject: "MATH", start_time: tomorrowMorningIso(), location: "Online" } }),
      ],
    });

    await remindersPOST();
    await remindersPOST();

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  test.todo(
    "Target [FIX L14]: reminders deduplicated per booking (reminders_sent / last_reminder_at) before sending"
  );

  test("[BUG-ASSERT L6] the window starts at server-local midnight, not Asia/Singapore midnight", async () => {
    ctl.reset({ bookings: [] });

    await remindersPOST();

    const [call] = ctl.callsFor("bookings", "select");
    const filters = call.filters ?? [];
    const gte = filters.find(
      ([col, , op]) => col === "trial_classes.start_time" && op === "gte"
    );
    const lt = filters.find(
      ([col, , op]) => col === "trial_classes.start_time" && op === "lt"
    );

    expect(gte).toBeDefined();
    expect(lt).toBeDefined();

    const expectedLocal = new Date();
    expectedLocal.setDate(expectedLocal.getDate() + 1);
    expectedLocal.setHours(0, 0, 0, 0);

    expect(Date.parse(gte![1] as string)).toBe(expectedLocal.getTime());
    expect(Date.parse(lt![1] as string)).toBe(
      expectedLocal.getTime() + 24 * 60 * 60 * 1000
    );

    const hostOffsetMin = -new Date().getTimezoneOffset();
    if (hostOffsetMin === 480) {
      expect(Date.parse(gte![1] as string)).toBe(sgMidnightTomorrowUtcMs());
    } else {
      expect(Date.parse(gte![1] as string)).not.toBe(sgMidnightTomorrowUtcMs());
    }
  });

  test.todo(
    "Target [FIX L6]: compute the reminder window in Asia/Singapore (+08), matching class start_time"
  );

  test("[BUG-ASSERT B19] filters trial_classes.start_time without a !inner join in the select", async () => {
    ctl.reset({ bookings: [] });

    await remindersPOST();

    const [call] = ctl.callsFor("bookings", "select");
    const cols = String(call.columns);
    expect(cols).toContain("trial_classes (");
    expect(cols).not.toContain("!inner");
    expect(
      call.filters?.some(([col]) => col.startsWith("trial_classes."))
    ).toBe(true);
  });

  test.todo(
    "Target [FIX B19]: select trial_classes!inner(...) so the embedded-column filter is valid PostgREST"
  );

  test("[BUG-ASSERT B8] a query failure → 500 with a STRING error envelope", async () => {
    ctl.program("bookings", { error: { message: "boom" } });

    const res = await remindersPOST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Failed to send reminders" });
    expect(errSpy).toHaveBeenCalledWith("[Send Reminders]", { message: "boom" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test.todo(
    "Target [FIX B8]: send-reminders uses createErrorResponse like the rest of /api"
  );
});
