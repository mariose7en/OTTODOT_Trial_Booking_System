/**
 * lib/email-templates — the three HTML bodies actually sent (fix_plan P1:
 * "zero suites for lib/email-templates").
 * Pins L8 (unescaped interpolation), L6 (host-timezone date rendering) and the
 * hardcoded localhost links (fix_plan §7 P2).
 */
import {
  bookingConfirmedTemplate,
  paymentFailedTemplate,
  bookingReminderTemplate,
} from "@/lib/email-templates";

const confirmed = {
  studentName: "CHARLIE LEE",
  parentName: "ALICE LEE",
  className: "Math Trial Class",
  subject: "MATH",
  startTime: "2026-10-01T10:00:00+08:00",
  endTime: "2026-10-01T11:00:00+08:00",
  location: "Online Zoom",
  bookingId: "BOOKING001-20261001",
};

describe("bookingConfirmedTemplate", () => {
  test("renders the class details, names and booking reference", () => {
    const html = bookingConfirmedTemplate(confirmed);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Hi ALICE LEE,");
    expect(html).toContain("CHARLIE LEE's");
    expect(html).toContain("Math Trial Class");
    expect(html).toContain("MATH");
    expect(html).toContain("Online Zoom");
    expect(html).toContain("BOOKING001-20261001");
    expect(html).toContain("support@ottodot.com");
  });

  test("[BUG-ASSERT L8] user/DB values are interpolated into the HTML unescaped", () => {
    const html = bookingConfirmedTemplate({
      ...confirmed,
      parentName: `<img src=x onerror="alert('xss')">`,
      className: `<script>alert(1)</script>`,
    });

    expect(html).toContain('<img src=x onerror="alert(\'xss\')">');
    expect(html).toContain("<script>alert(1)</script>");
    expect(html).not.toContain("&lt;script&gt;");
  });

  test.todo(
    "Target [FIX L8]: escape every interpolated value (parentName, studentName, className, subject, location, bookingId)"
  );

  test("[BUG-ASSERT L6] date and time are formatted without timeZone → host timezone, not Asia/Singapore", () => {
    const timeOf = (iso: string, timeZone?: string) =>
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      });
    const dayOf = (iso: string, timeZone?: string) =>
      new Date(iso).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        ...(timeZone ? { timeZone } : {}),
      });

    const html = bookingConfirmedTemplate(confirmed);

    // the exact "start - end" pair the parent reads
    const renderedPair = `${timeOf(confirmed.startTime)} - ${timeOf(confirmed.endTime)}`;
    const sgPair = `${timeOf(confirmed.startTime, "Asia/Singapore")} - ${timeOf(
      confirmed.endTime,
      "Asia/Singapore"
    )}`;
    expect(html).toContain(renderedPair);
    expect(sgPair).toBe("10:00 AM - 11:00 AM"); // what Singapore parents should read
    if (renderedPair !== sgPair) {
      expect(html).not.toContain(sgPair);
    }

    const hostDay = dayOf(confirmed.startTime);
    const sgDay = dayOf(confirmed.startTime, "Asia/Singapore");
    expect(html).toContain(hostDay);
    if (hostDay !== sgDay) {
      expect(html).not.toContain(sgDay);
    }
  });

  test.todo(
    "Target [FIX L6]: render class dates/times with timeZone: 'Asia/Singapore' in every email"
  );

  test("empty location falls back to the online-session note", () => {
    const html = bookingConfirmedTemplate({ ...confirmed, location: "" });

    expect(html).toContain("Online (link will be sent before class)");
    expect(html).not.toContain("Online Zoom");
  });

  test("[BUG-ASSERT] with NEXT_PUBLIC_APP_URL unset the email links to localhost:3000", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    try {
      const html = bookingConfirmedTemplate(confirmed);
      expect(html).toContain('href="http://localhost:3000/bookings"');
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });

  test("NEXT_PUBLIC_APP_URL is used when it is set", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://ottodot.example";

    try {
      const html = bookingConfirmedTemplate(confirmed);
      expect(html).toContain('href="https://ottodot.example/bookings"');
      expect(html).not.toContain("localhost:3000");
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });

  test.todo(
    "Target [fix_plan §7 P2]: fail fast (or use NEXT_PUBLIC_APP_URL required) so production email links never point at localhost"
  );
});

describe("paymentFailedTemplate", () => {
  const props = {
    parentName: "ALICE LEE",
    studentName: "CHARLIE LEE",
    className: "Math Trial Class",
    bookingId: "BOOKING001-20261001",
  };

  test("renders parent, student, class and booking reference", () => {
    const html = paymentFailedTemplate(props);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("ALICE LEE");
    expect(html).toContain("CHARLIE LEE");
    expect(html).toContain("Math Trial Class");
    expect(html).toContain("BOOKING001-20261001");
  });

  test("[BUG-ASSERT L8] also interpolates unescaped", () => {
    const html = paymentFailedTemplate({
      ...props,
      className: `<script>alert(1)</script>`,
    });

    expect(html).toContain("<script>alert(1)</script>");
  });

  test.todo("Target [FIX L8]: paymentFailedTemplate escapes user content");
});

describe("bookingReminderTemplate", () => {
  const props = {
    parentName: "ALICE LEE",
    studentName: "CHARLIE LEE",
    className: "Math Trial Class",
    subject: "MATH",
    startTime: "2026-10-01T10:00:00+08:00",
    location: "Online Zoom",
  };

  test("renders the reminder with class details", () => {
    const html = bookingReminderTemplate(props);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("ALICE LEE");
    expect(html).toContain("Math Trial Class");
    expect(html).toContain("Online Zoom");
  });

  test("[BUG-ASSERT L6] reminder times are host-timezone formatted too", () => {
    const html = bookingReminderTemplate(props);
    const hostTime = new Date(props.startTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sgTime = new Date(props.startTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Singapore",
    });

    // every clock time rendered in the mail, in document order
    const renderedTimes = html.match(/\d{2}:\d{2} (?:AM|PM)/g) ?? [];

    expect(sgTime).toBe("10:00 AM"); // what Singapore parents should read
    expect(renderedTimes).toContain(hostTime);
    if (hostTime !== sgTime) {
      expect(renderedTimes).not.toContain(sgTime);
    }
  });

  test.todo(
    "Target [FIX L6]: bookingReminderTemplate renders in Asia/Singapore"
  );

  test("[BUG-ASSERT L8] reminder fields are unescaped", () => {
    const html = bookingReminderTemplate({
      ...props,
      parentName: `"><script>alert(1)</script>`,
    });

    expect(html).toContain("<script>alert(1)</script>");
  });
});
