import {
  SEED_PARENTS,
  SEED_STUDENTS,
  SEED_TRIAL_CLASSES,
  SEED_BOOKINGS,
  SEED_PAYMENT_ATTEMPTS,
} from "@/lib/seed-data";

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
