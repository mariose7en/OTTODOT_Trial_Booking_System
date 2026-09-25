# OTTODOT Trial Booking System - Test & Verification Guide

## 1. Running Tests

### 1.1 Run All Tests

```bash
npm test
```

Expected output:
```
Test Suites: 8 passed, 8 total
Tests:       65 passed, 65 total
```

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

### 2.1 Type Tests (`src/__tests__/types/booking.test.ts`)

| Test | Description |
|------|-------------|
| BookingStatus enum values | Verifies all 6 status strings match seed.sql |
| BookingStatus count | Ensures exactly 6 statuses |
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
    "parent_first_name": "TEST",
    "parent_last_name": "PARENT",
    "parent_email": "test@example.com",
    "parent_residential_id": "RES999",
    "student_first_name": "TEST",
    "student_last_name": "STUDENT",
    "student_residential_id": "RES888",
    "trial_class_id": "MT-M-20261001T1000-4"
  }' | jq
```

Expected:
- `success: true`
- Returns `booking_id` and `status: "PENDING_PAYMENT"`

#### Test Payment Confirm

```bash
# First get a booking_id from the previous step, then:
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "YOUR_BOOKING_ID",
    "payment_result": "SUCCESS"
  }' | jq
```

Expected:
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
  -d '{"booking_id": "BOOKING_ID_1", "payment_result": "SUCCESS"}' &

# Terminal 2
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "BOOKING_ID_2", "payment_result": "SUCCESS"}' &

wait
```

One should succeed, one should fail with `NO_SEATS_AVAILABLE`.

---

## 5. Test Coverage Report

After running `npm run test:coverage`, open `coverage/lcov-report/index.html` in browser.

Target coverage:
- Statements: >70%
- Branches: >70%
- Functions: >70%
- Lines: >70%

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
