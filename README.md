# OTTODOT_Trial_Booking_System
OTTODOT Trial Booking System (Minimal Slice)

Overview
This project implements the smallest working slice of a trial booking system for Ottodot’s live online science and math classes. It focuses on trial bookings only (not regular enrollment) and ensures correctness under critical edge cases: duplicate bookings, overbooking, payment failures, and the last seat race condition.

Approach
We chose a hybrid design:
•	Supabase RPC (stored procedure): enforces correctness at the database level (duplicate prevention, seat limits, race conditions).
•	Next.js API route: wraps the RPC call, adds error handling, and maps results into TypeScript enums for developer clarity.
•	Frontend/UI: displays booking status, but never enforces correctness (all invariants live in the backend/database).

Why this approach?
•	Correctness first: database constraints are the strongest guardrails.
•	Developer ergonomics: TypeScript enums make statuses explicit and safe.
•	Speed: Supabase RPC integrates directly with Next.js, minimizing boilerplate.
Tradeoffs
•	Pessimistic row locking (FOR UPDATE) ensures correctness but can reduce concurrency under heavy load.
•	Business logic in SQL: harder to iterate quickly, but guarantees atomicity.
•	Scope control: deliberately cut polished UI and regular enrollment features to focus on backend correctness.

Backend Design
Data Model / Schema
•	parents: id, first_name, last_name, residential_id, email, registered_at
•	students: id, parent_id, first_name, last_name, residential_id, registered_at
•	trial_classes: id, class_name, subject, start_time, max_seats, created_at
•	bookings: id, student_id, trial_class_id, status, registered_at
•	payment_attempts: id, booking_id, status, txn_id, created_at

Booking Statuses
•	PENDING_PAYMENT → booking created, awaiting payment
•	CONFIRMED → payment success + seat available
•	PAYMENT_FAILED → payment failed OR seat unavailable
•	CANCELLED → admin cancels
•	DUPLICATE_BOOKING → prevented by unique constraint
•	NO_SEATS_AVAILABLE → last seat already taken

Key API Endpoints
•	POST /bookings → create booking (PENDING_PAYMENT)
•	POST /api/payments/confirm → confirm booking after payment (calls Supabase RPC)
•	GET /roster/:class_id → list confirmed students

Supabase RPC Stored Procedure
•	confirm_trial_booking(booking_id, payment_result)
o	Locks booking and trial_class rows.
o	Checks duplicates.
o	Counts confirmed seats.
o	Updates booking status accordingly.
o	Guarantees correctness under race conditions.

Next.js API Route
ts
// pages/api/payments/confirm.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";
import { BookingStatus } from "@/types/booking";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { bookingId, paymentResult } = req.body;

  const { data, error } = await supabase.rpc("confirm_trial_booking", {
    p_booking_id: bookingId,
    p_payment_result: paymentResult.toUpperCase(),
  });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ status: data as BookingStatus });
}
TypeScript Enums
ts
export enum BookingStatus {
  PendingPayment = "PENDING_PAYMENT",
  Confirmed = "CONFIRMED",
  PaymentFailed = "PAYMENT_FAILED",
  Cancelled = "CANCELLED",
  DuplicateBooking = "DUPLICATE_BOOKING",
  NoSeatsAvailable = "NO_SEATS_AVAILABLE"
}

Edge Case Handling
•	Duplicate booking → prevented by unique constraint + RPC check.
•	Overbooking → prevented by seat count check inside locked transaction.
•	Payment failure → booking marked PAYMENT_FAILED, excluded from roster.
•	Last seat race →
o	User B commits first → seat taken.
o	User A’s transaction sees no seats left → marks PAYMENT_FAILED.
o	At most one confirmed booking is possible.

Responsibility Split
•	UI: show available seats, guide parent through booking flow.
•	Backend (Next.js API): orchestrates RPC calls, maps statuses, handles errors.
•	Database (Supabase/Postgres): enforces invariants with constraints + stored procedure.
•	Background jobs: cleanup stale PENDING_PAYMENT, reconcile payment attempts.

Seed Data
•	Class A: 0 confirmed students → available.
•	Class B: 3 confirmed students → one seat left.
•	Duplicate booking attempt: same student + same class.
•	Payment failure case: booking marked PAYMENT_FAILED.

Verification Steps
1.	Create booking (PENDING_PAYMENT).
2.	Simulate payment success → booking confirmed if seat available.
3.	Simulate payment failure → booking marked PAYMENT_FAILED.
4.	Run two parallel transactions for last seat → only one confirmed, other fails.
5.	Query roster → shows only confirmed students.

Next Steps
•	Integrate real payment gateway (Stripe, Xendit, etc.).
•	Add admin dashboard for roster management.
•	Add monitoring (seat counts, payment errors, duplicate attempts).
•	Expand test coverage with concurrency simulations.

