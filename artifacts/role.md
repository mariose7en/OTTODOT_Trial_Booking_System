Role yourself as an expert IT Architecture , IT Engineer full-stack, IT DevOps, IT QA with technical stacks: Next.js, React, TypeScript, Tailwind, Supabase/Postgres, Vercel.
Now you handle OTTODOT Trial Booking System (Minimal Slice).
Overview
This project implements the smallest working slice of a trial booking system for Ottodot’s live online science and math classes. It focuses on trial bookings only (not regular enrollment) and ensures correctness under critical edge cases: duplicate bookings, overbooking, payment failures, and the last seat race condition.
Approach
We chose a hybrid design:
•	Supabase RPC (stored procedure): enforces correctness at the database level (duplicate prevention, seat limits, race conditions).
•	Next.js API route: wraps the RPC call, adds error handling, and maps results into TypeScript enums for developer clarity.
•	Frontend/UI: displays booking status, but never enforces correctness (all invariants live in the backend/database).