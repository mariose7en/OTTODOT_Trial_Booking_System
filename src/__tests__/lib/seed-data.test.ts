import { readFileSync } from "fs";
import { join } from "path";
import {
  SEED_PARENTS,
  SEED_STUDENTS,
  SEED_TRIAL_CLASSES,
  SEED_BOOKINGS,
  SEED_PAYMENT_ATTEMPTS,
} from "@/lib/seed-data";
import { CreateBookingSchema } from "@/lib/validations/booking";
import { validCreateBooking } from "../helpers/bookingFixtures";

describe("Seed Data", () => {
  describe("SEED_PARENTS", () => {
    it("should have 2 parents", () => {
      expect(SEED_PARENTS).toHaveLength(2);
    });

    it("should have valid parent structure", () => {
      SEED_PARENTS.forEach((parent) => {
        expect(parent).toHaveProperty("id");
        expect(parent).toHaveProperty("first_name");
        expect(parent).toHaveProperty("last_name");
        expect(parent).toHaveProperty("residential_id");
        expect(parent).toHaveProperty("email");
        expect(parent.id).toMatch(/^AL-|^BO-/);
      });
    });

    it("should have uppercase names", () => {
      SEED_PARENTS.forEach((parent) => {
        expect(parent.first_name).toBe(parent.first_name.toUpperCase());
        expect(parent.last_name).toBe(parent.last_name.toUpperCase());
      });
    });
  });

  describe("SEED_STUDENTS", () => {
    it("should have 3 students", () => {
      expect(SEED_STUDENTS).toHaveLength(3);
    });

    it("should have valid student structure", () => {
      SEED_STUDENTS.forEach((student) => {
        expect(student).toHaveProperty("id");
        expect(student).toHaveProperty("parent_id");
        expect(student).toHaveProperty("first_name");
        expect(student).toHaveProperty("last_name");
        expect(student).toHaveProperty("residential_id");
      });
    });

    it("should reference valid parent_ids", () => {
      const parentIds = SEED_PARENTS.map((p) => p.id);
      SEED_STUDENTS.forEach((student) => {
        expect(parentIds).toContain(student.parent_id);
      });
    });
  });

  describe("SEED_TRIAL_CLASSES", () => {
    it("should have 2 trial classes", () => {
      expect(SEED_TRIAL_CLASSES).toHaveLength(2);
    });

    it("should have MATH and SCIENCE subjects", () => {
      const subjects = SEED_TRIAL_CLASSES.map((c) => c.subject);
      expect(subjects).toContain("MATH");
      expect(subjects).toContain("SCIENCE");
    });

    it("should have 4 max_seats each", () => {
      SEED_TRIAL_CLASSES.forEach((cls) => {
        expect(cls.max_seats).toBe(4);
      });
    });

    it("should have valid IDs with subject initials", () => {
      expect(SEED_TRIAL_CLASSES[0].id).toContain("MT");
      expect(SEED_TRIAL_CLASSES[1].id).toContain("SC");
    });
  });

  describe("SEED_BOOKINGS", () => {
    it("should have 5 bookings", () => {
      expect(SEED_BOOKINGS).toHaveLength(5);
    });

    it("should have 3 CONFIRMED bookings for SCIENCE class", () => {
      const scienceConfirmed = SEED_BOOKINGS.filter(
        (b) =>
          b.trial_class_id === "SC-S-20261002T1400-4" &&
          b.status === "CONFIRMED"
      );
      expect(scienceConfirmed).toHaveLength(3);
    });

    it("should have 1 PENDING_PAYMENT booking", () => {
      const pending = SEED_BOOKINGS.filter(
        (b) => b.status === "PENDING_PAYMENT"
      );
      expect(pending).toHaveLength(1);
    });

    it("should have 1 PAYMENT_FAILED booking", () => {
      const failed = SEED_BOOKINGS.filter(
        (b) => b.status === "PAYMENT_FAILED"
      );
      expect(failed).toHaveLength(1);
    });

    it("should have duplicate booking attempt (same student, same class)", () => {
      const charlieBookings = SEED_BOOKINGS.filter(
        (b) => b.student_id === "CH-RES789-20260925"
      );
      const scienceBookings = charlieBookings.filter(
        (b) => b.trial_class_id === "SC-S-20261002T1400-4"
      );
      expect(scienceBookings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("SEED_PAYMENT_ATTEMPTS", () => {
    it("should have 1 payment attempt", () => {
      expect(SEED_PAYMENT_ATTEMPTS).toHaveLength(1);
    });

    it("should reference a valid booking_id", () => {
      const bookingIds = SEED_BOOKINGS.map((b) => b.id);
      SEED_PAYMENT_ATTEMPTS.forEach((attempt) => {
        expect(bookingIds).toContain(attempt.booking_id);
      });
    });

    it("should have FAILED status", () => {
      expect(SEED_PAYMENT_ATTEMPTS[0].status).toBe("FAILED");
    });
  });
});

/**
 * L12 — the repo ships two seed datasets:
 *   src/lib/seed-data.ts   (drives POST /api/seed)      → AL-/CH-/MT-M-/BOOKING001 ids
 *   artifacts/seed.sql     (documented in README)       → PAR-/STU-/TRC-/BKG ids
 * These tests read seed.sql so the drift can only go green again when the two
 * datasets actually agree (fix_plan §15 L12).
 */
describe("L12 — lib/seed-data.ts vs artifacts/seed.sql", () => {
  const sql = readFileSync(join(process.cwd(), "artifacts", "seed.sql"), "utf8");

  const sqlSection = (table: string): string => {
    const match = sql.match(
      new RegExp(`INSERT INTO ${table}\\s*\\([^)]*\\) VALUES([\\s\\S]*?);`)
    );
    if (!match) throw new Error(`seed.sql has no INSERT for ${table}`);
    return match[1];
  };

  const sqlIds = (table: string): string[] =>
    [...sqlSection(table).matchAll(/\('([^']+)'/g)].map((m) => m[1]);

  const sqlEmails = (table: string): string[] =>
    [...sqlSection(table).matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]);

  const overlap = (a: string[], b: string[]): string[] =>
    a.filter((value) => b.includes(value));

  test("[BUG-ASSERT L12] the two seeds disagree on row counts for every table", () => {
    expect(SEED_PARENTS).toHaveLength(2);
    expect(sqlIds("parents")).toHaveLength(3);

    expect(SEED_STUDENTS).toHaveLength(3);
    expect(sqlIds("students")).toHaveLength(4);

    expect(SEED_TRIAL_CLASSES).toHaveLength(2);
    expect(sqlIds("trial_classes")).toHaveLength(4);

    expect(SEED_BOOKINGS).toHaveLength(5);
    expect(sqlIds("bookings")).toHaveLength(6);

    expect(SEED_PAYMENT_ATTEMPTS).toHaveLength(1);
    expect(sqlIds("payment_attempts")).toHaveLength(4);
  });

  test("[BUG-ASSERT L12] the id schemes are disjoint — neither seed can be inserted on top of the other", () => {
    expect(overlap(SEED_PARENTS.map((r) => r.id), sqlIds("parents"))).toEqual([]);
    expect(overlap(SEED_STUDENTS.map((r) => r.id), sqlIds("students"))).toEqual([]);
    expect(overlap(SEED_TRIAL_CLASSES.map((r) => r.id), sqlIds("trial_classes"))).toEqual([]);
    expect(overlap(SEED_BOOKINGS.map((r) => r.id), sqlIds("bookings"))).toEqual([]);

    expect(sqlIds("parents")).toContain("PAR-001");
    expect(SEED_PARENTS.map((r) => r.id)).toEqual(["AL-RES123-20260925", "BO-RES456-20260925"]);
  });

  test("[BUG-ASSERT L12] the datasets share emails, so running both collides on the unique key", () => {
    const collisions = overlap(
      SEED_PARENTS.map((r) => r.email),
      sqlEmails("parents")
    );
    expect(collisions).toContain("alice@example.com");

    // lib/seed-data students carry no email at all, where seed.sql gives every
    // student one — the API seed route therefore inserts NULL student emails
    expect(SEED_STUDENTS.every((r) => (r as { email?: string }).email === undefined)).toBe(
      true
    );
    expect(sqlEmails("students")).toContain("charlie@example.com");
  });

  test("[BUG-ASSERT L12/B5] only lib/seed-data trial-class ids satisfy CreateBookingSchema's id regex", () => {
    for (const cls of SEED_TRIAL_CLASSES) {
      expect(
        CreateBookingSchema.safeParse(validCreateBooking({ trial_class_id: cls.id })).success
      ).toBe(true);
    }
    for (const id of sqlIds("trial_classes")) {
      expect(
        CreateBookingSchema.safeParse(validCreateBooking({ trial_class_id: id })).success
      ).toBe(false);
    }
  });

  test.todo(
    "Target [FIX L12]: one canonical seed (artifacts/seed.sql) — lib/seed-data.ts regenerated from it or POST /api/seed removed"
  );
});
