/**
 * Booking test fixtures — mirror of the relevant rows in `artifacts/seed.sql`
 * (§2.5 of `artifacts/booking_testing.md`), plus payload builders.
 *
 * Seed classes: TRC-001 (3 free), TRC-002 (1 free — the last-seat fixture),
 * TRC-003/TRC-004 (empty), and FMT_CLASS_ID, whose id matches the
 * `CreateBookingSchema` regex so the happy path can be exercised at all.
 */

import type { SeedTables } from "./bookingSupabaseMock";

/** id that satisfies `/^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$/` (seed.sql ids like `TRC-001` do not). */
export const FMT_CLASS_ID = "MT-M-20261001T1000-4";

export const trialClasses = [
  {
    id: "TRC-001",
    class_id: "CLS-001",
    class_name: "MATH TRIAL - OCT 1",
    subject: "MATH",
    start_time: "2026-10-01T10:00:00+08:00",
    end_time: "2026-10-01T11:00:00+08:00",
    location: "Online Zoom",
    max_seats: 4,
  },
  {
    id: "TRC-002",
    class_id: "CLS-002",
    class_name: "SCIENCE TRIAL - OCT 2",
    subject: "SCIENCE",
    start_time: "2026-10-02T14:00:00+08:00",
    end_time: "2026-10-02T15:00:00+08:00",
    location: "Online Zoom",
    max_seats: 4,
  },
  {
    id: "TRC-003",
    class_id: "CLS-001",
    class_name: "MATH TRIAL - OCT 8",
    subject: "MATH",
    start_time: "2026-10-08T10:00:00+08:00",
    end_time: "2026-10-08T11:00:00+08:00",
    location: "Online Zoom",
    max_seats: 4,
  },
  {
    id: "TRC-004",
    class_id: "CLS-003",
    class_name: "ADVANCED MATH - OCT 10",
    subject: "MATH",
    start_time: "2026-10-10T15:00:00+08:00",
    end_time: "2026-10-10T16:30:00+08:00",
    location: "Online Zoom",
    max_seats: 4,
  },
  {
    id: FMT_CLASS_ID,
    class_id: "CLS-001",
    class_name: "MATH TRIAL - FMT",
    subject: "MATH",
    start_time: "2026-10-01T10:00:00+08:00",
    end_time: "2026-10-01T11:00:00+08:00",
    location: "Online Zoom",
    max_seats: 4,
  },
];

export const bookings = [
  { id: "BKG-001", student_id: "STU-001", trial_class_id: "TRC-002", status: "CONFIRMED", registered_at: "2026-09-26T10:00:00+08:00" },
  { id: "BKG-002", student_id: "STU-002", trial_class_id: "TRC-002", status: "CONFIRMED", registered_at: "2026-09-27T10:00:00+08:00" },
  { id: "BKG-003", student_id: "STU-003", trial_class_id: "TRC-002", status: "CONFIRMED", registered_at: "2026-09-28T10:00:00+08:00" },
  { id: "BKG-004", student_id: "STU-004", trial_class_id: "TRC-002", status: "PENDING_PAYMENT", registered_at: "2026-09-29T10:00:00+08:00" },
  { id: "BKG-005", student_id: "STU-001", trial_class_id: "TRC-001", status: "PAYMENT_FAILED", registered_at: "2026-09-28T10:00:00+08:00" },
  { id: "BKG-006", student_id: "STU-002", trial_class_id: "TRC-001", status: "CONFIRMED", registered_at: "2026-09-24T10:00:00+08:00" },
];

export const parents = [
  { id: "PAR-001", first_name: "ALICE", last_name: "LEE", email: "alice@example.com", password_hash: null, residential_id: "RES123", role: "admin" },
  { id: "PAR-002", first_name: "BOB", last_name: "OLSEN", email: "bob@example.com", password_hash: null, residential_id: "RES456", role: "parent" },
  { id: "PAR-003", first_name: "CAROL", last_name: "NG", email: "carol@example.com", password_hash: null, residential_id: "RES789", role: "parent" },
];

export const students = [
  { id: "STU-001", parent_id: "PAR-001", first_name: "CHARLIE", last_name: "LEE", email: "charlie@example.com", grade: "P4", residential_id: "RES789" },
  { id: "STU-002", parent_id: "PAR-001", first_name: "DAISY", last_name: "LEE", email: "daisy@example.com", grade: "P2", residential_id: "RES321" },
  { id: "STU-003", parent_id: "PAR-002", first_name: "ETHAN", last_name: "OLSEN", email: "ethan@example.com", grade: "P5", residential_id: "RES654" },
  { id: "STU-004", parent_id: "PAR-003", first_name: "FIONA", last_name: "NG", email: "fiona@example.com", grade: "P3", residential_id: "RES987" },
];

export const paymentAttempts = [
  { id: "ATTEMPT001-20260928", booking_id: "BKG-005", status: "FAILED", txn_id: "TXN-1" },
  { id: "ATTEMPT002-20260924", booking_id: "BKG-006", status: "SUCCESS", txn_id: "TXN-2" },
];

export function seedTables(): SeedTables {
  return {
    trial_classes: trialClasses,
    bookings,
    parents,
    students,
    payment_attempts: paymentAttempts,
  };
}

/** Nested payload accepted by `CreateBookingSchema` (uses FMT_CLASS_ID). */
export function validCreateBooking(overrides: Record<string, unknown> = {}) {
  return {
    trial_class_id: FMT_CLASS_ID,
    parent: {
      first_name: "alice",
      last_name: "lee",
      email: "ALICE@Example.com",
      phone: "+65 9123 4567",
    },
    student: {
      first_name: "charlie",
      last_name: "lee",
      grade: 4,
    },
    ...overrides,
  } as any;
}

/** Flat payload as sent by `src/app/bookings/[classId]/page.tsx:68-77`. */
export function flatUiCreateBooking() {
  return {
    parent_first_name: "ALICE",
    parent_last_name: "LEE",
    parent_email: "alice@example.com",
    parent_residential_id: "RES123",
    student_first_name: "CHARLIE",
    student_last_name: "LEE",
    student_residential_id: "RES789",
    trial_class_id: "TRC-001",
  };
}

export function jsonRequest(
  url: string,
  body: unknown,
  method = "POST"
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
