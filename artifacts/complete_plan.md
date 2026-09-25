# OTTODOT Trial Booking System - Complete Plan

## Core Requirements (from core.md)

### A. Database & Features
1. User registration and login with email and password
2. Class management
3. Trial class from class
4. Trial class booking with seats available
5. Payment header, payment detail with email notification

### B. What To Build
1. A parent to choose a child and pick an available trial class
2. A parent to submit a trial booking
3. A mock payment step or payment result to be recorded
4. The booking status to be shown after submission
5. An admin or teacher to see the trial class roster or a simple roster API/output

### C. Must Prevent/Handle
1. Duplicate confirmed bookings for the same child and class
2. Overbooking beyond 4 confirmed students
3. Payment failure without incorrectly adding the child to the confirmed roster
4. Last-Seat Race Condition:
   - User A selects the last available slot and moves to payment
   - User B selects the same slot
   - User B completes payment first and confirms the booking
   - User A then tries to complete payment

---

## Current Status

**9 of 10 Sprints COMPLETED ✅**

| Sprint | Status | Focus |
|--------|--------|-------|
| 1 | ✅ | Database Foundation |
| 2 | ✅ | Authentication System |
| 3 | ✅ | Class & Trial Class Management |
| 4 | ✅ | Booking Flow |
| 5 | ✅ | Payment System |
| 6 | ✅ | Email Notifications |
| 7 | ✅ | Admin Dashboard |
| 8 | ✅ | Validation & Error Handling |
| 9 | ✅ | Testing |
| 10 | 🔄 | Polish & Documentation (IN PROGRESS) |

---

## Database Schema (seed.sql) ✅

### Tables
| Table | Purpose | Status |
|-------|---------|--------|
| `parents` | Parent accounts | ✅ Created |
| `students` | Student profiles | ✅ Created |
| `classes` | Base class definitions | ✅ Created |
| `trial_classes` | Scheduled instances | ✅ Created |
| `bookings` | Trial bookings | ✅ Created |
| `payment_attempts` | Payment attempts | ✅ Created |
| `payment_headers` | Invoice headers (email) | ✅ Created |
| `payment_details` | Invoice line items | ✅ Created |

### Stored Procedure: `confirm_trial_booking` ✅
- Locks booking row (FOR UPDATE)
- Locks trial class row (FOR UPDATE)
- Checks for duplicate confirmed booking
- Counts confirmed seats
- Handles payment result (SUCCESS/FAILED)
- Returns: CONFIRMED, DUPLICATE_BOOKING, NO_SEATS_AVAILABLE, PAYMENT_FAILED

---

## API Endpoints ✅

| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/trial-classes` | ✅ |
| GET | `/api/bookings` | ✅ |
| POST | `/api/bookings` | ✅ |
| GET | `/api/bookings/[id]` | ✅ |
| POST | `/api/payments/confirm` | ✅ |
| POST | `/api/payments/create-intent` | ✅ |
| POST | `/api/payments/webhook` | ✅ |
| POST | `/api/payments/refund` | ✅ |
| GET | `/api/payments/history` | ✅ |
| GET | `/api/roster/[class_id]` | ✅ |
| POST | `/api/notifications` | ✅ |
| POST | `/api/notifications/send-reminders` | ✅ |
| POST | `/api/seed` | ✅ |

---

## Frontend Pages ✅

| Page | Route | Status |
|------|-------|--------|
| Home | `/` | ✅ |
| Login | `/auth/login` | ✅ |
| Signup | `/auth/signup` | ✅ |
| Bookings | `/bookings` | ✅ |
| Booking Flow | `/bookings/[classId]` | ✅ |
| Payment | `/bookings/[classId]/payment` | ✅ |
| Confirmation | `/bookings/[classId]/confirmation` | ✅ |
| Roster | `/roster` | ✅ |
| Payment History | `/payments/history` | ✅ |
| Admin Dashboard | `/admin` | ✅ |
| Admin Bookings | `/admin/bookings` | ✅ |
| Admin Classes | `/admin/classes` | ✅ |
| Admin Students | `/admin/students` | ✅ |

---

## Components ✅

| Component | Status |
|-----------|--------|
| BookingForm | ✅ |
| BookingConfirmation | ✅ |
| BookingStats | ✅ |
| BookingStatusDialog | ✅ |
| Button | ✅ |
| Card | ✅ |
| ErrorBoundary | ✅ |
| Footer | ✅ |
| Header | ✅ |
| Logo | ✅ |
| MockPaymentForm | ✅ |
| RecentActivity | ✅ |
| RosterTable | ✅ |
| StatusBadge | ✅ |
| StripePaymentForm | ✅ |
| TrialClassCard | ✅ |

---

## Edge Cases Handled ✅

| Case | Solution | Status |
|------|----------|--------|
| **Duplicate Booking** | Unique partial index + RPC check | ✅ |
| **Overbooking** | Seat count check in locked transaction | ✅ |
| **Payment Failure** | Status stays PENDING_PAYMENT, no confirm | ✅ |
| **Last-Seat Race** | FOR UPDATE row locking in RPC | ✅ |
| **Concurrent Payments** | Serialized by row lock | ✅ |

---

## Testing ✅

| Category | Count | Status |
|----------|-------|--------|
| Test Suites | 12 | ✅ All Passing |
| Unit Tests | 3 | ✅ |
| Component Tests | 10 | ✅ |
| API Tests | 2 | ✅ |
| Concurrency Tests | 1 | ✅ |
| **Total Tests** | **110+** | ✅ |

---

## Remaining Work (Sprint 10)

### High Priority
- [ ] Loading skeletons for better UX
- [ ] Mobile responsiveness testing
- [ ] API documentation

### Medium Priority
- [ ] Accessibility (a11y) improvements
- [ ] Performance optimization
- [ ] Rate limiting on API routes

### Low Priority
- [ ] Docker setup
- [ ] CI/CD pipeline
- [ ] Monitoring (Sentry)

---

## Success Criteria

All core requirements from core.md are met:

| Requirement | Status |
|-------------|--------|
| User registration/login | ✅ |
| Class management | ✅ |
| Trial class from class | ✅ |
| Trial class booking with seats | ✅ |
| Payment with email notification | ✅ |
| Parent picks child and class | ✅ |
| Submit trial booking | ✅ |
| Mock payment step | ✅ |
| Booking status shown | ✅ |
| Admin roster view | ✅ |
| Duplicate prevention | ✅ |
| Overbooking prevention (max 4) | ✅ |
| Payment failure handling | ✅ |
| Last-seat race condition | ✅ |
| Payment header/detail for email | ✅ |

---

*Document updated: Based on project analysis*
*9 of 10 sprints completed*
