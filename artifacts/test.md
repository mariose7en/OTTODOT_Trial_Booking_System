# OTTODOT Trial Booking System - Test & Verification Guide

## 1. Running Tests

### 1.1 Run All Tests

```bash
npm test
```

Expected output (measured 2026-09-29, after `payment_mockup.md` M0–M3):
```
Test Suites: 43 passed, 43 total
Tests:       559 total — 492 passed, 67 todo
```

The 67 `todo` cases are targets for open defects: today's behaviour is pinned with `[BUG-ASSERT]` and the desired
assertion is written as `test.todo` until the fix lands (`artifacts/booking_testing.md` §10). Seven of them were
flipped to real assertions in this pass (B3, B4, L2, D-B07, D-B25, D-B27, plus the paymentsStripe L2/L4 pins).

### 1.2 Run Tests in Watch Mode

```bash
npm run test:watch
```

Press `q` to quit watch mode.

### 1.3 Run Tests with Coverage

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory.

### 1.4 Run Specific Test File

```bash
# Run only utils tests
npx jest --testPathPattern="utils.test"

# Run only component tests
npx jest --testPathPattern="components"

# Run with verbose output
npx jest --verbose
```

---

## 2. Test Suites Overview

**Inventory — 43 suites / 559 tests (2026-09-29, after `payment_mockup.md` M0–M3):**

| Suite | Tests | Status | Guide |
|-------|-------|--------|-------|
| `types/booking.test.ts` | 4 | ✅ | §2.1 |
| `lib/utils.test.ts` | 14 | ✅ | §2.2 |
| `lib/seed-data.test.ts` | 23 | ✅ | §2.3 + L12 drift pins (2026-09-29) |
| `lib/errors.test.ts` | 15 | ✅ | error → status/envelope mapping (fix_plan §7) |
| `lib/email.test.ts` | 7 | ✅ | pins L6 timezone + L7 fake-success (fix_plan §7) |
| `lib/emailTemplates.test.ts` | 16 | ✅ | added 2026-09-29 — L8 escaping, L6 host-TZ, localhost links |
| `components/Button.test.tsx` | 7 | ✅ | §2.4 |
| `components/Card.test.tsx` | 3 | ✅ | §2.4 |
| `components/StatusBadge.test.tsx` | 8 | ✅ | §2.4 |
| `components/Logo.test.tsx` | 4 | ✅ | §2.4 |
| `components/TrialClassCard.test.tsx` | 7 | ✅ | §2.4 |
| `components/BookingForm.test.tsx` | 8 | ✅ | §2.4 |
| `components/BookingStatusDialog.test.tsx` | 14 | ✅ | §2.4 |
| `components/Header.test.tsx` | 5 | ✅ | §2.4 |
| `components/MockPaymentForm.test.tsx` | 8 | ✅ | §2.4 |
| `components/RosterTable.test.tsx` | 10 | ✅ | §2.4 |
| `components/BookingConfirmation.test.tsx` | 6 | ✅ | added 2026-09-29 (fix_plan §7) |
| `components/BookingStats.test.tsx` | 3 | ✅ | added 2026-09-29 (fix_plan §7) |
| `components/ErrorBoundary.test.tsx` | 6 | ✅ | added 2026-09-29 (fix_plan §7) |
| `components/Footer.test.tsx` | 5 | ✅ | added 2026-09-29 (fix_plan §7) |
| `components/RecentActivity.test.tsx` | 4 | ✅ | added 2026-09-29 (fix_plan §7) |
| `components/Skeleton.test.tsx` | 11 | ✅ | added 2026-09-29 (fix_plan §7) |
| `components/StripePaymentForm.test.tsx` | 9 | ✅ | added 2026-09-29 (fix_plan §7) |
| `api/routes.test.ts` | 6 | ✅ | export smoke only |
| `api/concurrency.test.ts` | 10 | ⚠ | **mock-based**, not a real race proof (fix_plan §7) |
| `api/paymentsHistory.test.ts` | 6 | ✅ | added 2026-09-29 — B18 + D-B25 pin (flipped) |
| `api/paymentsStripe.test.ts` | 22 | ✅ | Stripe-adapter contract (R11) — B4, L4, L2, B8 pins **flipped 2026-09-29** |
| `api/notifications.test.ts` | 27 | ✅ | added 2026-09-29 — L7, L6, B19, L14, D-B27 pin (flipped) + genuine-404 case |
| `api/adminStudents.test.ts` | 6 | ✅ | added 2026-09-29 — booking_count projection + caching gap |
| `lib/paymentsMock.test.ts` | 22 | ✅ | added 2026-09-29 — PayMock core (R2/R6/R9/R10, signatures, delivery modes, B16) |
| `api/paymentsMock.test.ts` | 18 | ✅ | added 2026-09-29 — mock-mode route integration (R1/R3/R4/R5/R8/R12, D10 guard) |
| `api/paymentsMock.race.test.ts` | 3 | ✅ | added 2026-09-29 — webhook storms (parallel / out-of-order / vs HTTP confirm) |
| `auth/seed-sql.test.ts` | 11 | ✅ | `login_register_testing.md` |
| `auth/signup.test.tsx` | 26 | ✅ | `login_register_testing.md` |
| `auth/login.test.tsx` | 28 | ✅ | `login_register_testing.md` |
| `auth/callback.test.ts` | 15 | ✅ | `login_register_testing.md` |
| `auth/middleware.test.ts` | 23 | ✅ | `login_register_testing.md` |
| `auth/auth-hooks.test.tsx` | 13 | ✅ | `login_register_testing.md` |
| `auth/header-auth.test.tsx` | 8 | ✅ | `login_register_testing.md` |
| `booking/bookingSchema.test.ts` | 20 | ✅ | `booking_testing.md` L1 (UT-008/009 flipped 2026-09-29) |
| `booking/bookingApi.test.ts` | 53 | ✅ | `booking_testing.md` L3 (API-019/022/023/026/027/028 flipped 2026-09-29) |
| `booking/bookingUi.test.tsx` | 32 | ✅ | `booking_testing.md` L2 (UI-015/016 flipped 2026-09-29) |
| `booking/bookingNfr.test.ts` | 13 | ✅ | `booking_testing.md` L6 |
| **Total** | **559** | **492 pass / 67 todo** | |

Subsections below describe the original unit/component suites; auth and booking have their own executed plans.

### 2.1 Type Tests (`src/__tests__/types/booking.test.ts`)

| Test | Description |
|------|-------------|
| BookingStatus enum values | Asserts the **TypeScript enum against itself** — it does **not** read `seed.sql` (fix_plan §7). The real mismatch (enum has `DUPLICATE_BOOKING`/`NO_SEATS_AVAILABLE`, omits DB's `REFUNDED`) is pinned by `BK-UT-011` in `booking_testing.md` |
| BookingStatus count | Ensures exactly 6 statuses (DB CHECK allows 5 — see above) |
| PaymentAttemptStatus values | Verifies 3 payment statuses |
| PaymentAttemptStatus count | Ensures exactly 3 statuses |

### 2.2 Utility Tests (`src/__tests__/lib/utils.test.ts`)

| Test | Description |
|------|-------------|
| isValidBookingStatus | True for valid strings, false for invalid |
| isValidPaymentAttemptStatus | True for INITIATED/SUCCESS/FAILED |
| mapPaymentResultToBookingStatus | SUCCESS → Confirmed, others → PaymentFailed |
| formatBookingResponse | Returns correct response object |
| getSeatsRemaining | Calculates remaining seats correctly |
| getSeatStatus | Returns full/limited/available based on seats |
| formatDate | Formats date string correctly |
| formatTime | Formats time string correctly |

### 2.3 Seed Data Tests (`src/__tests__/lib/seed-data.test.ts`)

| Test | Description |
|------|-------------|
| Parent count | 2 parents in seed data |
| Parent structure | Has id, name, email fields |
| Parent uppercase | Names are uppercase |
| Student count | 3 students |
| Student references | Valid parent_id references |
| Trial class count | 2 classes (MATH, SCIENCE) |
| Class subjects | MATH and SCIENCE present |
| Max seats | 4 seats per class |
| Booking count | 5 bookings |
| Booking statuses | 3 CONFIRMED, 1 PENDING, 1 FAILED |
| Duplicate attempt | CHARLIE has 2 bookings for SCIENCE |
| Payment attempt count | 1 failed payment attempt |

### 2.4 Component Tests

#### Button (`src/__tests__/components/Button.test.tsx`)

| Test | Description |
|------|-------------|
| Render with text | Button displays children |
| Primary variant | Default blue styling |
| Secondary variant | Gray styling |
| Danger variant | Red styling |
| Loading state | Disabled with spinner |
| Disabled state | Cannot be clicked |

#### Card (`src/__tests__/components/Card.test.tsx`)

| Test | Description |
|------|-------------|
| Render title | Displays title text |
| Render children | Displays content |
| Custom className | Applies custom styles |

#### StatusBadge (`src/__tests__/components/StatusBadge.test.tsx`)

| Test | Description |
|------|-------------|
| Confirmed status | Green badge |
| PendingPayment status | Yellow badge |
| PaymentFailed status | Red badge |
| Cancelled status | Gray badge |
| DuplicateBooking status | Orange badge |
| NoSeatsAvailable status | Red badge |
| Green styling | Confirmed has green bg |
| Yellow styling | Pending has yellow bg |

#### Logo (`src/__tests__/components/Logo.test.tsx`)

| Test | Description |
|------|-------------|
| Render image | Shows logo.webp |
| Show text | Displays "OTTODOT" by default |
| Hide text | Hidden when showText=false |
| Size classes | sm=8, md=12, lg=16 |

#### TrialClassCard (`src/__tests__/components/TrialClassCard.test.tsx`)

| Test | Description |
|------|-------------|
| Render class name | Shows "MATH TRIAL" |
| Render subject | Shows "MATH" badge |
| Render seats | Shows "2 seats available" |
| Book Now button | Visible when seats available |
| Fully Booked | Shows when no seats |
| 1 seat left | Shows for limited availability |
| Link to booking | Links to /bookings/[classId] |

---

## 3. Manual Verification Steps

### 3.1 API Endpoint Tests

#### Test Trial Classes API

```bash
curl http://localhost:3000/api/trial-classes | jq
```

Expected:
- 2 trial classes returned
- Each has `confirmed_count` and `seats_remaining`

#### Test Bookings API (List)

```bash
curl http://localhost:3000/api/bookings | jq
```

Expected:
- 5 bookings returned
- Various statuses (CONFIRMED, PENDING_PAYMENT, PAYMENT_FAILED)

#### Test Create Booking

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "trial_class_id": "MT-M-20261001T1000-4",
    "parent": {
      "first_name": "alice",
      "last_name": "parent",
      "email": "test@example.com",
      "phone": "+65 9123 4567"
    },
    "student": {
      "first_name": "charlie",
      "last_name": "student",
      "grade": 4
    }
  }' | jq
```

> The body is **nested** (`parent` / `student` objects, `phone` + `grade`) because that is what
> `CreateBookingSchema` accepts. The flat body the UI currently sends (and the flat body earlier versions of this
> guide documented) returns **400 VALIDATION_ERROR** — defect **B1**.
> `trial_class_id` must match `/^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$/`; seed ids like `TRC-001` are rejected — defect **B5**.

Expected (valid payload, class with free seats):
- `success: true`
- Returns `booking_id` and `status: "PENDING_PAYMENT"`

#### Test Payment Confirm

```bash
# First get a booking_id from the previous step, then:
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "YOUR_BOOKING_ID",
    "payment_result": "success"
  }' | jq
```

> `payment_result` must be lowercase `success` / `failure` (`ConfirmPaymentSchema`). The uppercase `SUCCESS` /
> `FAILED` values the UI actually sends are rejected with 400 — defect **B3**.
> `booking_id` must also be a UUID, while every id the app generates is `BOOKING###-YYYYMMDD` — defect **B4**, so a
> generated id still returns 400 today.

Expected (after B3/B4 are fixed):
- `success: true`
- `status: "CONFIRMED"`

#### Test Roster API

```bash
curl http://localhost:3000/api/roster/SC-S-20261002T1400-4 | jq
```

Expected:
- 3 confirmed students (CHARLIE, DAISY, ETHAN)
- `seats_remaining: 1`

### 3.2 Frontend Verification

#### Home Page

1. Visit [http://localhost:3000](http://localhost:3000)
2. Verify:
   - [ ] Ottodot logo displays
   - [ ] Navigation shows Home, Book a Class, Roster, Admin
   - [ ] Hero section with "Welcome to OTTODOT"
   - [ ] "Book a Trial Class" button links to /bookings
   - [ ] Footer shows Ottodot branding

#### Bookings Page

1. Visit [http://localhost:3000/bookings](http://localhost:3000/bookings)
2. Verify:
   - [ ] 2 trial classes displayed (MATH, SCIENCE)
   - [ ] MATH shows "4 seats available" (green)
   - [ ] SCIENCE shows "1 seat left" (yellow)
   - [ ] "Book Now" buttons visible
   - [ ] Seat progress bars show correctly

#### Booking Flow

1. Click "Book Now" on MATH TRIAL
2. Verify Step 1 (Parent Info):
   - [ ] Form shows parent fields
   - [ ] "Next Step" disabled until filled
   - [ ] Fill in: ALICE, LEE, alice@test.com, RES123
   - [ ] Click "Next Step"
3. Verify Step 2 (Student Info):
   - [ ] Form shows student fields
   - [ ] Fill in: TEST, STUDENT, RES888
   - [ ] Click "Next Step"
4. Verify Step 3 (Review):
   - [ ] Shows parent name
   - [ ] Shows student name
   - [ ] "Proceed to Payment" button
5. Click "Proceed to Payment"

#### Mock Payment

1. Verify payment form:
   - [ ] Amount shows "FREE"
   - [ ] Card details pre-filled (mock)
   - [ ] "Simulate payment failure" checkbox
   - [ ] "Pay FREE" button
2. Click "Pay FREE" (without failure checkbox):
   - [ ] Shows processing animation
   - [ ] After 1.5s, shows confirmation
3. OR check failure checkbox:
   - [ ] Click "Pay FREE"
   - [ ] Shows payment failed status

#### Booking Status Dialog

1. After payment:
   - [ ] Modal appears with status
   - [ ] Shows booking ID
   - [ ] Shows student name
   - [ ] Shows appropriate icon (success/failure)
   - [ ] "View Roster" button (if confirmed)
   - [ ] "Book Another Class" button
   - [ ] "Close" button

#### Roster Page

1. Visit [http://localhost:3000/roster](http://localhost:3000/roster)
2. Verify:
   - [ ] Class selector dropdown
   - [ ] Shows SCIENCE TRIAL by default
   - [ ] 3 confirmed students listed
   - [ ] Shows "1 of 4 seats remaining"
   - [ ] Switch to MATH - shows 0 students

#### Admin Dashboard

1. Visit [http://localhost:3000/admin](http://localhost:3000/admin)
2. Verify:
   - [ ] Booking statistics cards (Total, Confirmed, Pending, Failed)
   - [ ] Recent activity feed
   - [ ] All bookings table
   - [ ] Status badges on each booking

---

## 4. Edge Case Verification

### 4.1 Duplicate Booking Prevention

1. Try to book SCIENCE TRIAL as CHARLIE LEE again
2. Expected: Should create PENDING_PAYMENT (duplicate check happens on confirm)

### 4.2 Overbooking Prevention

1. SCIENCE TRIAL has 1 seat left
2. Book 2 new students
3. Second booking should fail on payment confirm with `NO_SEATS_AVAILABLE`

### 4.3 Payment Failure

1. Create a booking
2. On payment page, check "Simulate payment failure"
3. Click Pay
4. Expected: Status shows `PAYMENT_FAILED`
5. Check roster - student should NOT appear

### 4.4 Last Seat Race Condition

To test this properly, you'd need parallel requests:

```bash
# Terminal 1
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "BOOKING_ID_1", "payment_result": "success"}' &

# Terminal 2
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "BOOKING_ID_2", "payment_result": "success"}' &

wait
```

One should succeed, one should fail with `NO_SEATS_AVAILABLE`.

> **This manual check does not prove race safety.** The two commands above are sequential shells, and the
> automated stand-in for it (`src/__tests__/api/concurrency.test.ts`) mocks `supabase.rpc`. The real proof is
> `artifacts/booking_testing.md` L4/L5 (14 RPC + 24 race cases against a database) — **blocked on credentials (E2)**.

---

## 5. Test Coverage Report

After running `npm run test:coverage`, open `coverage/lcov-report/index.html` in browser.

Gate (from `jest.config.js`): **70 %** on all four metrics.

Measured 2026-09-29 (`npx jest --ci --coverage`) — **gate met, jest exits 0**:

| Metric | After booking suites | After F8 doc suites | After F8 route/template suites | After payment_mockup M0–M3 (current) | Gate |
|--------|----------------------|---------------------|--------------------------------|--------------------------------------|------|
| Statements | 65.35 % | 73.77 % | 88.46 % | **89.56 %** | 70 % ✅ |
| Branches | 53.82 % | 65.65 % | 80.76 % | **79.08 %** | 70 % ✅ |
| Functions | 67.97 % | 82.58 % | 89.72 % | **92.28 %** | 70 % ✅ |
| Lines | 64.95 % | 73.83 % | 89.36 % | **90.92 %** | 70 % ✅ |

*All four metrics clear the 70 % gate as of 2026-09-29 (re-measured after `payment_mockup.md` M0–M3: statements, functions and lines rose; **branches slipped 80.76 % → 79.08 %** because the new provider-resolution / D10-guard / env-fallback branches are only partly exercised — still well above the gate). D-v9 ("leave the
threshold, track the gap") is closed — `branches` went from 65.65 % to 80.76 % once the route and email-template suites
were added. The earlier 73.77 / 65.65 reading from the same day is retained above for history; it could not be
reproduced after the route suites landed. Caveat that still applies: `collectCoverageFrom` excludes `src/**/page.tsx`,
where most P0 defects live (fix_plan §7) — so the number over-estimates safety.*

---

## 6. Linting

```bash
npm run lint
```

Fix any issues before committing.

---

## 7. Build Verification

```bash
npm run build
```

Expected: Build completes without errors.

If build fails:
- Check TypeScript errors in terminal
- Run `npx tsc --noEmit` for detailed errors
- Fix type issues in source files

---

## 8. Continuous Integration

For CI/CD, use:

```bash
npm run test:ci
```

This runs tests with coverage and exits with proper exit code for CI pipelines.
