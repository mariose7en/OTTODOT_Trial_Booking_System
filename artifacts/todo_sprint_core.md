# OTTODOT Trial Booking System - Sprint Core Features Todo

## Overview
Comprehensive sprint breakdown for core features A-C from core.md
**Last Updated:** Based on project analysis

---

## SPRINT 1: Database Foundation ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete database schema with all tables and constraints

### 1.1 Core Tables ✅
- [x] Create `parents` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] first_name, last_name (TEXT NOT NULL)
  - [x] email (TEXT UNIQUE NOT NULL)
  - [x] password_hash (TEXT)
  - [x] residential_id (TEXT NOT NULL)
  - [x] role (TEXT DEFAULT 'parent' CHECK)
  - [x] created_at, updated_at (TIMESTAMPTZ)
  - [x] Index on email

- [x] Create `students` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] parent_id (REFERENCES parents ON DELETE CASCADE)
  - [x] first_name, last_name (TEXT NOT NULL)
  - [x] email (TEXT)
  - [x] grade (TEXT)
  - [x] residential_id (TEXT NOT NULL)
  - [x] created_at, updated_at (TIMESTAMPTZ)
  - [x] Index on parent_id

### 1.2 Class Tables ✅
- [x] Create `classes` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] class_name (TEXT NOT NULL)
  - [x] subject (TEXT NOT NULL CHECK)
  - [x] description (TEXT)
  - [x] grade_level (TEXT)
  - [x] duration_minutes (INT DEFAULT 60)
  - [x] created_at, updated_at (TIMESTAMPTZ)
  - [x] Index on subject

- [x] Create `trial_classes` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] class_id (REFERENCES classes ON DELETE CASCADE)
  - [x] class_name (TEXT NOT NULL)
  - [x] subject (TEXT NOT NULL)
  - [x] start_time (TIMESTAMPTZ NOT NULL)
  - [x] end_time (TIMESTAMPTZ)
  - [x] location (TEXT)
  - [x] max_seats (INT DEFAULT 4)
  - [x] created_at, updated_at (TIMESTAMPTZ)
  - [x] Index on start_time, class_id, subject

### 1.3 Booking Tables ✅
- [x] Create `bookings` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] student_id (REFERENCES students ON DELETE CASCADE)
  - [x] trial_class_id (REFERENCES trial_classes ON DELETE CASCADE)
  - [x] status (TEXT CHECK with default)
  - [x] registered_at, updated_at (TIMESTAMPTZ)
  - [x] UNIQUE INDEX on (student_id, trial_class_id) WHERE status = 'CONFIRMED'
  - [x] Index on trial_class_id, student_id, status

### 1.4 Payment Tables ✅
- [x] Create `payment_attempts` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] booking_id (REFERENCES bookings ON DELETE CASCADE)
  - [x] status (TEXT CHECK)
  - [x] txn_id (TEXT)
  - [x] amount (DECIMAL)
  - [x] currency (TEXT DEFAULT 'USD')
  - [x] payment_method (TEXT)
  - [x] error_message (TEXT)
  - [x] created_at (TIMESTAMPTZ)
  - [x] Index on booking_id

- [x] Create `payment_headers` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] booking_id (REFERENCES bookings ON DELETE CASCADE)
  - [x] payment_id (TEXT)
  - [x] invoice_number (TEXT)
  - [x] total_amount (DECIMAL NOT NULL)
  - [x] currency (TEXT DEFAULT 'USD')
  - [x] status (TEXT CHECK)
  - [x] payment_date, due_date (TIMESTAMPTZ)
  - [x] billing_name, billing_email (TEXT)
  - [x] notes (TEXT)
  - [x] created_at, updated_at (TIMESTAMPTZ)
  - [x] Index on booking_id

- [x] Create `payment_details` table
  - [x] id (TEXT PRIMARY KEY)
  - [x] payment_header_id (REFERENCES payment_headers ON DELETE CASCADE)
  - [x] description (TEXT NOT NULL)
  - [x] quantity (INT DEFAULT 1)
  - [x] unit_price (DECIMAL NOT NULL)
  - [x] total_price (DECIMAL NOT NULL)
  - [x] class_name (TEXT)
  - [x] class_date (TIMESTAMPTZ)
  - [x] created_at (TIMESTAMPTZ)
  - [x] Index on payment_header_id

### 1.5 Stored Procedure ✅
- [x] Create `confirm_trial_booking` function
  - [x] Lock booking row (FOR UPDATE)
  - [x] Lock trial class row (FOR UPDATE)
  - [x] Check duplicate confirmed booking
  - [x] Count confirmed seats
  - [x] Handle payment result (SUCCESS/FAILED)
  - [x] Return status codes

### 1.6 Seed Data ✅
- [x] Insert parents (3 records: 1 admin, 2 regular)
- [x] Insert students (4 records)
- [x] Insert classes (3 records: Math, Science, Advanced Math)
- [x] Insert trial_classes (4 records)
- [x] Insert bookings (6 records: various statuses)
- [x] Insert payment_attempts (4 records)
- [x] Insert payment_headers (4 records)
- [x] Insert payment_details (4 records)

---

## SPRINT 2: Authentication System ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete user registration and login

### 2.1 Supabase Auth Setup ✅
- [x] Configure Supabase client
- [x] Create `src/lib/auth/server.ts`
  - [x] createServerSupabaseClient()
  - [x] getSession()
  - [x] getUser()
  - [x] signOut()

- [x] Create `src/lib/auth/client.ts`
  - [x] useSupabase() hook
  - [x] useAuth() hook
  - [x] signInWithEmail()
  - [x] signUpWithEmail()
  - [x] signInWithMagicLink()
  - [x] signOut()

### 2.2 Login Page ✅
- [x] Create `/auth/login/page.tsx`
  - [x] Email/password form
  - [x] Magic link toggle
  - [x] Error handling
  - [x] Loading states
  - [x] Link to signup

### 2.3 Signup Page ✅
- [x] Create `/auth/signup/page.tsx`
  - [x] Email/password form
  - [x] Confirm password
  - [x] Validation (min 6 chars)
  - [x] Success confirmation
  - [x] Link to login

### 2.4 Auth Callback ✅
- [x] Create `/auth/callback/route.ts`
  - [x] Exchange code for session
  - [x] Redirect handling
  - [x] Error handling

### 2.5 Middleware ✅
- [x] Create `src/middleware.ts`
  - [x] Protect `/admin/*` routes
  - [x] Protect `/bookings/*` routes
  - [x] Redirect unauthenticated to login
  - [x] Admin role checking
  - [x] Auth route redirect if logged in

---

## SPRINT 3: Class & Trial Class Management ✅ COMPLETED
**Duration:** Completed
**Goal:** Admin can manage classes and trial classes

### 3.1 Class API ✅
- [x] Create `/api/classes/route.ts` (via trial-classes)
  - [x] GET - List all classes
  - [x] POST - Create new class (admin only)

- [x] Create `/api/trial-classes/route.ts`
  - [x] GET - List with seat counts
  - [x] POST - Create trial class (admin only)
  - [x] Filter by subject, availability

### 3.2 Trial Class API ✅
- [x] Create `/api/trial-classes/route.ts`
  - [x] GET - List trial classes with seats
  - [x] Support optional `?available=true` filter

### 3.3 Class Management UI ✅
- [x] Create `/admin/classes/page.tsx`
  - [x] List all classes
  - [x] Create class modal
  - [x] Delete class
  - [x] View roster per class

### 3.4 Trial Class Listing UI ✅
- [x] Update `/bookings/page.tsx`
  - [x] Fetch from API
  - [x] Display with seat availability
  - [x] Color-coded seats (green/yellow/red)
  - [x] Sort by date

---

## SPRINT 4: Booking Flow ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete parent booking journey

### 4.1 Booking API ✅
- [x] Create `/api/bookings/route.ts`
  - [x] GET - List bookings (with filters)
  - [x] POST - Create new booking
    - [x] Validate input (Zod)
    - [x] Check class exists
    - [x] Find/create parent
    - [x] Find/create student
    - [x] Check seat availability
    - [x] Create booking record
    - [x] Return booking ID

- [x] Create `/api/bookings/[id]/route.ts`
  - [x] GET - Get booking details
  - [x] Include student, class, payment info

### 4.2 Roster API ✅
- [x] Create `/api/roster/[class_id]/route.ts`
  - [x] GET - Get confirmed students
  - [x] Include student details
  - [x] Calculate seats remaining

### 4.3 Booking Form UI ✅
- [x] Create `/bookings/[classId]/page.tsx`
  - [x] Step 1: Select student
    - [x] Parent dropdown
    - [x] Student dropdown
    - [x] Grade display
  - [x] Step 2: Review class
    - [x] Class name, subject
    - [x] Date, time, location
    - [x] Price display
  - [x] Step 3: Confirm booking
    - [x] Summary display
    - [x] Terms acceptance
    - [x] Submit button

### 4.4 Booking Components ✅
- [x] Create `BookingForm.tsx`
  - [x] Multi-step navigation
  - [x] Form validation
  - [x] Loading states
  - [x] Error handling

- [x] Create `TrialClassCard.tsx`
  - [x] Class info display
  - [x] Seat availability badge
  - [x] Book now button
  - [x] Disabled if full

### 4.5 Roster UI ✅
- [x] Create `/roster/page.tsx`
  - [x] Class selector dropdown
  - [x] Fetch roster from API
  - [x] Display student list
  - [x] Show seat counts

- [x] Create `RosterTable.tsx`
  - [x] Student name, email
  - [x] Booking date
  - [x] Status badge

---

## SPRINT 5: Payment System ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete payment flow with mock/Stripe

### 5.1 Mock Payment ✅
- [x] Create `MockPaymentForm.tsx`
  - [x] Amount display
  - [x] Success/failure toggle
  - [x] Processing animation
  - [x] Submit handler

### 5.2 Payment API ✅
- [x] Create `/api/payments/confirm/route.ts`
  - [x] POST - Confirm payment
    - [x] Validate booking_id, payment_result
    - [x] Record payment attempt (INITIATED)
    - [x] Call confirm_trial_booking RPC
    - [x] Update payment attempt status
    - [x] Return booking status

- [x] Create `/api/payments/create-intent/route.ts`
  - [x] POST - Create Stripe PaymentIntent
  - [x] Validate booking exists
  - [x] Calculate amount
  - [x] Return client_secret

- [x] Create `/api/payments/webhook/route.ts`
  - [x] POST - Handle Stripe webhooks
  - [x] Verify signature
  - [x] Handle payment_intent.succeeded
  - [x] Handle payment_intent.payment_failed
  - [x] Update booking status

- [x] Create `/api/payments/refund/route.ts`
  - [x] POST - Process refund
  - [x] Validate booking is confirmed
  - [x] Create Stripe refund
  - [x] Update booking status

- [x] Create `/api/payments/history/route.ts`
  - [x] GET - Payment history
  - [x] Include booking, class info

### 5.3 Payment UI ✅
- [x] Create `/bookings/[classId]/payment/page.tsx`
  - [x] Stripe Elements integration
  - [x] Payment form
  - [x] Error handling
  - [x] Success redirect

- [x] Create `/bookings/[classId]/confirmation/page.tsx`
  - [x] Booking confirmation display
  - [x] Status badge
  - [x] Class details
  - [x] Next steps

- [x] Create `/payments/history/page.tsx`
  - [x] Payment list
  - [x] Status badges
  - [x] Class info

### 5.4 Payment Components ✅
- [x] Create `StripePaymentForm.tsx`
  - [x] PaymentElement integration
  - [x] Submit handler
  - [x] Loading states

- [x] Create `BookingConfirmation.tsx`
  - [x] Success icon
  - [x] Booking reference
  - [x] Class details
  - [x] Action buttons

---

## SPRINT 6: Email Notifications ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete email notification system

### 6.1 Email Service ✅
- [x] Install packages (@react-email/render, nodemailer)
- [x] Create `src/lib/email.ts`
  - [x] sendEmail() function
  - [x] SMTP configuration
  - [x] Graceful fallback
  - [x] formatDate(), formatTime()

### 6.2 Email Templates ✅
- [x] Create `src/lib/email-templates.ts`
  - [x] bookingConfirmedTemplate()
    - [x] Class details
    - [x] Booking reference
    - [x] Student/parent names
    - [x] Ottodot branding
  - [x] paymentFailedTemplate()
    - [x] Error explanation
    - [x] Retry link
    - [x] Support contact
  - [x] bookingReminderTemplate()
    - [x] 24-hour reminder
    - [x] Class details
    - [x] Location info

### 6.3 Notification API ✅
- [x] Create `/api/notifications/route.ts`
  - [x] POST - Send notification
  - [x] Validate type, booking_id
  - [x] Fetch booking with relations
  - [x] Send appropriate template

- [x] Create `/api/notifications/send-reminders/route.ts`
  - [x] POST - Batch send reminders
  - [x] Find classes tomorrow
  - [x] Find confirmed bookings
  - [x] Send reminder to each

### 6.4 Integration Points ✅
- [x] Send confirmation on payment success
- [x] Send failure on payment failure
- [x] Schedule reminders (API endpoint ready)

---

## SPRINT 7: Admin Dashboard ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete admin management interface

### 7.1 Dashboard API ✅
- [x] Create `/api/admin/students/route.ts`
  - [x] GET - Student list
  - [x] Include booking counts

### 7.2 Dashboard UI ✅
- [x] Update `/admin/page.tsx`
  - [x] Stats cards
  - [x] Recent activity
  - [x] Quick actions

- [x] Create `BookingStats.tsx`
  - [x] Total bookings
  - [x] Confirmed count
  - [x] Pending count
  - [x] Failed count

- [x] Create `RecentActivity.tsx`
  - [x] Recent bookings list
  - [x] Status badges
  - [x] Timestamps

### 7.3 Booking Management ✅
- [x] Create `/admin/bookings/page.tsx`
  - [x] Booking list table
  - [x] Search by name/email
  - [x] Filter by status
  - [x] Cancel booking action
  - [x] View details link

### 7.4 Student Management ✅
- [x] Create `/admin/students/page.tsx`
  - [x] Student list table
  - [x] Search by name/email
  - [x] View bookings link
  - [x] Booking count display

---

## SPRINT 8: Validation & Error Handling ✅ COMPLETED
**Duration:** Completed
**Goal:** Complete input validation and error handling

### 8.1 Zod Validation ✅
- [x] Install zod
- [x] Create `src/lib/validations/booking.ts`
  - [x] CreateBookingSchema
  - [x] ConfirmPaymentSchema
  - [x] TrialClassQuerySchema
  - [x] BookingQuerySchema
  - [x] RosterParamsSchema

### 8.2 Error Handling ✅
- [x] Create `src/lib/errors.ts`
  - [x] AppError base class
  - [x] ValidationError
  - [x] DatabaseError
  - [x] NotFoundError
  - [x] ConflictError
  - [x] RateLimitError
  - [x] createErrorResponse()

### 8.3 Error UI ✅
- [x] Create `ErrorBoundary.tsx`
- [x] Create `/app/error.tsx`
- [x] Create `/app/not-found.tsx`
- [x] Update layout with ErrorBoundary

### 8.4 API Updates ✅
- [x] Update all API routes with validation
- [x] Use createErrorResponse()
- [x] Structured error responses

---

## SPRINT 9: Testing ✅ COMPLETED
**Duration:** Completed
**Goal:** Comprehensive test coverage

### 9.1 Unit Tests ✅
- [x] `types/booking.test.ts`
- [x] `lib/utils.test.ts`
- [x] `lib/seed-data.test.ts`

### 9.2 Component Tests ✅
- [x] `Button.test.tsx`
- [x] `Card.test.tsx`
- [x] `StatusBadge.test.tsx`
- [x] `Logo.test.tsx`
- [x] `Header.test.tsx`
- [x] `TrialClassCard.test.tsx`
- [x] `BookingForm.test.tsx`
- [x] `MockPaymentForm.test.tsx`
- [x] `BookingStatusDialog.test.tsx`
- [x] `RosterTable.test.tsx`

### 9.3 API Tests ✅
- [x] `routes.test.ts`
- [x] `concurrency.test.ts`

### 9.4 Integration Tests ✅
- [x] Concurrency tests for race conditions

---

## SPRINT 10: Polish & Documentation 🔄 IN PROGRESS
**Duration:** In Progress
**Goal:** Final polish and documentation

### 10.1 UI Polish 🔄
- [x] Error boundaries
- [x] Loading states
- [ ] Loading skeletons (pending)
- [ ] Mobile responsiveness (pending)
- [ ] Accessibility (a11y) (pending)

### 10.2 Documentation 🔄
- [x] README.md
- [x] setup.md
- [x] test.md
- [ ] API documentation (pending)

### 10.3 Deployment Prep 🔄
- [x] Environment variables (.env.local.example)
- [x] Build verification
- [ ] Performance check (pending)

---

## Sprint Dependencies

```
Sprint 1 (Database) ✅ → Sprint 2 (Auth) ✅ → Sprint 3 (Classes) ✅
                                                    ↓
Sprint 4 (Bookings) ✅ ←───────────────────────────┘
      ↓
Sprint 5 (Payment) ✅ → Sprint 6 (Email) ✅
      ↓
Sprint 7 (Admin) ✅ → Sprint 8 (Validation) ✅ → Sprint 9 (Testing) ✅ → Sprint 10 (Polish) 🔄
```

---

## Summary

| Sprint | Status | Notes |
|--------|--------|-------|
| 1 | ✅ COMPLETED | All tables, indexes, stored procedure, seed data |
| 2 | ✅ COMPLETED | Supabase Auth, login, signup, middleware |
| 3 | ✅ COMPLETED | Classes API, trial classes, management UI |
| 4 | ✅ COMPLETED | Booking API, form, roster |
| 5 | ✅ COMPLETED | Mock/Stripe payment, webhooks, confirmation |
| 6 | ✅ COMPLETED | Email service, templates, notifications |
| 7 | ✅ COMPLETED | Admin dashboard, booking/student management |
| 8 | ✅ COMPLETED | Zod validation, error classes, error UI |
| 9 | ✅ COMPLETED | 12 test suites, 110+ tests |
| 10 | 🔄 IN PROGRESS | Polish and documentation |

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

*Document updated: Based on project analysis*
*9 of 10 sprints completed*
