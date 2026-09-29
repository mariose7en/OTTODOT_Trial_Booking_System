# OTTODOT Trial Booking System — Booking Flow & Last-Seat Race Test Plan

| | |
|---|---|
| Document | `artifacts/booking_testing.md` |
| Scope | (1) Book a trial class end-to-end, (2) concurrency/race for the last seat of a trial class |
| Status | **Executed — L1/L2/L3/L6 green (80 pass / 47 todo / 0 fail); 125/125 case rows dispositioned (73 ✅ / 52 ⛔ E2); all gates green incl. coverage (§10.2). Narrative summary: **§0** · checked-box roll-up: **§10.8** |
| Supersedes | nothing; companion to `artifacts/login_register_testing.md` (run 1, executed) |
| Related | `artifacts/fix_plan_sept_26.md` (findings B1–B24, L1–L15, D-B05…D-B27), `artifacts/payment_mockup.md` (**payment mockup plan — turns the 63 payment-related rows below into runnable, Stripe-free cases**), `artifacts/seed.sql`, `artifacts/api.md`, `artifacts/login_register_testing.md` |
| Convention | Existing behaviour is pinned with **`[BUG-ASSERT]`** so the suite stays green while defects are open; the *desired* assertion is stated next to it as **Target** and is written as `test.todo()` / `skip` until the fix lands (same convention as run 1). |
| Severity | S1 blocker (money / overbooking / data integrity), S2 critical path broken, S3 major, S4 minor |

---

## 0. Summary — done vs not yet (state of this plan on 2026-09-29)

**Done**
- Plan executed end-to-end for every runnable level: **L1 / L2 / L3 / L6 = 127 tests, 80 pass / 47 `todo` / 0 fail**; all **125 case rows dispositioned — 73 ✅ executed · 52 ⛔ blocked (E2)**, none unaccounted; deviations D-v1…D-v10 all dispositioned.
- Every `[BUG-ASSERT]` pin carries a matching `test.todo` Target and a `fix_plan` row; §2.6 findings filed as **D-B05…D-B08, D-B20…D-B24**, plus **D-B25 / D-B27** found by the same-day route suites → `fix_plan_sept_26.md` §15.
- Companion fix_plan **F8 truth slice** (3 windows): doc-truth pass (`README`, `api.md`, `test.md`, `complete_plan`, `4hour_results`, `todo_sprint_core`), vacuous `BookingStatusDialog` assertion removed + unknown-status fallback added, **14 new suites / 143 tests** (`lib/errors`, `lib/email`, 7 components, `paymentsHistory`, `paymentsStripe`, `notifications`, `adminStudents`, `emailTemplates`) and the **L12** seed-drift pins (the suite now reads `artifacts/seed.sql`).
- **`artifacts/payment_mockup.md` M0–M3 executed (2026-09-29, later windows)** — PayMock landed: shared contracts/price/id modules, `PAYMENT_PROVIDER=mock|stripe` (lazy stripe, **B16** closed), all five payment routes on `createErrorResponse` (**B3/B4/B8-payment**), `confirmBooking()` single writer replacing the webhook `UPDATE` (**L2**), attempt ledger mandatory (**D-B07**), refund against the real `pi_…` with a `REFUNDED` ledger row (**L4/D9**), `rethrowIfDatabaseError` (**D-B25/D-B27**), plus a dev-only control plane (`/api/mock/payments/{plan,emit,reset,state}`, D10). Payment pins flipped with the fixes: UT-008/009, API-019/022/023/026/027/028, UI-015/016, NFR-008 (half), the `paymentsStripe` L2/L4 pins, `types/booking` + UT-011 (`REFUNDED`).
- Gates green after it: `npx tsc --noEmit` exit 0 · `npx next lint` 0 errors · `npx jest --ci` **43 suites / 492 pass / 67 todo / 559 total** · `npx next build` exit 0 (the four `/api/mock/payments/*` routes are in the route table) · coverage **89.56 % stmt / 79.08 % branch / 92.28 % fn / 90.92 % line → all four ≥ 70 %, `jest --coverage` exits 0** (was 88.46 / 80.76 / 89.72 / 89.36 after F8).

**Not yet**
- **L4 / L5 / L7 + the race harness** — **E2 blocker** (no database URL, no browser stack). §6.3/§6.5 design and the `TRC-RACE` fixture SQL are ready; `booking_race_harness.ts` itself was never written, which keeps the §9 exit criterion unchecked.
- Reproduce **D-B05 / D-B06 / D-B20** (need a DB) — cases BK-DB-008/009/010 and BK-RC-004/005/016/021 are already written.
- Flip the remaining **67 `test.todo` targets** into real assertions — blocked on fix sprints **F0–F8** (`fix_plan_sept_26.md` §11). Done so far: **B3, B4, L2, D-B07, D-B25, D-B27** flipped with their fixes; **B8** only half (payment/booking-core routes — `notifications` and the client-side union remain); the price row (UI-013/014) waits on F1/D4.
- Replace the tautological `src/__tests__/api/concurrency.test.ts` with the L4/L5 suites (F7).
- **F8 a11y block**: dialog semantics / focus trap / Escape, `htmlFor`/`id`, `role="alert"`, `scope="col"`, `role="progressbar"`, aria-labels, and contrast (needs design sign-off).
- Remaining doc stragglers (fix_plan §7 "Documentation corrections") and **§11 sign-off** (signatures still empty).

Checked-box version of the same roll-up: **§10.8**.

## 1. Objective and scope

### 1.1 Objective
Provide a reproducible, mostly-automated proof of two things:

1. **Booking a trial class** — the full user journey (browse → class detail → 3-step form → create booking → mock payment → confirmation) behaves correctly, or fails in a *known, pinned* way.
2. **The last-seat race** — when a trial class has exactly one seat left, N concurrent actors (payment confirmations, booking creations, Stripe webhook deliveries) can never produce more `CONFIRMED` bookings than `max_seats`, never charge/confirm the same student twice, and never destroy an already-confirmed booking.

### 1.2 In scope
- `src/app/bookings/page.tsx`, `src/app/bookings/[classId]/page.tsx`, `src/app/bookings/[classId]/payment/page.tsx`, `src/app/bookings/[classId]/confirmation/page.tsx`
- `BookingForm`, `MockPaymentForm`, `BookingConfirmation`, `BookingStatusDialog`, `TrialClassCard`
- `POST/GET /api/bookings`, `GET /api/bookings/[id]`, `GET /api/trial-classes`, `POST /api/payments/confirm`, `POST /api/payments/webhook`, `POST /api/payments/create-intent`
- DB layer: `bookings`, `trial_classes`, `students`, `parents`, partial unique index, `confirm_trial_booking()` RPC
- Race design: RPC-level, HTTP-level, webhook-level, direct PostgREST-level

### 1.3 Out of scope (covered elsewhere)
- Auth/login/register → `login_register_testing.md` (run 1)
- Admin pages, roster (B6/B11/B12), refunds, notifications, reminders
- Real Stripe/real Supabase-hosted env → **E2 blocked** (no credentials in this environment), §4.1

---

## 2. Baseline behaviour (measured, not assumed)

### 2.1 Happy path as built
| Step | Code | Behaviour |
|---|---|---|
| 1. Browse | `src/app/bookings/page.tsx:13-60` | `GET /api/trial-classes` → renders `TrialClassCard` grid; loading / empty / error+`Try Again` states |
| 2. Class detail | `src/app/bookings/[classId]/page.tsx:39-61` | Fetches the **whole list** and `.find(c => c.id === classId)`; not found → `Class not found` + Back to Classes |
| 3. Form | `BookingForm.tsx:6-50` | 3 steps: Parent Information → Student Information → Review & Confirm. Fields: `parent_first_name/last_name/email/residential_id`, `student_first_name/last_name/residential_id`. **No phone, no grade.** Every keystroke upper-cased (`:33-35`) |
| 4. Create | `bookings/[classId]/page.tsx:63-100` | `POST /api/bookings` with **flat** `CreateBookingRequest` keys + `trial_class_id` |
| 5. Server create | `src/app/api/bookings/route.ts:73-181` | zod parse → load class (404) → find-or-create parent (`generateSmartId(initials, phone)`, `:22-25,:91`) → find-or-create student (`:117-124`) → seat check counting **only `CONFIRMED`** (`:143-153`) → insert `PENDING_PAYMENT` (`:155-169`) → `{booking_id, status}` |
| 6. Payment | `page.tsx:102-132` + `MockPaymentForm.tsx:24` | `POST /api/payments/confirm` with `{booking_id, payment_result: "SUCCESS" \| "FAILED"}`, amount shown as `FREE`, card fields read-only, `Simulate payment failure` checkbox |
| 7. Confirm | `payments/confirm/route.ts:28-107` | zod parse → load booking → require `PENDING_PAYMENT` else **409 with a string `error`** (`:45-53`) → insert `payment_attempts` (`:55-69`, insert errors only logged) → `rpc("confirm_trial_booking", {p_payment_result: value.toUpperCase()})` (`:71-74`) → map attempt status → respond `data.status = <RPC return code>` (`:97-103`) |
| 8. Confirmation | `page.tsx:212-237`, `confirmation/page.tsx:37-44` | `BookingConfirmation` + `BookingStatusDialog`; separate confirmation page re-fetches `GET /api/bookings/${bookingId}` |

### 2.2 Seat model
- `trial_classes.max_seats INT DEFAULT 4` (`seed.sql:84`); seats are **derived**, never stored: `max_seats - COUNT(bookings WHERE status='CONFIRMED')`.
- `PENDING_PAYMENT` holds **no** seat (`route.ts:147`, `trial-classes/route.ts:27-39`).
- The only integrity guards in the DB are: `status` CHECK (`seed.sql:99-100`) and the partial unique index `idx_uniq_confirmed_booking ON bookings(student_id, trial_class_id) WHERE status='CONFIRMED'` (`seed.sql:106-108`). **There is no constraint that `COUNT(CONFIRMED) ≤ max_seats`** → overbooking is impossible to prevent by the DB alone; everything rides on the RPC and the route.
- No RLS / no policies anywhere in `seed.sql` → with the public anon key a client can `POST /rest/v1/bookings {status:"CONFIRMED"}` directly (**D-B20**, §2.6).

### 2.3 `confirm_trial_booking()` semantics (`seed.sql:241-303`)
Order: `FOR UPDATE` booking row → `FOR UPDATE` class row → duplicate check (`student_id + trial_class_id + CONFIRMED`, **no `id <> p_booking_id` guard**) → `COUNT(CONFIRMED)` → branch.

| Input / state | Stored status | Returned code |
|---|---|---|
| `SUCCESS`, `count < max` | `CONFIRMED` | `'CONFIRMED'` |
| `SUCCESS`, `count >= max` | `PAYMENT_FAILED` | `'NO_SEATS_AVAILABLE'` |
| `DUPLICATE_BOOKING` exists (other row) | this row → `PAYMENT_FAILED` | `'DUPLICATE_BOOKING'` |
| `SUCCESS` but row **already** `CONFIRMED` (self-match) | this row → **`PAYMENT_FAILED`** | `'DUPLICATE_BOOKING'` → **D-B05** |
| `p_booking_id` not found | nothing updated (0 rows) | `'CONFIRMED'` → **D-B06** |
| anything ≠ `'SUCCESS'` (incl. `FAILURE`) | `PAYMENT_FAILED` | `'PAYMENT_FAILED'` |

Return codes are **not** statuses: they may not be stored, and `payments/confirm` returns them as `data.status` (`confirm/route.ts:101`) — the dialog (`BookingStatusDialog.tsx:54-66`) has keys for `DUPLICATE_BOOKING`/`NO_SEATS_AVAILABLE` but the row will read `PAYMENT_FAILED` (**fix_plan L5**).

### 2.4 ID schemes (all collision-prone, none retried)
| Generator | Code | Format | Risk |
|---|---|---|---|
| Booking | `bookings/route.ts:27-33` | `BOOKING<000-999>-<YYYYMMDD>` | 1000 values/day, `Math.random()`, insert at `:155-169` with **no retry** → same-day PK collision → 500 (**D-B08**; ≈50% chance of ≥1 collision at ~38 bookings/day) |
| Payment attempt | `payments/confirm/route.ts:16-22` (via helpers) | `ATTEMPT<000-999>-<date>` | same, but collision only logged (`:67-69`) → **silent lost attempt row** (**D-B07**) |
| Parent/Student | `bookings/route.ts:22-25` | `<INITIALS>-<phone or grade>-<YYYYMMDD>` | phone leaked into PK (fix_plan L11); 1 date granularity |

### 2.5 Seed fixtures (`seed.sql:329-346`)
| Class | Seats | Bookings | `seats_remaining` | Use |
|---|---|---|---|---|
| `TRC-001` MATH OCT 1 | 4 | `BKG-005` PAYMENT_FAILED, `BKG-006` CONFIRMED | 3 | normal create/payment |
| **`TRC-002` SCIENCE OCT 2** | 4 | `BKG-001..003` CONFIRMED, `BKG-004` PENDING | **1** | **the last-seat fixture** |
| `TRC-003` MATH OCT 8 | 4 | — | 4 | empty class, display cases |
| `TRC-004` MATH OCT 10 | 4 | — | 4 | fixture source for race class |
| Parents `PAR-001..003`, students `STU-001..004` (`grade` = `'P4'`,`'P2'`,`'P5'`,`'P3'` — **TEXT**, and `grade`/`email` are never written by the API) | | | | duplicate/wrong-child cases |

### 2.6 Defect inventory known before execution

**From `fix_plan_sept_26.md` (authoritative, do not re-derive):**
B1 flat-vs-nested payload (P0) · B2 form lacks phone+grade (P0) · B3 `SUCCESS`/`FAILED` vs `success`/`failure` (P0) · B4 `z.string().uuid()` on `BOOKING001-…` ids (P0) · B5 class-id regex rejects `TRC-001` (P0) · B8 error **object** rendered as React child (P0) · B11 `select("*")` no joins → admin crash · B12 cancel route missing · B14 confirmation page dead · B15 payment page passes `classId` as `booking_id` · B20 seat-count `error` unchecked → guard bypassed (P2) · L1 student lookup keyed by `residential_id = grade` → wrong-child/duplicate students · L2 webhook writes `CONFIRMED` directly, bypassing the RPC · L3 creation TOCTOU, `PENDING` reserves nothing · L5 RPC return code cast to `BookingStatus` · L9 `seats_remaining` unclamped + N+1 · L11 phone stored as residential id · §6 enum drift (`DUPLICATE_BOOKING`/`NO_SEATS_AVAILABLE` stored nowhere, `REFUNDED` missing, `COMPLETED` accepted) · §7 `concurrency.test.ts` is tautological.

**New while drafting this plan (candidate findings — confirm on execution, then file into `fix_plan_sept_26.md`):**

| ID | Sev | Location | Defect |
|---|---|---|---|
| **D-B05** | S1 | `seed.sql:266-278` | Duplicate check has no `id <> p_booking_id` → confirming an already-`CONFIRMED` booking (double-submit, retry, second worker of a race) **flips it back to `PAYMENT_FAILED`** and returns `DUPLICATE_BOOKING`. A paid customer loses their seat. |
| **D-B06** | S2 | `seed.sql:253-301` | Unknown `p_booking_id` → `FOR UPDATE` matches 0 rows, `v_class_id`/`v_max_seats` stay NULL, `COUNT` over `trial_class_id = NULL` = 0 → `0 < NULL` is NULL → branch falls through to `ELSE`/`NO_SEATS_AVAILABLE` (for `SUCCESS`) or `PAYMENT_FAILED`, **0 rows updated, yet the API reports a business outcome as if a row changed**. Assert exact branch + "no success response" in BK-DB-009. |
| **D-B07** | S2 | `confirm/route.ts:55-69` | `payment_attempts` is written *before* the RPC and its insert failure is only `console.error` → attempt rows can be silently missing/duplicated; the attempt id has a 1000/day space. |
| **D-B08** | S2 | `bookings/route.ts:27-33,:155-169` | Random 3-digit booking id, no retry → PK collision → 500 under concurrency. |
| **D-B20** | S1 | `artifacts/seed.sql` (absent) | **No RLS, no policies** → anon-key client can insert `CONFIRMED` rows straight into `bookings`, bypassing the seat guard and the RPC entirely. |
| D-B21 | S3 | `bookings/route.ts:143-153` | Only `CONFIRMED` counts at creation; `PENDING_PAYMENT` rows are invisible → N pending rows can all be created for the last seat (fix_plan L3, restated as a race case). |
| D-B22 | S3 | `trial-classes/route.ts:24-40` | `?available=true` filters `seats_remaining > 0` only — full-but-pending / past classes still advertised; count errors unchecked (B20); N+1. |
| **D-B23** *(found on execution)* | S3 | `src/app/bookings/page.tsx:13-34` | `fetchTrialClasses` never clears `error` on success and the render ternary prefers `error` → after one failed load, **"Try Again" fetches successfully but the error card stays forever**. Pinned by BK-UI-002. |

---

## 3. Approach

| Level | ID prefix | What runs | Fidelity | Runtime |
|---|---|---|---|---|
| L1 Unit (schema/util) | `BK-UT-###` | zod schemas, id generators, error mapping | exact for pure logic | < 3 s |
| L2 Component (RTL) | `BK-UI-###` | rendered pages/forms with `fetch` mocked, `fireEvent` (no `user-event` in repo) | UI contract | < 10 s |
| L3 API integration | `BK-API-###` | route handlers invoked directly with `@/lib/supabase` mocked | request/response + call contract | < 15 s |
| L4 DB / RPC | `BK-DB-###` | real Postgres + `seed.sql`, `confirm_trial_booking()` called via `psql`/`pg` | **true** data layer | ~20 s |
| L5 Race / concurrency | `BK-RC-###` | L4 harness with N parallel actors, invariant oracle | **true** race | < 60 s total |
| L6 Non-functional | `BK-NFR-###` | N+1, payload size, clamp, latency | mixed | < 10 s |
| L7 Manual E2E | `BK-E2E-###` | browser walkthrough | full stack | ~20 min |

Techniques: schema-driven tables, boundary values, error-path injection (mocked `supabase` returning `error`), state-transition matrix, **invariant-based concurrency testing** (§6, not example-based), traceability to `fix_plan_sept_26.md`, mutation-style checks (assert that removing the RPC guard *would* fail the oracle — only in the harness dry-run mode).

Rules of engagement:
- Every `[BUG-ASSERT]` case has a matching `test.todo()` carrying the **Target** assertion, tagged `[FIX: <fix_plan row or D-Bxx>]`.
- A case may only be flipped from pinned → target when the corresponding fix exists; flips are logged in §10.6.
- Any deviation from this plan is logged as `D-v<n>` in §10.5 (convention from run 1).

---

## 4. Environment, fixtures, mock contract, commands

### 4.1 Levels and availability
| Level | Where | Status now |
|---|---|---|
| L1, L2, L3 | local `npm test` (jest + jsdom, supabase mocked) | ✅ runnable |
| L4, L5 | Postgres (docker) with `artifacts/seed.sql` | ⛔ **E2 blocked** — no Supabase/Postgres credentials in this environment; harness + fixtures are prepared in §6.4/§6.5 for one-shot execution later |
| L6 | jest + measured queries | ✅ runnable |
| L7 | real browser against local `next dev` | ⛔ manual, blocked by same missing DB |

### 4.2 Mock contract (L2/L3)
`jest.mock("@/lib/supabase", ...)` exposing `from()` as a chainable builder and `rpc()` as a jest fn. Chain contract used by the code under test:

```ts
// bookings POST: from("trial_classes").select().eq().single()
//               from("parents").select().eq().single()  | .insert()
//               from("students").select().eq().eq().single() | .insert()
//               from("bookings").select("id",{count:"exact",head:true}).eq().eq()  -> {count, error}
//               from("bookings").insert().select().single()
// payments/confirm: from("bookings").select().eq().single()
//                   from("payment_attempts").insert() / .update().eq()
//                   rpc("confirm_trial_booking", {p_booking_id, p_payment_result}) -> {data, error}
```
Failure injection = make the builder resolve `{count: null, error: {...}}` (B20) or `{data: null, error: {...}}` (L5).

### 4.3 Commands
```bash
npx tsc --noEmit                      # gate 1
npx next lint                         # gate 2
npx jest --ci                         # gate 3 (L1-L3, L6)
npx jest booking                      # booking-tagged subset
npm run build                         # gate 4 (needs placeholder env, see login plan §14.1)
# L4/L5 (blocked until a DB URL exists):
npm i -D pg
DATABASE_URL=postgres://... npx tsx artifacts/booking_race_harness.ts --scenario RC-A --n 10
```

### 4.4 Fixture rules
- L4/L5 always start from a **reset** of the race fixture (§6.5) and end with the same reset (BK-RC-020), so seed state (`TRC-002` = 3 confirmed + 1 pending) is reproducible.
- L3 uses in-memory mocks only — never `POST /api/seed` in tests (destructive, unauthenticated — fix_plan).
- Data builders: `mkClass({max_seats})`, `mkStudent({grade})`, `mkBooking({status})` in `src/__tests__/helpers/bookingFixtures.ts` (to be created with the suites).

---

## 5. Test cases

Columns: **Exp** = expected behaviour *now* (`[BUG-ASSERT]` = pinned defect) and **Target** = desired once fixed · **Trace** = `fix_plan_sept_26.md` row or `D-Bxx` · **Status** filled in §10.

### 5.1 L1 — Unit / schema (`BK-UT-001`…`016`) — runnable

| ID | Scenario | Exp (current → target) | Sev | Trace | Status |
|---|---|---|---|---|---|
| BK-UT-001 | `CreateBookingSchema` with nested payload + seed-style class id `MT-M-20261001T1000-4` | pass → same | S4 | — |✅ executed |
| BK-UT-002 | schema given the **flat** payload the UI actually sends | fails on `parent`/`student` missing → **accept a flat form or adapt the client** | S1 | B1 |✅ executed |
| BK-UT-003 | payload missing `parent.phone` / `student.grade` | fails → form supplies them (B2) | S1 | B2 |✅ executed |
| BK-UT-004 | `trial_class_id = "TRC-001"` (every id produced by `seed.sql`) | **[BUG-ASSERT]** rejected by regex → regex matches the real id space | S1 | B5 |✅ executed |
| BK-UT-005 | normalisation: `" alice "`/`"Alice"` → names upper, email lower+trim | as coded (`validations/booking.ts:13-30`) → unchanged | S4 | — |✅ executed |
| BK-UT-006 | phone `"0912 345-678"`, `"+65 9123 4567"` ok; `"abc"`/too short fail | as coded → unchanged | S4 | — |✅ executed |
| BK-UT-007 | grade boundary `0 / 1 / 6 / 7 / 3.5` | int 1–6 only → unchanged | S3 | B2 |✅ executed |
| BK-UT-008 | `ConfirmPaymentSchema.payment_result = "SUCCESS"` | **Target (passes since 2026-09-29):** `ConfirmPaymentSchema` accepts the value the RPC and the UI both use (`"SUCCESS"`/`"FAILED"`, normalised to canonical casing) | S1 | B3 |✅ executed (**flip** M4) |
| BK-UT-009 | `booking_id = "BOOKING001-20260928"` | **Target (passes since 2026-09-29):** booking-id grammar matches generated ids (`BOOKING001-20260928`, `BKG-001`, uuid) | S1 | B4 |✅ executed (**flip** M4) |
| BK-UT-010 | `BookingQuerySchema` `?trial_class_id=TRC-001`, `?status=COMPLETED` | **[BUG-ASSERT]** class filter 400; `COMPLETED` accepted though un-storable → both fixed together | S3 | B5, §6 |✅ executed |
| BK-UT-011 | `BookingStatus` enum membership | **[BUG-ASSERT]** contains `DUPLICATE_BOOKING`/`NO_SEATS_AVAILABLE`, omits `REFUNDED` → equals DB CHECK set (5) | S2 | §6 |✅ executed |
| BK-UT-012 | `TrialClassQuerySchema` `available=true/false/absent` | truthiness transform → unchanged | S4 | — |✅ executed |
| BK-UT-013 | `generateBookingId()` format ×200 samples | `/^BOOKING\d{3}-\d{8}$/` → same + unique-per-day guarantee | S3 | D-B08 |✅ executed (D-v1, L3 file) |
| BK-UT-014 | 1000 ids in one day, count duplicates | **[BUG-ASSERT]** duplicates almost certain (1000-value space, no retry) → collision-free (sequence/uuid) | S2 | D-B08 |✅ executed (D-v1, L3 file) |
| BK-UT-015 | `generateSmartId("AL","+65 1234")` | contains raw phone → hashed/derived id, no PII in PK | S3 | L11 |✅ executed (D-v1, L3 file) |
| BK-UT-016 | error mapping: `ZodError`→400+fields, `ConflictError`→409 `CONFLICT`, `NotFoundError`→404, `DatabaseError`→500, `createErrorResponse` envelope `{success:false,error:{code,message,statusCode,fields}}` | as coded → unchanged (this envelope is the contract every UI test asserts against) | S4 | B8 |✅ executed (D-v10) |

### 5.2 L2 — Component / RTL (`BK-UI-001`…`020`) — runnable

| ID | Scenario | Exp (current → target) | Sev | Trace | Status |
|---|---|---|---|---|---|
| BK-UI-001 | `/bookings` with mocked list (2 classes) → cards rendered | grid + names rendered → same | S4 | — |✅ executed (D-v6) |
| BK-UI-002 | loading / empty / error states of `/bookings` (+ `Try Again` re-fetch) | all three render → same | S3 | — |✅ executed (D-v4) |
| BK-UI-003 | seats badge on `TrialClassCard` (`seats_remaining`, `0` = full) | `max - confirmed` shown → same but sourced from a single clamped util | S3 | L9 |✅ executed |
| BK-UI-004 | `/bookings/TRC-001` class detail (name, subject, date, time) | rendered from list lookup → same | S4 | — |✅ executed (D-v5) |
| BK-UI-005 | unknown `classId` | `Class not found` + Back link → same | S3 | — |✅ executed |
| BK-UI-006 | `GET /api/trial-classes` rejects | error card, `error` rendered → **must not crash** | S2 | B8 |✅ executed |
| BK-UI-007 | BookingForm step 1 gate (empty → Continue disabled; all 4 fields → next) | `isStep1Valid` (`BookingForm.tsx:37-41`) → same | S4 | — |✅ executed |
| BK-UI-008 | step 2 gate (3 student fields), step 3 review shows entered values | as coded (`:43-46`, `:217-236`) → same | S4 | — |✅ executed |
| BK-UI-009 | typing `alice@x.com` into email renders `ALICE@X.COM` | **[BUG-ASSERT]** upper-cased (`:33-35`) → email typed verbatim (server lowercases anyway) | S4 | — |✅ executed |
| BK-UI-010 | form field inventory | **[BUG-ASSERT]** 7 fields, no phone/grade → collects exactly what `CreateBookingSchema` requires | S1 | B2 |✅ executed |
| BK-UI-011 | inspect `fetch` body on submit | **[BUG-ASSERT]** flat keys `{parent_first_name,…,trial_class_id}` → nested `{parent:{…},student:{…}}` | S1 | B1 |✅ executed |
| BK-UI-012 | API returns 400 `{success:false,error:{…}}` (object) | **[BUG-ASSERT]** `setError(object)` → React child = object → error boundary crash → renders a message | S1 | B8 |✅ executed |
| BK-UI-013 | API 200 `{booking_id,status:"PENDING_PAYMENT"}` | step → `payment`, `MockPaymentForm` mounted with `amount="FREE"` → same | S4 | — |✅ executed |
| BK-UI-014 | MockPaymentForm content | readonly `4242…`/`12/28`/`123`, failure checkbox, button `Pay FREE` → same (or real Stripe) | S4 | — |✅ executed |
| BK-UI-015 | click Pay (success path) inspect confirm body | **Target (passes since 2026-09-29):** confirm body `payment_result:"SUCCESS"` accepted by `ConfirmPaymentSchema` | S1 | B3 |✅ executed (**flip** M4) |
| BK-UI-016 | failure checkbox → confirm body | **Target (passes since 2026-09-29):** `"FAILED"` accepted by the widened `ConfirmPaymentSchema` | S1 | B3 |✅ executed (**flip** M4) |
| BK-UI-017 | confirm 200 with `status:"CONFIRMED"` | step → `confirmation`, `BookingStatusDialog` open with CONFIRMED content (`:114`) → same | S4 | — |✅ executed |
| BK-UI-018 | dialog mapping for `NO_SEATS_AVAILABLE` / `DUPLICATE_BOOKING` / `PAYMENT_FAILED` | keys exist (`:40-66`) but API returns codes while rows store statuses → dialog text and subsequent GET agree | S2 | L5 |✅ executed |
| BK-UI-019 | confirm **409** with *string* error | a **uniform object envelope** is now returned by confirm (matching the API changes in M3); client-side envelope rendering is pending F1 [B8] — the test still verifies the string-render path works without crashing, which is a half‑pin from before the API change | S3 | B8 |✅ executed |
| BK-UI-020 | confirmation page + payment page | **[BUG-ASSERT]** confirmation fetches `/api/bookings/{id}` (400 per B4) and reads `students`/`trial_classes` never returned; payment page sends `{booking_id: classId}` → both work off a booking-aware API | S1 | B4, B14, B15 |✅ executed (split 020a/020b) |

### 5.3 L3 — API integration (`BK-API-001`…`032`) — runnable, supabase mocked

| ID | Scenario | Exp (current → target) | Sev | Trace | Status |
|---|---|---|---|---|---|
| BK-API-001 | `POST /api/bookings` valid nested payload, class has seats | 201/200 `{success:true,data:{booking_id,status:"PENDING_PAYMENT"}}` → same | S4 | — |✅ executed |
| BK-API-002 | flat UI payload | **[BUG-ASSERT]** 400 `VALIDATION_ERROR`, `fields` = `parent.*`,`student.*` → 200 | S1 | B1 |✅ executed |
| BK-API-003 | missing `trial_class_id` | 400 with `fields.trial_class_id` → same | S4 | — |✅ executed |
| BK-API-004 | well-formed but unknown class id | 404 `NOT_FOUND` → same | S4 | — |✅ executed |
| BK-API-005 | `trial_class_id="TRC-001"` (seed id) | **[BUG-ASSERT]** 400 regex → 404/200 as appropriate | S1 | B5 |✅ executed |
| BK-API-006 | class with `confirmedCount = 0`, `max_seats = 4` | 200 + `PENDING_PAYMENT` row → same | S4 | — |✅ executed |
| BK-API-007 | class full (`count == max`) | 409 `CONFLICT` `"No seats available for this class"` (`route.ts:151-153`) → same | S4 | — |✅ executed |
| BK-API-008 | count query returns `{count:null, error:{…}}` | **[BUG-ASSERT]** `seatsRemaining = max - 0` → seat guard **not** applied, booking created → 500, guard still enforced downstream | S1 | B20 |✅ executed |
| BK-API-009 | parent email already exists | reuses existing parent id → same | S4 | — |✅ executed |
| BK-API-010 | new parent | id = `XX-<phone>-<date>` (phone in PK), `residential_id = phone` → id without PII, res-id from payload | S3 | L11 |✅ executed |
| BK-API-011 | student lookup (seed: grade `'P4'`, res-ids `RES789`…) | **[BUG-ASSERT]** `.eq("residential_id", grade.toString())` never matches → a **new student row per booking**, `grade`/`email` never stored → lookup by real res-id / (parent, grade) with grade column written | S1 | L1 |✅ executed |
| BK-API-012 | second child, same grade, same parent | **[BUG-ASSERT]** attaches to the first child's `student_id` → separate students, correct child on the booking | S1 | L1 |✅ executed |
| BK-API-013 | forced PK collision on `bookings.id` (mock insert error `duplicate key`) | **[BUG-ASSERT]** 500 `DATABASE_ERROR` (no retry, `route.ts:167-169`) → retry with new id, 200 | S2 | D-B08 |✅ executed |
| BK-API-014 | `GET /api/bookings` (no filter) | 200, raw rows `select("*")`, no joins → rows carry joined `parent`/`trial_class` for admin consumers | S3 | B11 |✅ executed |
| BK-API-015 | `GET ?status=CONFIRMED` / `?status=PAYMENT_FAILED` | filtered by `eq` → same | S4 | — |✅ executed |
| BK-API-016 | `GET ?status=COMPLETED` | **[BUG-ASSERT]** accepted by schema, matches nothing → removed from schema or implemented | S4 | §6 |✅ executed |
| BK-API-017 | `GET ?trial_class_id=TRC-001` | **[BUG-ASSERT]** 400 (regex) → 200 filtered | S3 | B5 |✅ executed |
| BK-API-018 | `GET ?parent_email=a@b.c` | **[BUG-ASSERT]** validated then ignored → filter applied | S4 | — |✅ executed (D-v8 → D-B24) |
| BK-API-019 | `GET /api/bookings/BOOKING001-20260928` | **Target (passes since 2026-09-29):** `GET /api/bookings/BOOKING001-20260928` → 200 with the booking; malformed id → 400; unknown → 404 by real-id grammar | S1 | B4 |✅ executed (**flip** M4) |
| BK-API-020 | `GET /api/bookings/<random uuid>` | 404 `NOT_FOUND` → same | S4 | — |✅ executed |
| BK-API-021 | `POST /api/payments/confirm` valid (uuid id, lowercase `success`) | 200 `{booking_id, status: <RPC code>}`; rpc called with `p_payment_result:"SUCCESS"`; attempt INITIATED→SUCCESS → status equals the **stored** status | S2 | L5 |✅ executed (split 021b) |
| BK-API-022 | confirm with `payment_result:"SUCCESS"` (what the UI sends) | **Target (passes since 2026-09-29):** confirm with `payment_result:"SUCCESS"` → 200 and booking status becomes CONFIRMED | S1 | B3 |✅ executed (**flip** M4) |
| BK-API-023 | booking not `PENDING_PAYMENT` | **Target (passes since 2026-09-29):** 409 with **object envelope** + `CONFLICT` code, e.g. `{success:false, error:{code:"CONFLICT", message:…, statusCode:409}}` | S3 | B8 |✅ executed (**flip** M4) |
| BK-API-024 | unknown booking id (uuid-shaped) | 404 → same; **and** RPC must never be reached with an unknown id (D-B06) | S2 | D-B06 |✅ executed |
| BK-API-025 | `rpc()` returns `{data:null, error}` | attempt marked FAILED, 500 `DATABASE_ERROR` → same | S4 | L5 |✅ executed |
| BK-API-026 | `payment_attempts` insert fails | **Target (passes since 2026-09-29):** attempt insert failure → 500 `DATABASE_ERROR`; the flow aborts; RPC never reached (D-B07 target fixed) | S3 | D-B07 |✅ executed (**flip** M4) |
| BK-API-027 | `POST /api/payments/webhook` `payment_intent.succeeded` | **Target (passes since 2026-09-29):** webhook succeeded routes through seat-capacity RPC, no direct `UPDATE`, CONFIRMED status set by RPC (L2 target) | S1 | L2 |✅ executed (**flip** M4) |
| BK-API-028 | webhook delivers `payment_failed` **after** `succeeded` | **Target (passes since 2026-09-29):** out-of-order `payment_failed` after succeeded → 200 `{ignored:true, reason:"already_confirmed"}`, `CONFIRMED` preserved (L2 target) | S1 | L2 |✅ executed (**flip** M4) |
| BK-API-029 | `GET /api/trial-classes` seats | `confirmed_count`/`seats_remaining` from `CONFIRMED` only; count errors unchecked → errors surface, values clamped ≥ 0, no N+1 | S3 | L9, B20, D-B22 |✅ executed (split 029b/029c) |

| BK-API-030 | `POST /api/payments/refund` with CONFIRMED booking + pi_ intent | **Target (passes since 2026-09-29):** refund succeeds → 200 with refund details; booking status becomes REFUNDED; payment_attempt status becomes REFUNDED; provider called with payment_intent and metadata; ledger row updated to REFUNDED (single SUCCESS row, never duplicated) | S2 | L5 |✅ executed (**flip** M4) |
| BK-API-031 | `POST /api/payments/refund` with non-CONFIRMED booking | **Target (passes since 2026-09-29):** refund of non-CONFIRMED booking → 400 `BOOKING_ERROR` envelope; provider refund method not called; booking status unchanged | S3 | L5 |✅ executed (**flip** M4) |
| BK-API-032 | `POST /api/payments/refund` idempotency (second refund after first) | **Target (passes since 2026-09-29):** second refund after REFUNDED → 400 `BOOKING_ERROR` envelope; provider refund method called exactly once; ledger shows single REFUNDED attempt row; booking status updated once | S3 | L5 |✅ executed (**flip** M4) |
### 5.4 L4 — DB / RPC (`BK-DB-001`…`014`) — blocked on DB, harness ready

| ID | Scenario | Exp (current → target) | Sev | Trace | Status |
|---|---|---|---|---|---|
| BK-DB-001 | `bookings.status` CHECK set | exactly `PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, CANCELLED, REFUNDED` → unchanged (this is the canonical set for §6 enum drift) | S4 | §6 |⛔ blocked (E2) |
| BK-DB-002 | partial unique index exists | `idx_uniq_confirmed_booking` present on `(student_id, trial_class_id) WHERE status='CONFIRMED'` → unchanged | S4 | — |⛔ blocked (E2) |
| BK-DB-003 | SQL-level insert of a 5th `CONFIRMED` row on a `max_seats=4` class | **[BUG-ASSERT]** succeeds (no constraint) → a `CHECK`/trigger or app-only guard with a documented test proving RPC is the sole writer | S1 | §2.2 |⛔ blocked (E2) |
| BK-DB-004 | RPC on pending row, seats available, `SUCCESS` | row `CONFIRMED`, returns `'CONFIRMED'` → unchanged | S4 | — |⛔ blocked (E2) |
| BK-DB-005 | RPC on pending row, class full, `SUCCESS` | row `PAYMENT_FAILED`, returns `'NO_SEATS_AVAILABLE'` → unchanged | S4 | — |⛔ blocked (E2) |
| BK-DB-006 | RPC with `FAILURE` | row `PAYMENT_FAILED`, returns `'PAYMENT_FAILED'` → unchanged | S4 | — |⛔ blocked (E2) |
| BK-DB-007 | RPC, another row already `CONFIRMED` for same student+class | returns `'DUPLICATE_BOOKING'`, **this** row → `PAYMENT_FAILED` → unchanged (plus: a `payment_attempts`/refund reason is persisted) | S3 | L5 |⛔ blocked (E2) |
| BK-DB-008 | RPC on a booking **already** `CONFIRMED` (same id) | **[BUG-ASSERT]** returns `'DUPLICATE_BOOKING'` **and flips the row to `PAYMENT_FAILED`** → idempotent: returns `'CONFIRMED'`, row untouched | S1 | **D-B05** |⛔ blocked (E2) |
| BK-DB-009 | RPC with unknown `p_booking_id` | **[BUG-ASSERT]** 0 rows updated yet a non-null code returned → `'NOT_FOUND'` and no success response | S2 | **D-B06** |⛔ blocked (E2) |
| BK-DB-010 | RPC with `p_payment_result = 'foo'` / `NULL` | falls into the `ELSE` → `PAYMENT_FAILED` → input validated, or explicitly documented | S4 | D-B06 |⛔ blocked (E2) |
| BK-DB-011 | locking behaviour | `FOR UPDATE` on booking row (`:257`) and class row (`:264`) → verified by concurrent run (BK-RC-001/002), not by source reading alone | S1 | §6 |⛔ blocked (E2) |
| BK-DB-012 | RPC leaves `payment_attempts` untouched | attempts only change via the route → unchanged (documented boundary) | S4 | D-B07 |⛔ blocked (E2) |
| BK-DB-013 | FK cascade | deleting a class removes its bookings; deleting a student removes bookings → unchanged | S4 | — |⛔ blocked (E2) |
| BK-DB-014 | seed fixture oracle | after `seed.sql`: `TRC-002` has 3 `CONFIRMED` + 1 `PENDING`, `seats_remaining = 1` → unchanged (every race case depends on this) | S4 | §2.5 |⛔ blocked (E2) |

### 5.5 L5 — Race / last seat (`BK-RC-001`…`024`) — core, blocked on DB

All cases assert the invariants of §6.1 via the harness oracle, not single examples.

| ID | Scenario (actor path × N × seat state) | Exp (current → target) | Sev | Trace | Status |
|---|---|---|---|---|---|
| BK-RC-001 | **RPC** ×2 workers, 1 seat left, distinct students | exactly 1 `'CONFIRMED'`, 1 `'NO_SEATS_AVAILABLE'`; final `COUNT(CONFIRMED)=4=max` → same | S1 | §6.1 |⛔ blocked (E2) |
| BK-RC-002 | **RPC** ×10 workers, 1 seat left, distinct students | exactly one winner; I1, I2, I6 hold → same | S1 | §6.1 |⛔ blocked (E2) |
| BK-RC-003 | **RPC** ×10, class already full (0 seats) | 0 `'CONFIRMED'`, all rows `PAYMENT_FAILED` → same | S1 | — |⛔ blocked (E2) |
| BK-RC-004 | **RPC** ×2 on the **same booking id** (double submit) | **[BUG-ASSERT]** 1×`CONFIRMED` then row ends `PAYMENT_FAILED` (**D-B05**) → winner keeps `CONFIRMED`, loser gets `DUPLICATE_BOOKING` **without touching the winner's row** | S1 | **D-B05** |⛔ blocked (E2) |
| BK-RC-005 | **RPC** sequential retry ×5 after a successful confirm | **[BUG-ASSERT]** 2nd call destroys the seat (**D-B05**) → idempotent, row stays `CONFIRMED` | S1 | **D-B05** |⛔ blocked (E2) |
| BK-RC-006 | **RPC** ×10 mixed intent (5 `SUCCESS`, 5 `FAILURE`), 1 seat | number of `'CONFIRMED'` returns == final confirmed delta ∈ {0,1}; I1 holds → same | S1 | — |⛔ blocked (E2) |
| BK-RC-007 | **HTTP create** ×10 parallel, distinct emails, 1 seat left | **[BUG-ASSERT]** all 10 accepted as `PENDING_PAYMENT` (pending holds no seat) → ≤1 accepted once seats are spoken for | S1 | L3, D-B21 |⛔ blocked (E2) |
| BK-RC-008 | **HTTP create** ×10 parallel while `count` reads `3/4` (TOCTOU) | **[BUG-ASSERT]** all pass the `seatsRemaining<=0` check (read-then-write) → at most 1 create succeeds for the last seat | S1 | L3 |⛔ blocked (E2) |
| BK-RC-009 | **HTTP confirm** ×10 parallel (uuid-shaped ids) | **[BUG-ASSERT]** every call 400 (B4) → the HTTP confirm path is reachable, and the RPC serializes it | S1 | B4, B3 |⛔ blocked (E2) |
| BK-RC-010 | **Webhook** ×10 parallel `succeeded` for distinct students on a 1-seat class | **[BUG-ASSERT]** direct `UPDATE` → up to 10 `CONFIRMED`, `I1` violated → webhook uses the RPC; oracle passes | S1 | L2 |⛔ blocked (E2) |
| BK-RC-011 | **Storm**: 10 creates → 10 confirms → 5 webhooks, then oracle | current: any of I1/I5/I6 may fail → all invariants hold, failures logged per path | S1 | L2/L3 |⛔ blocked (E2) |
| BK-RC-012 | 300 parallel `POST /api/bookings` (mocked DB, distinct data) | **[BUG-ASSERT]** duplicate `BOOKING###` ids → ≥1 500 `DATABASE_ERROR` → 0 collisions, all 200 | S2 | D-B08 |⛔ blocked (E2) |
| BK-RC-013 | after any race: `GET /api/trial-classes` vs `SELECT count(*)` | displayed `seats_remaining` == `max - COUNT(CONFIRMED)`, never negative, never > max → same, clamped | S3 | L9 |⛔ blocked (E2) |
| BK-RC-014 | 4 `PENDING` on a 4-seat class, then confirm all 4 in parallel | all 4 can succeed (I1 holds) but the list advertised 4 free seats the whole time → display accounts for pending (or pending is time-boxed/expired) | S3 | D-B21 |⛔ blocked (E2) |
| BK-RC-015 | same student+class: 2 creates → 2 confirms in parallel | 1 `CONFIRMED`, 1 `'DUPLICATE_BOOKING'`; **but** both saw a payment form first → duplicate create prevented up front | S2 | L3 |⛔ blocked (E2) |
| BK-RC-016 | `TRC-002` last seat, **10 sequential** confirm calls on one pending row | first wins, calls 2..10 hit D-B05 and **downgrade the confirmed row** → idempotent from call 2 onward | S1 | **D-B05** |⛔ blocked (E2) |
| BK-RC-017 | set row `CANCELLED`, then RPC `SUCCESS` | **[BUG-ASSERT]** not caught by duplicate check → row becomes `CONFIRMED` (cancelled booking resurrected) → non-`PENDING` rows rejected by the RPC | S2 | D-B05-adjacent |⛔ blocked (E2) |
| BK-RC-018 | oracle self-check: run harness in `--dry-run` with the class-row lock removed | oracle **must fail** (proves I1 is not vacuous) → keep as a harness unit test | S2 | §6.3 |⛔ blocked (E2) |
| BK-RC-019 | wall time of ×20 RPC race | completes < 5 s, no deadlock/timeout → same | S3 | — |⛔ blocked (E2) |
| BK-RC-020 | fixture reset before/after every race case | `TRC-RACE` restored to 3 confirmed + 1 pending → same | S4 | §6.5 |⛔ blocked (E2) |
| BK-RC-021 | **Direct PostgREST** insert `POST /rest/v1/bookings {status:"CONFIRMED"}` with anon key | **[BUG-ASSERT]** succeeds (no RLS) → rejected (RLS/policies), seat guard cannot be bypassed | S1 | **D-B20** |⛔ blocked (E2) |
| BK-RC-022 | concurrent class deletion during a confirm race | RPC behaves per D-B06 (documented) → clean `NOT_FOUND`, no phantom `CONFIRMED` | S3 | D-B06 |⛔ blocked (E2) |
| BK-RC-023 | webhook `succeeded` racing an HTTP confirm for the same booking | both attempt the transition → exactly one `CONFIRMED`, no `CONFIRMED → PAYMENT_FAILED` clobber | S1 | L2, D-B05 |⛔ blocked (E2) |
| BK-RC-024 | after the storm: `payment_attempts` rows vs bookings | every `SUCCESS` attempt maps to a `CONFIRMED` booking; no attempt rows for unknown bookings; attempt ids unique → same | S2 | D-B07 |⛔ blocked (E2) |

### 5.6 L6 — Non-functional (`BK-NFR-001`…`008`) — runnable (mocked) / partial

| ID | Scenario | Exp → Target | Sev | Trace | Status |
|---|---|---|---|---|---|
| BK-NFR-001 | `GET /api/trial-classes` with 50 classes | 1 + 50 count queries (N+1) → single aggregate query | S3 | L9 |✅ executed |
| BK-NFR-002 | class with `max_seats = 0` | **[BUG-ASSERT]** `seats_remaining = 0`, UI percent `NaN%` → 0 clamped, class hidden as full | S3 | L9 |✅ executed (D-v7) |
| BK-NFR-003 | overbooked class (confirmed > max via SQL) | `seats_remaining` negative, card progress >100% → clamped at 0 | S3 | L9 |✅ executed (+03b, D-v2) |
| BK-NFR-004 | `GET ?available=true` with a full class | excluded → also excludes past-dated classes | S4 | D-B22 |✅ executed |
| BK-NFR-005 | booking payload size (100-char names, long email) | zod max(100) enforced → same | S4 | — |✅ executed |
| BK-NFR-006 | `POST /api/bookings` latency (mocked, 100 sequential) | < 2 s total → same | S4 | — |✅ executed (50 runs, D-v3) |
| BK-NFR-007 | concurrent seat-count consistency read/write | reads never observe a torn count → same (single source of truth) | S3 | §2.2 |✅ executed |
| BK-NFR-008 | error envelope used by every booking endpoint | uniform `{success:false,error:{code,message,statusCode}}` incl. the 409 path | S3 | B8 |✅ executed |

### 5.7 L7 — Manual E2E (`BK-E2E-001`…`014`) — blocked (browser + DB)

| ID | Scenario | Pass criteria | Sev | Status |
|---|---|---|---|---|
| BK-E2E-001 | `/bookings` → click a class card → detail shows correct date/time | no console errors | S4 |⛔ blocked (E2) |
| BK-E2E-002 | 3-step form, review page shows entered data, submit | booking created (DB row `PENDING_PAYMENT`) or pinned defect shown | S2 |⛔ blocked (E2) |
| BK-E2E-003 | submit twice quickly (double click) | one booking row, no seat lost (**D-B05** guard) | S1 |⛔ blocked (E2) |
| BK-E2E-004 | mock payment success → dialog + confirmation page load | booking `CONFIRMED`, confirmation page shows real data | S2 |⛔ blocked (E2) |
| BK-E2E-005 | `Simulate payment failure` → dialog shows failure | row `PAYMENT_FAILED`, seat released | S3 |⛔ blocked (E2) |
| BK-E2E-006 | last seat: `TRC-002` has 1 seat; book & pay in 2 browsers | exactly one `CONFIRMED` | S1 |⛔ blocked (E2) |
| BK-E2E-007 | 2nd browser for a full class | blocked before payment with a clear message | S1 |⛔ blocked (E2) |
| BK-E2E-008 | `/bookings/TRC-001` list seat badge after confirming a seat | decrements live (refresh) | S3 |⛔ blocked (E2) |
| BK-E2E-009 | reload `/bookings/TRC-001/confirmation` | shows booking (today: dead, B14) | S2 |⛔ blocked (E2) |
| BK-E2E-010 | `/bookings/TRC-001/payment` | Stripe intent created with the **booking** id (today: classId, B15) | S2 |⛔ blocked (E2) |
| BK-E2E-011 | browser console + network during the whole journey | no 5xx, no unhandled React error | S2 |⛔ blocked (E2) |
| BK-E2E-012 | keyboard-only pass through the 3 steps + payment | focus order, no trap | S4 |⛔ blocked (E2) |
| BK-E2E-013 | Stripe webhook (`stripe trigger payment_intent.succeeded`) | booking `CONFIRMED` via RPC, invariants hold | S1 |⛔ blocked (E2) |
| BK-E2E-014 | mobile viewport 375 px on form/payment | no overflow | S4 |⛔ blocked (E2) |

---

## 6. Race test design (levels L4/L5)

### 6.1 Invariants (the oracle — every race case asserts a subset)

| # | Invariant | Asserted by |
|---|---|---|
| **I1** | `COUNT(bookings WHERE trial_class_id=C AND status='CONFIRMED') ≤ trial_classes.max_seats` for every class C, at every observation point | all `BK-RC-*` |
| **I2** | For a class with exactly 1 free seat and N distinct-student actors: exactly **one** actor observes `'CONFIRMED'`, all others observe a non-success code, and final confirmed delta == 1 | RC-001/002/006 |
| **I3** | At most one `CONFIRMED` row per `(student_id, trial_class_id)` | RC-015, all storms |
| **I4** | Stored statuses ∈ `seed.sql:99-100` CHECK set — RPC return codes (`DUPLICATE_BOOKING`, `NO_SEATS_AVAILABLE`) are **never persisted** | RC-*, BK-DB-001 |
| **I5** | A `CONFIRMED` row never transitions to `PAYMENT_FAILED` (except an explicit refund/cancel path) | RC-004/005/016/017/023 |
| **I6** | Displayed `seats_remaining == max - COUNT(CONFIRMED)`, clamped to `[0, max]` | RC-013, NFR-002/003 |
| **I7** | Creation never inserts a row for a class that is already full; pending rows are visible to the availability display (or are bounded in time/number) | RC-007/008/014 |
| **I8** | `confirm_trial_booking` is idempotent: repeated calls with the same `p_booking_id` do not change a `CONFIRMED` outcome | RC-004/005/016 |
| **I9** | Booking/payment-attempt ids are unique under N concurrent creates; no 500 caused by id generation | RC-012, UT-013/014 |
| **I10** | No path writes `bookings.status` except `confirm_trial_booking` + explicit cancel/refund (webhook must route through the RPC); the table is not writable by the anon role | RC-010/021/023 |

### 6.2 Actor matrix

| Path | Code | Protected today? | Race cases |
|---|---|---|---|
| A. RPC `confirm_trial_booking` | `seed.sql:241-303` | ✅ `FOR UPDATE` ×2, count, duplicate | RC-001…006, 016, 017 |
| B. HTTP `POST /api/payments/confirm` | `confirm/route.ts:28-107` | ❌ read-check-then-RPC (TOCTOU between `:35` and `:71`); **unreachable** for real ids (B4) | RC-009, 023, 024 |
| C. HTTP `POST /api/bookings` | `bookings/route.ts:73-181` | ❌ count-then-insert, pending not counted | RC-007, 008, 012, 014, 015 |
| D. Stripe webhook direct `UPDATE` | `webhook/route.ts` (fix_plan L2) | ❌ bypasses RPC entirely | RC-010, 011, 023 |
| E. Direct PostgREST with anon key | Supabase REST | ❌ no RLS (D-B20) | RC-021 |

### 6.3 Harness design (`artifacts/booking_race_harness.ts`, to be added with L4/L5)

- **Transport**: `pg` Pool (`max = N + 2`), each worker = one connection, `SELECT confirm_trial_booking($1,$2)` or one HTTP `fetch` (path B/C/D).
- **Start barrier**: to guarantee overlap rather than accidental serialization, each worker runs `SELECT pg_advisory_xact_lock(773); SELECT pg_sleep(0.05);` … on a shared lock id *before* the RPC call, releasing all workers within one round-trip. Wall-clock budget: barrier 50 ms + RPC ms → each scenario < 1 s; whole suite < 60 s (rule: no sleeps > 100 ms, no retry loops — a requirement from run 1 deviations).
- **Repeat**: each scenario runs `R = 3` times with fresh fixtures; a scenario passes only if all runs satisfy the invariants (flaky = fail, and logged `D-v…`).
- **Oracle** (after every run):
```sql
-- I1 + I6
SELECT tc.id, tc.max_seats,
       COUNT(b.id) FILTER (WHERE b.status='CONFIRMED') AS confirmed,
       tc.max_seats - COUNT(b.id) FILTER (WHERE b.status='CONFIRMED') AS remaining
FROM trial_classes tc LEFT JOIN bookings b ON b.trial_class_id = tc.id
GROUP BY tc.id;
-- I3
SELECT student_id, trial_class_id, COUNT(*) FROM bookings
WHERE status='CONFIRMED' GROUP BY 1,2 HAVING COUNT(*) > 1;
-- I4 (return codes leaked into storage)
SELECT * FROM bookings WHERE status IN ('DUPLICATE_BOOKING','NO_SEATS_AVAILABLE');
-- I5
SELECT * FROM bookings WHERE status='CONFIRMED' AND updated_at > '<run start>';
-- I9
SELECT id, COUNT(*) FROM bookings WHERE id LIKE 'BOOKING%' GROUP BY 1 HAVING COUNT(*)>1;
```
A harness run prints `INVARIANT I<n>: PASS|FAIL` plus the offending rows; §10.3 records the output.
- **Negative control (RC-018)**: `--dry-run` drops the `FOR UPDATE` on `trial_classes` inside a copy of the function and asserts I1 **fails** — proves the oracle can detect the bug it claims to detect.

### 6.4 Scenario → case map

| Scenario arg | Case(s) | N | Seat state | Actor path |
|---|---|---|---|---|
| `RC-A` | BK-RC-001 | 2 | 1 free | A |
| `RC-B` | BK-RC-002, 006 | 10 | 1 free | A |
| `RC-C` | BK-RC-003 | 10 | full | A |
| `RC-D` | BK-RC-004, 005, 016 | 2/5/10 | 1 free | A (same id) |
| `RC-G` | BK-RC-007, 008, 014, 015 | 10 | 1 free / 4 pending | C |
| `RC-I` | BK-RC-009 | 10 | 1 free | B |
| `RC-J` | BK-RC-010, 023 | 10 | 1 free | D |
| `RC-K` | BK-RC-011 | 10+10+5 | mixed | B+C+D |
| `RC-L` | BK-RC-012 | 300 | n/a | C (mocked) |
| `RC-X` | BK-RC-021 | 1 | n/a | E |

### 6.5 Fixture (`TRC-RACE`) to be created by the harness
```sql
-- reset (also the teardown, BK-RC-020)
DELETE FROM bookings WHERE trial_class_id IN ('TRC-RACE');
DELETE FROM trial_classes WHERE id = 'TRC-RACE';
DELETE FROM students  WHERE id LIKE 'RACE-STU-%';
DELETE FROM parents   WHERE id LIKE 'RACE-PAR-%';

INSERT INTO parents (id, first_name, last_name, email, residential_id) VALUES
  ('RACE-PAR-01','RACE','PARENT','race01@example.com','RESRACE01');
INSERT INTO students (id, parent_id, first_name, last_name, email, grade, residential_id) VALUES
  ('RACE-STU-01','RACE-PAR-01','R1','RACE','r1@example.com','4','RESRACE11'),
  ('RACE-STU-02','RACE-PAR-01','R2','RACE','r2@example.com','4','RESRACE12'),
  ('RACE-STU-03','RACE-PAR-01','R3','RACE','r3@example.com','5','RESRACE13'),
  ('RACE-STU-04','RACE-PAR-01','R4','RACE','r4@example.com','5','RESRACE14');
INSERT INTO trial_classes (id, class_id, class_name, subject, start_time, max_seats) VALUES
  ('TRC-RACE','CLS-001','RACE TRIAL','MATH', now() + interval '7 days', 4);
INSERT INTO bookings (id, student_id, trial_class_id, status) VALUES
  ('RACE-BKG-01','RACE-STU-01','TRC-RACE','CONFIRMED'),
  ('RACE-BKG-02','RACE-STU-02','TRC-RACE','CONFIRMED'),
  ('RACE-BKG-03','RACE-STU-03','TRC-RACE','CONFIRMED'),
  ('RACE-BKG-04','RACE-STU-04','TRC-RACE','PENDING_PAYMENT');  -- 1 seat left
```
Seed-state alternative without harness fixtures: race on `TRC-002` (§2.5) after restoring `BKG-001..004`.

---

## 7. Traceability

| fix_plan / finding | Cases |
|---|---|
| B1 flat payload | UT-002, UI-011, API-002 |
| B2 missing phone/grade | UT-003, UT-007, UI-010 |
| B3 payment_result case | UT-008, UI-015/016, API-022, RC-009 |
| B4 uuid on booking ids | UT-009, UI-020, API-019, RC-009 |
| B5 class-id regex | UT-004, UT-010, API-005, API-017 |
| B8 error object as child / string-object mix | UT-016, UI-012, UI-019, API-023, NFR-008 |
| B11 no joins | API-014 |
| B14/B15 confirmation & payment pages | UI-020, E2E-009/010 |
| B20 unchecked seat count | API-008, API-029 |
| L1 student identity | API-011, API-012 |
| L2 webhook bypass | API-027, API-028, RC-010, RC-011, RC-023, E2E-013 |
| L3 TOCTOU / pending holds nothing | RC-007, RC-008, RC-014, RC-015 |
| L5 RPC code vs stored status | UI-018, API-021 |
| L9 clamp + N+1 | UI-003, API-029, NFR-001…004, RC-013 |
| L11 phone in PK | UT-015, API-010 |
| §6 enum drift | UT-011, UT-016, API-016, DB-001, I4 |
| §7 tautological concurrency test | RC-018 + §8 replacement note |
| **D-B05** self-downgrade | DB-008, RC-004, RC-005, RC-016, RC-017, E2E-003 |
| **D-B06** phantom result | DB-009, DB-010, API-024, RC-022 |
| **D-B07** attempt bookkeeping | API-026, RC-024 |
| **D-B08** id collisions | UT-013, UT-014, API-013, RC-012 |
| **D-B20** no RLS | RC-021 |
| fix_plan §7 (replace mock `concurrency.test.ts`) | RC-001…003 supersede `src/__tests__/api/concurrency.test.ts:19-176`; that file is deleted or reduced to a mock-contract smoke test once L4/L5 run |

---

## 8. Schedule (Status filled in §10.4)

| # | Activity | Level | Effort | Depends on | Status |
|---|---|---|---|---|---|
| P0 | Test data builders + fixture module | L1–L3 | 1 h | — | ✅ `src/__tests__/helpers/{bookingSupabaseMock,bookingFixtures}.ts` |
| P1 | L1 schema/util suite (`BK-UT-*`) | L1 | 2 h | P0 | ✅ 14 pass / 8 todo |
| P2 | L3 API suite with supabase mock (`BK-API-*`) | L3 | 4 h | P0 | ✅ 36 pass / 22 todo (incl. UT-013/014/015, D-v1) |
| P3 | L2 component suite (`BK-UI-*`) | L2 | 4 h | P0 | ✅ 22 pass / 12 todo |
| P4 | L6 non-functional (`BK-NFR-*`) | L6 | 1 h | P2 | ✅ 8 pass / 5 todo |
| P5 | Harness + fixtures + oracle (`booking_race_harness.ts`) | L4/L5 | 4 h | DB URL (**blocked, E2**) | ⛔ blocked — design only (§6.3/§6.5), file not written |
| P6 | L4 RPC cases (`BK-DB-*`) | L4 | 2 h | P5 | ⛔ blocked (E2) |
| P7 | L5 race cases (`BK-RC-*`) ×3 repeats | L5 | 3 h | P5, P6 | ⛔ blocked (E2) |
| P8 | L7 manual E2E | L7 | 3 h | live stack (**blocked**) | ⛔ blocked (E2) |
| P9 | Run log, defect filing into `fix_plan_sept_26.md`, flips | all | 2 h | P1–P4 | ✅ §10 filled; **D-B05…D-B08, D-B20…D-B24** filed in `fix_plan_sept_26.md` §15 (plus route-level **D-B25/D-B27** from the F8 route suites, same section) |

P1–P4 are executable today; P5–P8 are prepared-but-blocked (§4.1).

---

## 9. Entry / exit criteria

### Entry
- [x] `npx tsc --noEmit`, `npx next lint`, `npx jest --ci` green at plan start (baseline recorded §10.1 — run 1 final: 22 suites / 241 pass / 8 todo)
- [x] Fixture module + builders merged (P0)
- [x] §6.5 fixture SQL reviewed (for P5+) — reviewed statically; no DB to apply it to
- [x] Decision recorded for §2.6 new findings: filed as defects (D-B05…D-B08, D-B20…D-B24, plus route-found D-B25/D-B27 → `fix_plan_sept_26.md` §15)
- [ ] (L4/L5 only) database URL + credentials available, `seed.sql` applied — **not available (E2), entry criterion waived for L4/L5/L7 only**

### Exit
- [x] L1 (BK-UT-001…016) executed, 100% executed-or-deferred — 14 pass / 8 todo / 0 fail
- [x] L2 (BK-UI-001…020) executed — 22 pass / 12 todo / 0 fail
- [x] L3 (BK-API-001…029) executed — 36 pass / 22 todo / 0 fail
- [x] L6 (BK-NFR-001…008) executed — 8 pass / 5 todo / 0 fail
- [ ] L4/L5 executed **or** explicitly waived as blocked with harness committed — ⛔ **waived as blocked (E2), but the harness file was NOT committed** (design only, §6.3/§6.5) → still open, see §10.7
- [x] Invariants I1–I10 evaluated at least once against a real database (or waived, E2) — ⚠ **waived (E2)**: I1–I10 restated as `test.todo` targets in L4/L5, never executed
- [x] Every `[BUG-ASSERT]` case has a matching `test.todo` Target and a defect row — 44 pins, 47 `test.todo` targets; two behaviour pins without fix_plan rows recorded as D-B24 (ignored `?parent_email`) and accepted S4 (UI-009 upper-casing)
- [x] All 12+ defects of §2.6 reproduced at least once and filed — §2.6 tracks 27 items: **22 reproduced + filed** (everything runnable at L1/L2/L3/L6, incl. D-B23 found during execution), **3 filed but not reproduced** (D-B05 / D-B06 / D-B20 — need a database, their L4/L5 case ids are ready), **2 not exercised by these levels** (B12 cancel route, §7 tautological test — owned by fix_plan F5/F7)
- [x] Zero unexplained deviations (§10.5 empty or all dispositioned) — D-v1…D-v10 all dispositioned
- [x] Gates green: tsc / lint / jest / build — §10.2
- [x] Coverage gate re-measured and now **met** — 35.58 % (run 1) → 65.35 % (booking suites) → 73.77 % (F8 doc suites) → **88.46 % stmt / 80.76 % branch / 89.72 % fn / 89.36 % line, `jest --coverage` exits 0** → D-v9 closed
- [x] Route-level follow-up: every §2.6 defect that a route suite can pin now has an automated `[BUG-ASSERT]` (`B18`, `B19`, `L4`, `L6`, `L7`, `L8`, `L12`, `L14`, `B4`, `B8`, `L2`) in `src/__tests__/api/*` + `src/__tests__/lib/{emailTemplates,seed-data}.test.ts`; two further defects found there (**D-B25**, **D-B27**) filed in fix_plan §15

---

## 10. Execution log

### 10.1 Environment and baseline
| Item | Value |
|---|---|
| Date executed | 2026-09-29 (single window: author → execute → log) |
| Toolchain | node v22.22.3 · npm 10.9.8 · jest 29 + `@swc/jest` · RTL `fireEvent` |
| jest config | `testEnvironment: "node"` global, `/** @jest-environment jsdom */` per UI file, `maxWorkers: 1` |
| Repo state | branch `master` @ `1b24d4d` + uncommitted work (Sep 28 auth/seed changes, Sep 29 booking suites + docs) |
| `seed.sql` applied? | **No** — no database URL in this environment (E2). DDL/RPC read statically; every DB-level assertion below is either mocked (L3/L6) or left as a `test.todo`/⛔ row (L4/L5). |
| Baseline at plan start (run 1 final) | tsc 0 errors · lint 0 errors / 4 warnings · jest **22 suites / 241 pass / 8 todo / 249 total** · coverage 35.58 % statements (D-v9 waived) |

### 10.2 Gates

| Gate | Command | Result | Notes |
|---|---|---|---|
| Types | `npx tsc --noEmit` | ✅ exit 0 | needed D-v10 (hand-built zod issue literal → real `safeParse({})` error) |
| Lint | `npx next lint` | ✅ 0 errors, 4 pre-existing warnings (`<img>` in `Logo.tsx` etc.) | |
| Unit/integration | `npx jest --ci` | ✅ **40 suites / 445 pass / 84 todo / 529 total** | baseline 22/249 → booking suites +127 tests (26/376 at that point) → F8 suites +156 tests (40/529 now) |
| Coverage | `npx jest --ci --coverage` | ✅ **88.46 %** stmt · 80.76 % branch · 89.72 % fn · 89.36 % line vs 70 % gate — **exit 0 (verified twice)** | Journey: 35.58 % (run 1) → 65.35 % (booking suites) → 73.77 / 65.65 / 82.58 / 73.83 (F8 doc suites) → current. **D-v9 closed 2026-09-29.** Caveat kept: `collectCoverageFrom` excludes `src/**/page.tsx` where the P0s live |
| Build | `npm run build` | ✅ green | placeholder env (`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`, `STRIPE_*`), same as run 1 |
| Race harness | `npx tsx artifacts/booking_race_harness.ts --all` | ⛔ E2 | file not written (P5 blocked), §6.3 design only |

### 10.3 Results by level

| Level | Designed | Tests run | Pass | `[BUG-ASSERT]` pins | `test.todo` Target | Failed (unexpected) |
|---|---|---|---|---|---|---|
| L1 `BK-UT` | 16 | 22 | 14 | 8 | 8 | 0 |
| L2 `BK-UI` | 20 | 34 | 22 | 11 | 12 | 0 |
| L3 `BK-API` | 32 | 61 * | 39 | 21 | 22 | 0 |
| L4 `BK-DB` | 14 | — | — | — | — | ⛔ E2 (blocked) |
| L5 `BK-RC` | 24 | — | — | — | — | ⛔ E2 (blocked) |
| L6 `BK-NFR` | 8 | 13 | 8 | 4 | 5 | 0 |
| L7 `BK-E2E` | 14 | — | — | — | — | ⛔ E2 (blocked) |
| **Total** | **128** | **130** | **83** | **40** | **47** | **0** |

\* L3 file also hosts L1 cases UT-013/014/015 (D-v1). Test count exceeds the designed case count because several designed cases were split into a pin (`[BUG-ASSERT]`) + a `Target` pair (e.g. UI-006 + its Target todo, API-029a/b/c, NFR-003/003b).

Files: `src/__tests__/booking/{bookingSchema,bookingApi,bookingUi,bookingNfr}.test.{ts,tsx}` + `src/__tests__/helpers/{bookingSupabaseMock,bookingFixtures}.ts`.

### 10.4 Schedule status

| # | Activity | Status | Actual |
|---|---|---|---|
| P0 | fixtures + mock | ✅ | 2 helper modules |
| P1 | L1 suite | ✅ | 22 tests, 14 pass / 8 todo |
| P2 | L3 suite | ✅ | 58 tests, 36 pass / 22 todo |
| P3 | L2 suite | ✅ | 34 tests, 22 pass / 12 todo |
| P4 | L6 suite | ✅ | 13 tests, 8 pass / 5 todo |
| P5 | race harness | ⛔ | not started — needs DB URL (E2) |
| P6 | L4 cases | ⛔ | not started — needs P5 |
| P7 | L5 cases | ⛔ | not started — needs P5+P6 |
| P8 | L7 manual | ⛔ | not started — needs live stack |
| P9 | log + filing | ✅ | this §10 + `fix_plan_sept_26.md` §15 |

### 10.5 Deviations

| ID | Case | What deviated | Why | Disposition |
|---|---|---|---|---|
| D-v1 | UT-013/014/015 | run inside `bookingApi.test.ts`, not `bookingSchema.test.ts` | `generateBookingId` / `generateSmartId` are module-private to the route handlers | accepted; count stays in L3 row |
| D-v2 | BK-NFR-003 | display half split into `BK-NFR-003b` in `bookingUi.test.tsx` | negative-seat rendering needs jsdom; NFR file is node env | accepted; counted as L2 |
| D-v3 | BK-NFR-006 | 100 → **50** sequential creates, `Math.random` stubbed | 100 real-random ids collide with p≈99 % (D-B08) → the case would fail on collisions, not on throughput | accepted; collisions pinned deterministically by UT-014/API-013 |
| D-v4 | BK-UI-002 | target assumption ("retry renders the list") flipped to `[BUG-ASSERT D-B23]` | `error` is never cleared on success → the retry test failed as designed | accepted; new defect filed (D-B23) |
| D-v5 | BK-UI-004 | time assertion relaxed to `/\d{1,2}:\d{2}/` | host TZ is UTC: a 10:00 SGT class renders 02:00; pinning local time would be environment-dependent | accepted |
| D-v6 | BK-UI-001 | asserts ≥ 2 links, not ≥ 3 | the fully-booked card correctly renders no link | accepted |
| D-v7 | BK-NFR-002 | the planned "UI percentage renders NaN" half dropped | neither `TrialClassCard` nor `getSeatStatus` renders a percentage → claim not reproducible | server-side 0-capacity assertion kept; NaN claim withdrawn |
| D-v8 | BK-API-018 | `?parent_email` pin filed as **D-B24** (no `fix_plan` row existed at plan time) | query param validated then silently ignored | accepted; filed `fix_plan_sept_26.md` §15 |
| D-v9 | coverage gate | threshold left at 70 % (was red) | pre-existing decision from run 1, not this plan's scope | carried over; coverage 35.58 → 65.35 % → **88.46 % with all four metrics ≥ 70 % on 2026-09-29 → D-v9 closed** |
| D-v10 | BK-UT-016 | hand-written zod issue literal rejected by the installed zod (`$ZodIssueInvalidType`) | issue shape is version-locked | replaced with `CreateBookingSchema.safeParse({})`; same assertion |

### 10.6 Defects reproduced / filed

| Defect | Reproduced by | Filed in | Fix commit | Cases pinning it (a case may pin 2 defects) |
|---|---|---|---|---|
| B1 flat payload | UT-002, UI-011, UI-012, API-002 | fix_plan §1 | — | 4 |
| B2 form lacks phone/grade | UT-003, UI-010 | fix_plan §1 | — | 2 |
| B3 `SUCCESS`/`FAILED` | UT-008, UI-015, UI-016, API-022 | fix_plan §1 | `payment_mockup.md` M1 · 2026-09-29 (D1) | 4 |
| B4 uuid on booking ids | UT-009, API-019 | fix_plan §1 | `payment_mockup.md` M1 · 2026-09-29 (D2) | 2 |
| B5 class-id regex | UT-004, UT-010, API-005, API-017 | fix_plan §1 | — | 4 |
| B8 error object as child | UT-016b, UI-006, UI-012, UI-019, UI-020a, API-023, NFR-008 | fix_plan §1 | **partial** `payment_mockup.md` M1 · 2026-09-29 (payment + booking-core routes; UI-019, API-023 flipped, NFR-008 half) — `notifications` validation/string envelopes, `ApiResponse` union + 10 pages still F1 | 7 |
| B11 no joins | API-014 | fix_plan §1 | — | 1 |
| B14 / B15 confirmation & payment pages | UI-020a / UI-020b | fix_plan §1 | — | 2 |
| B20 unchecked seat count | API-008, API-029c | fix_plan §1 | — | 2 |
| L1 student identity | API-011, API-012 | fix_plan §2 | — | 2 |
| L2 webhook bypass | API-027, API-028 | fix_plan §2 | `payment_mockup.md` M3 · 2026-09-29 (D7 `confirmBooking()`; Targets flipped) | 2 |
| L3 pending holds nothing | API-029 (+ D-B21) | fix_plan §2 | — | 1 |
| L5 RPC code vs stored status | API-021b | fix_plan §2 | — | 1 |
| L9 clamp + N+1 | API-029b, NFR-001, NFR-003, NFR-003b | fix_plan §2 | — | 4 |
| L11 phone in PK | API-010, UT-015 | fix_plan §2 | — | 2 |
| §6 enum drift | UT-010, UT-011, API-016 | fix_plan §6 | — | 3 |
| **D-B07** attempt bookkeeping | API-026 | fix_plan §15 **(new)** | `payment_mockup.md` M3 · 2026-09-29 (D8; Target flipped, 500 `DATABASE_ERROR`) | 1 |
| **D-B08** id collisions | UT-014, API-013 | fix_plan §15 **(new)** | — | 2 |
| **D-B21** pending invisible to seats/availability | API-029 | fix_plan §15 **(new, = L3)** | — | 1 |
| **D-B22** `?available` filter | NFR-004 | fix_plan §15 **(new)** | — | 1 |
| **D-B23** error never cleared on retry | UI-002 | fix_plan §15 **(new)** | — | 1 |
| **D-B24** `?parent_email` ignored | API-018 | fix_plan §15 **(new)** | — | 1 |
| **D-B05** RPC self-downgrade | ⛔ not reproduced (needs DB) → BK-DB-008, BK-RC-004/005/016 | fix_plan §15 **(new)** | — | 0 (target kept as todo) |
| **D-B06** phantom RPC result | ⛔ not reproduced (needs DB) → BK-DB-009/010 (HTTP guard covered by API-024) | fix_plan §15 **(new)** | — | 0 |
| **D-B20** no RLS | ⛔ not reproduced (needs DB) → BK-RC-021 | fix_plan §15 **(new)** | — | 0 |
| **D-B25** error objects → `INTERNAL_ERROR` | F8 route suites: `paymentsHistory.test.ts`, `adminStudents.test.ts` (not a booking case) | fix_plan §15 **(new)** | `payment_mockup.md` M1 · 2026-09-29 (`rethrowIfDatabaseError`) | 2 |
| **D-B27** DB failure reported as 404 | F8 route suites: `notifications.test.ts` (not a booking case) | fix_plan §15 **(new)** | `payment_mockup.md` M1 · 2026-09-29 (`rethrowIfDatabaseError`) | 1 |
| **L4 (payment defect — refund)** | `paymentsStripe.test.ts` refund pins (no booking case; `BK-API-030…032` still to be written) | fix_plan §2 | `payment_mockup.md` M3 · 2026-09-29 (D9: real `pi_…` from the SUCCESS attempt, ledger row → `REFUNDED`, never a second `SUCCESS`) | 0 booking cases |

Fixes landed so far: **B3, B4, L2, D-B07, D-B25, D-B27** (full) and **B8** (payment/booking-core routes only) — their `Target` todos flipped in the same commit as the fix. Every other row still has `—`, so its `Target` todo stays pending (flips happen per fix sprint F1–F7).

### 10.7 Open work
- **E2 blocker:** L4/L5/L7 + harness (P5–P8) need a database URL and a browser stack. Harness design, `TRC-RACE` fixture SQL and scenario args are specified in §6.4/§6.5; the harness **file itself is not committed** — that gap keeps the "waived with harness committed" exit criterion unchecked.
- Three filed defects (D-B05, D-B06, D-B20) are **unreproduced** until a DB exists; their cases are ready.
- Replace the tautological `src/__tests__/api/concurrency.test.ts` (fix_plan §7) with the L4/L5 suites when unblocked.
- §8.6 doc drift from run 1 — **largely closed 2026-09-29** (README, `test.md`, `api.md`, `complete_plan.md`, `4hour_results.md`, `todo_sprint_core.md` corrected; `setup.md` had no stale counts). Remaining stragglers are listed in fix_plan §7 "Documentation corrections".
- **Closed 2026-09-29:** coverage gate (88.46 / 80.76 / 89.72 / 89.36, exit 0 → D-v9 closed), the doc-drift bullet above, and every route/template/seed test gap listed in fix_plan §7.
- Full done/not-yet checklist: **§10.8**.

### 10.8 Status summary — done vs not yet

**Done (checked):**
- [x] Plan written, `TRC`-style fixtures + programmable supabase mock landed (`src/__tests__/helpers/`)
- [x] All four runnable levels executed — **L1 / L2 / L3 / L6 = 127 tests, 80 pass / 47 `todo` / 0 fail**
- [x] All **125** case rows dispositioned — **73 ✅ executed · 52 ⛔ blocked (E2)**, 0 unaccounted
- [x] Every `[BUG-ASSERT]` pin carries a matching `test.todo` Target and a fix_plan row
- [x] §2.6 defects reproduced and filed → `fix_plan_sept_26.md` §15 (D-B05…D-B08, D-B20…D-B27); deviations D-v1…D-v10 dispositioned
- [x] Gates green (as of the F8 run, since improved to **43 / 492 pass / 67 todo / 559** by the payment pass below): `tsc` ✅ · `next lint` ✅ 0 errors · `jest --ci` ✅ **40 suites / 445 pass / 84 todo / 529 total** · `npm run build` ✅ · coverage **88.46 / 80.76 / 89.72 / 89.36 → all four ≥ 70 %, exit 0** (D-v9 closed)
- [x] Route/template/seed test gaps from fix_plan §7 closed (`paymentsHistory`, `paymentsStripe`, `notifications`, `adminStudents`, `emailTemplates`, L12 drift pins) — same day as this plan
- [x] Doc truth pass: `README`, `api.md`, `test.md`, `complete_plan.md`, `4hour_results.md`, `todo_sprint_core.md`, this plan's §8/§9/§10
- [x] **`payment_mockup.md` M0–M3 (PayMock) landed** — 3 new suites (`lib/paymentsMock` 22, `api/paymentsMock` 18, `api/paymentsMock.race` 3) → **43 suites / 559 tests (492 pass / 67 todo / 0 fail)**; payment pins flipped with their fixes (B3, B4, L2, D-B07, D-B25, D-B27 + the paymentsStripe L2/L4 pins, `REFUNDED` enum); §10.6 "Fix commit" cells filled for those defects; `tsc` / `lint` / `jest` / `build` / coverage (89.56 / 79.08 / 92.28 / 90.92) all green

**Not yet (unchecked — blocked or owned by fix sprints):**
- [ ] **L4 / L5 / L7 + the race harness** (`booking_race_harness.ts`) — **E2 blocker**: no database URL / browser stack. §6.3/§6.5 design and the `TRC-RACE` fixture SQL are ready; the harness file itself is not committed (keeps the exit criterion at §9 unchecked)
- [ ] Reproduce **D-B05, D-B06, D-B20** (need a DB); their cases BK-DB-008/009/010, BK-RC-004/005/016/021 are written
- [ ] Flip the remaining `test.todo` Targets → real assertions (67 left): **B3, B4, L2, D-B07, D-B25, D-B27 already flipped** with their fixes, B8 is half-done; the rest wait on fix sprints **F0–F8** (`fix_plan_sept_26.md` §11)
- [ ] Replace the tautological `src/__tests__/api/concurrency.test.ts` with the L4/L5 suites (F7)
- [ ] **F8 a11y block**: dialog semantics/focus trap/Escape, `htmlFor`/`id`, `role="alert"`, `scope="col"`, `role="progressbar"`, aria-labels, and contrast (needs design sign-off)
- [ ] Remaining doc stragglers listed in fix_plan §7 "Documentation corrections"
- [ ] §11 sign-off (QA / dev owner / reviewer signatures still empty)

## 11. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| QA / test author | | | |
| Dev owner | | | |
| Reviewer | | | |

---
*Plan drafted from source inspection on 2026-09-29 and executed the same day (§10 filled, then re-verified after the F8 suites). Counts: 125 designed cases across 7 levels → 127 tests written for the 4 runnable levels (80 pass / 47 `todo` / 0 fail) · 52 cases left ⛔ E2 (L4/L5/L7) · repo suite total now **43 suites / 559 tests (492 pass / 67 todo)** after the `payment_mockup.md` M0–M3 pass. Gates: tsc ✅ · lint ✅ · jest ✅ 43/559 · build ✅ · coverage **89.56 % stmt / 79.08 % branch / 92.28 % fn / 90.92 % line — all four ≥ 70 %, exit 0**. Status checklist: §10.8.*
