# OTTODOT Trial Booking System - 4-Hour Deliverable Todo List

## Status Legend
- [x] = Completed
- [ ] = Pending

---

## Phase 1: Database & Schema (Priority: HIGH)

### 1.1 Types Alignment with seed.sql
- [x] `BookingStatus` enum matches seed.sql CHECK constraint (`PENDING_PAYMENT`, `CONFIRMED`, `PAYMENT_FAILED`, `CANCELLED`)
- [ ] Add `PaymentAttemptStatus` enum (`INITIATED`, `SUCCESS`, `FAILED`) to `src/types/booking.ts`
- [ ] Update `PaymentAttempt` interface `status` field to use `PaymentAttemptStatus` enum
- [ ] Add `TrialClassWithSeats` interface (extends `TrialClass` with `confirmed_count` and `seats_remaining`)

### 1.2 Seed Data Integration
- [ ] Create `src/lib/seed-data.ts` with constants matching `artifacts/seed.sql`
- [ ] Export parent, student, trial class, booking, and payment attempt seed data
- [ ] Use seed data constants in API routes for demo/test mode

---

## Phase 2: API Routes (Priority: HIGH)

### 2.1 Trial Classes API (NEW - missing)
- [ ] Create `src/app/api/trial-classes/route.ts` - GET endpoint to list all trial classes with seat counts
- [ ] Return trial classes with computed `confirmed_count` and `seats_remaining`
- [ ] Support optional `?available=true` filter

### 2.2 Bookings API Enhancement
- [ ] Add GET handler to `src/app/api/bookings/route.ts` - list bookings with optional filters
- [ ] Create `src/app/api/bookings/[id]/route.ts` - GET single booking by ID
- [ ] Add `payment_attempts` recording in payment confirm route

### 2.3 Payment Confirm Enhancement
- [ ] Insert `payment_attempts` record before calling RPC
- [ ] Update `payment_attempts` status after RPC response
- [ ] Include `txn_id` generation

### 2.4 Seed Data API (Demo)
- [ ] Create `src/app/api/seed/route.ts` - POST endpoint to initialize demo data
- [ ] Insert all seed data from `seed.sql` into Supabase tables
- [ ] Useful for local development and testing

---

## Phase 3: Frontend UI (Priority: HIGH) - Per `artifacts/front_end.md`

### 3.1 Design System & Branding
- [x] Tailwind config exists
- [ ] Update `tailwind.config.js` with Ottodot brand colors:
  - Yellow: `#faaf22`
  - Red: `#e7344a`
  - Blue: `#69cce1`
  - Green: `#82c340`
- [ ] Update `src/app/globals.css` with Ottodot theme
- [ ] Add Ottodot logo to `public/logo.webp`
- [ ] Create `src/components/Logo.tsx` component

### 3.2 Layout & Navigation
- [ ] Redesign `src/app/layout.tsx` with Ottodot branding
- [ ] Create `src/components/Header.tsx` with navigation
- [ ] Create `src/components/Footer.tsx` with Ottodot branding

### 3.3 Home Page Redesign
- [ ] Redesign `src/app/page.tsx` as Ottodot landing page
- [ ] Hero section with logo, tagline, and CTA
- [ ] Feature cards for Math & Science classes
- [ ] Game-based learning vibe per front_end.md

### 3.4 Trial Class Listing (Booking Flow)
- [ ] Create `src/components/TrialClassCard.tsx` with:
  - Class name, subject, start time
  - Available seats display (green/yellow/red based on availability)
  - "Book Now" button
- [ ] Redesign `src/app/bookings/page.tsx` to fetch from API
- [ ] Show available seats with color-coded indicators

### 3.5 Booking Flow - Parent Guide
- [ ] Create `src/components/BookingForm.tsx`:
  - Step 1: Select student (parent dropdown, student dropdown)
  - Step 2: Review class details
  - Step 3: Confirm booking
- [ ] Create `src/app/bookings/[classId]/page.tsx` - booking form page
- [ ] Integrate with `POST /api/bookings` endpoint
- [ ] Show booking confirmation with status

### 3.6 Mock Payment Step
- [ ] Create `src/components/MockPaymentForm.tsx`:
  - Simulated payment form with amount display
  - Success/Failure toggle for demo
  - Processing animation
- [ ] Create `src/app/bookings/[classId]/payment/page.tsx` - payment page
- [ ] Integrate with `POST /api/payments/confirm` endpoint
- [ ] Record payment attempt

### 3.7 Booking Status & Dialog
- [ ] Create `src/components/BookingStatusDialog.tsx`:
  - Modal dialog showing booking result
  - Status badge with color coding
  - Next steps (view roster, book another, etc.)
- [ ] Create `src/components/BookingConfirmation.tsx`:
  - Confirmation details (class, student, status)
  - Share/print option

### 3.8 Roster View
- [ ] Create `src/components/RosterTable.tsx`:
  - Table with student name, email, booking date
  - Seat count display
- [ ] Redesign `src/app/roster/page.tsx`:
  - Class selector dropdown
  - Fetch from `GET /api/roster/:class_id`
  - Show confirmed students list

### 3.9 Admin Dashboard
- [ ] Create `src/components/BookingStats.tsx`:
  - Total bookings, confirmed, pending, failed counts
  - Fetch from API
- [ ] Create `src/components/RecentActivity.tsx`:
  - List of recent bookings and payment attempts
- [ ] Redesign `src/app/admin/page.tsx` with dynamic data

---

## Phase 4: Testing (Priority: MEDIUM)

### 4.1 Existing Tests
- [x] `src/__tests__/types/booking.test.ts` - BookingStatus enum
- [x] `src/__tests__/lib/utils.test.ts` - utility functions
- [x] `src/__tests__/components/Button.test.tsx` - Button component
- [x] `src/__tests__/components/Card.test.tsx` - Card component
- [x] `src/__tests__/components/StatusBadge.test.tsx` - StatusBadge component

### 4.2 New Tests Required
- [ ] `src/__tests__/lib/seed-data.test.ts` - seed data constants
- [ ] `src/__tests__/api/trial-classes.test.ts` - trial classes API
- [ ] `src/__tests__/api/bookings.test.ts` - bookings API
- [ ] `src/__tests__/api/payments.test.ts` - payments API
- [ ] `src/__tests__/components/TrialClassCard.test.tsx` - class card
- [ ] `src/__tests__/components/BookingForm.test.tsx` - booking form
- [ ] `src/__tests__/components/MockPaymentForm.test.tsx` - payment form
- [ ] `src/__tests__/components/BookingStatusDialog.test.tsx` - dialog
- [ ] `src/__tests__/components/RosterTable.test.tsx` - roster table
- [ ] `src/__tests__/components/Header.test.tsx` - header
- [ ] `src/__tests__/components/Logo.test.tsx` - logo

### 4.3 Concurrency Tests (if time permits)
- [ ] `src/__tests__/api/concurrency.test.ts` - last seat race condition
- [ ] Use parallel requests to test booking limit enforcement

---

## Phase 5: Configuration & Deployment (Priority: LOW)

### 5.1 Environment Setup
- [ ] Update `.env.local.example` with all required env vars
- [ ] Add seed data initialization instructions to README

### 5.2 Documentation
- [ ] Update `README.md` with:
  - Setup instructions (`npm install`, `.env.local`, seed data)
  - API documentation
  - Test instructions
  - Deployment guide

---

## Build Order (Critical Path)

```
Phase 1.1 (Types) → Phase 1.2 (Seed Data) → Phase 2.1 (Trial Classes API)
    → Phase 3.1 (Design System) → Phase 3.2 (Layout)
    → Phase 3.4 (Class Listing) → Phase 3.5 (Booking Flow)
    → Phase 3.6 (Mock Payment) → Phase 3.7 (Status Dialog)
    → Phase 3.8 (Roster) → Phase 4.2 (Tests)
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/booking.ts` | UPDATE | Add PaymentAttemptStatus, TrialClassWithSeats |
| `src/lib/seed-data.ts` | CREATE | Seed data constants |
| `src/app/api/trial-classes/route.ts` | CREATE | GET trial classes with seats |
| `src/app/api/bookings/route.ts` | UPDATE | Add GET handler |
| `src/app/api/bookings/[id]/route.ts` | CREATE | GET single booking |
| `src/app/api/payments/confirm/route.ts` | UPDATE | Record payment attempts |
| `src/app/api/seed/route.ts` | CREATE | POST seed data |
| `tailwind.config.js` | UPDATE | Add Ottodot brand colors |
| `src/app/globals.css` | UPDATE | Ottodot theme |
| `src/app/layout.tsx` | UPDATE | Branded layout |
| `src/app/page.tsx` | UPDATE | Landing page |
| `src/app/bookings/page.tsx` | UPDATE | Dynamic class listing |
| `src/app/bookings/[classId]/page.tsx` | CREATE | Booking form page |
| `src/app/bookings/[classId]/payment/page.tsx` | CREATE | Payment page |
| `src/app/roster/page.tsx` | UPDATE | Dynamic roster |
| `src/app/admin/page.tsx` | UPDATE | Dynamic admin |
| `src/components/Logo.tsx` | CREATE | Ottodot logo |
| `src/components/Header.tsx` | CREATE | Navigation header |
| `src/components/Footer.tsx` | CREATE | Footer |
| `src/components/TrialClassCard.tsx` | CREATE | Class card |
| `src/components/BookingForm.tsx` | CREATE | Multi-step form |
| `src/components/MockPaymentForm.tsx` | CREATE | Payment simulation |
| `src/components/BookingStatusDialog.tsx` | CREATE | Status modal |
| `src/components/BookingConfirmation.tsx` | CREATE | Confirmation |
| `src/components/RosterTable.tsx` | CREATE | Roster table |
| `src/components/BookingStats.tsx` | CREATE | Admin stats |
| `src/components/RecentActivity.tsx` | CREATE | Admin activity |
| `public/logo.webp` | COPY | From logo/ |
