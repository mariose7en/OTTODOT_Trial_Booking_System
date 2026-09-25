Deliverables for the 4‑Hour Cap
GitHub Repo (public)

Schema + seed.sql:
Parents, Students, Trial Classes, Bookings, Payment Attempts.
Smart IDs, uppercase consistency, timestamps, indexes.
Stored procedure confirm_trial_booking for correctness.

Next.js API route (pages/api/payments/confirm.ts):
Calls Supabase RPC.
Maps results into TypeScript enums.
Error handling included.

TypeScript enums (types/booking.ts):
BookingStatus and PaymentAttemptStatus.

README.md:
Approach (Supabase RPC + Next.js API route + TypeScript enums).
Backend design (schema, statuses, endpoints).
Edge‑case handling (duplicate, overbooking, payment failure, last‑seat race).
Tradeoffs and next steps.

Seed Data
Class A: 0 confirmed students.
Class B: 3 confirmed students (one seat left).
Duplicate booking attempt.
Payment failure case.

Notes on Next Steps (if time runs out)
Add Jest tests for concurrency simulation.
Add roster API (GET /roster/:class_id).
Add simple CLI or UI to demonstrate booking flow.
Integrate real payment gateway later.