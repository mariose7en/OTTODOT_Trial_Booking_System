/**
 * Email unit suite (fix_plan §7: "no suite for lib/email").
 * Pins L6 (timezone-less formatting) and L7 (sendEmail reports success without
 * SMTP), both of which are visible from the API responses today.
 */
const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  // `@/lib/email` builds the transporter at import time, so the mock must
  // resolve `mockSendMail` lazily (it is initialised after the import)
  createTransport: () => ({
    sendMail: (...args: unknown[]) => (mockSendMail as jest.Mock)(...args),
  }),
}));

import { formatDate, formatTime, sendEmail } from "@/lib/email";

const html = "<p>Booking confirmed</p>";

describe("sendEmail", () => {
  const originalUser = process.env.SMTP_USER;
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSendMail.mockReset();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    if (originalUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = originalUser;
  });

  test("[BUG-ASSERT L7] with no SMTP configured, sendEmail returns true for a mail that was never sent", async () => {
    delete process.env.SMTP_USER;

    const ok = await sendEmail({ to: "a@b.c", subject: "Hello", html });

    expect(ok).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "[Email] SMTP not configured, skipping email send"
    );
    expect(logSpy).toHaveBeenCalledWith("[Email] To: a@b.c");
  });

  test("with SMTP configured it hands from/to/subject/html/text to the transporter", async () => {
    process.env.SMTP_USER = "mailer@example.com";
    mockSendMail.mockResolvedValue({ messageId: "1" });

    const ok = await sendEmail({
      to: "a@b.c",
      subject: "Hello",
      html,
      text: "plain",
    });

    expect(ok).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      to: "a@b.c",
      subject: "Hello",
      html,
      text: "plain",
    });
    expect(mockSendMail.mock.calls[0][0].from).toContain("OTTODOT");
  });

  test("transporter failure is swallowed → false", async () => {
    process.env.SMTP_USER = "mailer@example.com";
    mockSendMail.mockRejectedValue(new Error("connection refused"));

    await expect(
      sendEmail({ to: "a@b.c", subject: "Hello", html })
    ).resolves.toBe(false);
    expect(errSpy).toHaveBeenCalledWith(
      "[Email] Failed to send:",
      expect.any(Error)
    );
  });

  test.todo(
    "Target [FIX L7]: without SMTP config sendEmail reports 'skipped' (or false) instead of true, so /api/notifications cannot claim email_sent"
  );
});

describe("formatDate / formatTime (L6 timezone)", () => {
  const iso = "2026-10-01T10:00:00+08:00"; // 10:00 SGT class
  const sg = (opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      ...opts,
    });
  const inSG = sg({ timeZone: "Asia/Singapore" });
  const onHost = sg({});

  test("[BUG-ASSERT L6] the helpers render the class time in the HOST timezone, not Asia/Singapore", () => {
    expect(inSG).toBe("10:00 AM"); // what the email should say

    if (onHost === inSG) {
      // runner happens to be in Asia/Singapore — defect invisible, keep green
      expect(formatTime(iso)).toBe(inSG);
      return;
    }
    expect(formatTime(iso)).toBe(onHost);
    expect(formatTime(iso)).not.toBe(inSG);
  });

  test("[BUG-ASSERT L6] a class shortly after midnight SGT can land on the previous calendar day", () => {
    const lateIso = "2026-10-01T01:00:00+08:00"; // 2026-09-30 17:00 UTC
    const sgDay = new Date(lateIso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Singapore",
    });
    expect(sgDay).toBe("Thursday, October 1, 2026");

    const hostDay = new Date(lateIso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (hostDay === sgDay) {
      expect(formatDate(lateIso)).toBe(sgDay);
      return;
    }
    expect(formatDate(lateIso)).toBe(hostDay);
    expect(formatDate(lateIso)).not.toBe(sgDay);
  });

  test.todo(
    "Target [FIX L6]: formatDate/formatTime take an explicit timeZone (Asia/Singapore) -> '10:00 AM' and the correct calendar day on any host"
  );
});
