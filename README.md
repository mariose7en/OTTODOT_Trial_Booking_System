# OTTODOT Trial Booking System

A comprehensive trial booking system for Ottodot's live online science and math classes for Primary 1-6 students.

## Overview

This system handles trial class bookings with focus on correctness under critical edge cases: duplicate bookings, overbooking, payment failures, and the last seat race condition.

**Key Features:**
- Book trial Math and Science classes
- Real-time seat availability tracking
- Mock payment and Stripe payment processing
- Parent/student registration with authentication
- Admin dashboard with booking management
- Email notifications (confirmation, failure, reminders)
- Payment history and refund capability

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.3.7 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS with Ottodot brand colors |
| **Backend** | Next.js API Routes, Supabase RPC |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Email/Password, Magic Link) |
| **Payment** | Stripe (optional), Mock Payment (PayMock) |
| **Email** | Nodemailer with SMTP |
| **Testing** | Jest, React Testing Library, SWC, 559 tests (43 suites) |
| **Deployment** | Vercel, Docker |
| **Build Tool** | Turbopack (Next.js 16) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  Home   │  │Bookings │  │ Roster  │  │ Admin   │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       │            │            │            │              │
│  ┌────┴────────────┴────────────┴────────────┴────┐        │
│              API Client Layer                   │        │
│  └────────────────────┬───────────────────────────┘        │
└───────────────────────┼────────────────────────────────────┘
                        │ HTTP
┌───────────────────────┼────────────────────────────────────┐
│                 API Routes (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │/api/trial│  │/api/book │  │/api/pay  │  │/api/roster│  │
│  │-classes  │  │ ings     │  │/confirm  │  │/:class_id │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼─────────────┼─────────────┼─────────┘
        │              │             │             │
┌───────┼──────────────┼─────────────┼─────────────┼─────────┐
│       │     Supabase Client        │             │         │
│  ┌────┴──────────────┴─────────────┴─────────────┴────┐   │
│  │              Supabase RPC / Query                    │   │
│  └────────────────────┬───────────────────────────────┘   │
│                       │                                    │
│  ┌────────────────────┴───────────────────────────────┐   │
│  │         PostgreSQL (Supabase)                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────────┐         │   │
│  │  │ parents │ │students │ │trial_classes  │         │   │
│  │  └────┬────┘ └────┬────┘ └──────┬───────┘         │   │
│  │       │           │             │                   │   │
│  │  ┌────┴───────────┴─────────────┴───────┐         │   │
│  │  │            bookings                   │         │   │
│  │  └────────────────┬─────────────────────┘         │   │
│  │                   │                               │   │
│  │  ┌────────────────┴─────────────────────┐         │   │
│  │  │       payment_attempts                │         │   │
│  │  └──────────────────────────────────────┘         │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────┐         │   │
│  │  │  confirm_trial_booking (RPC)         │         │   │
│  │  │  - Row locking (FOR UPDATE)          │         │   │
│  │  │  - Duplicate check                   │         │   │
│  │  │  - Seat count validation             │         │   │
│  │  │  - Atomic status update              │         │   │
│  │  └──────────────────────────────────────┘         │   │
│  └────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Correctness First** - Database constraints are the strongest guardrails
2. **Backend Enforces Invariants** - Frontend displays but never enforces rules
3. **TypeScript Safety** - Enums make booking statuses explicit and safe
4. **Atomic Operations** - Stored procedures ensure race-condition safety

## Project Structure

```
OTTODOT_Trial_Booking_System/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout with Header/Footer
│   │   ├── page.tsx                 # Landing page
│   │   ├── globals.css              # Ottodot theme
│   │   ├── auth/
│   │   │   ├── login/page.tsx       # Login page
│   │   │   ├── signup/page.tsx      # Signup page
│   │   │   └── callback/route.ts    # Auth callback
│   │   ├── bookings/
│   │   │   ├── page.tsx             # Trial class listing
│   │   │   └── [classId]/
│   │   │       ├── page.tsx         # 3-step booking flow
│   │   │       ├── payment/page.tsx # Stripe payment
│   │   │       └── confirmation/page.tsx
│   │   ├── roster/page.tsx          # Class roster view
│   │   ├── payments/history/page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx             # Admin dashboard
│   │   │   ├── bookings/page.tsx    # Manage bookings
│   │   │   ├── classes/page.tsx     # Manage classes
│   │   │   └── students/page.tsx    # View students
│   │   └── api/
│   │       ├── trial-classes/route.ts
│   │       ├── bookings/route.ts
│   │       ├── bookings/[id]/route.ts
│   │       ├── payments/
│   │       │   ├── confirm/route.ts
│   │       │   ├── create-intent/route.ts
│   │       │   ├── webhook/route.ts
│   │       │   ├── refund/route.ts
│   │       │   └── history/route.ts
│   │       ├── roster/[class_id]/route.ts
│   │       ├── notifications/route.ts
│   │       ├── notifications/send-reminders/route.ts
│   │       ├── admin/students/route.ts
│   │       └── seed/route.ts
│   ├── components/                   # React components (17 total)
│   │   ├── Logo.tsx                 # Ottodot logo
│   │   ├── Header.tsx               # Navigation
│   │   ├── Footer.tsx               # Footer
│   │   ├── Button.tsx               # Reusable button
│   │   ├── Card.tsx                 # Card wrapper
│   │   ├── StatusBadge.tsx          # Booking status badge
│   │   ├── TrialClassCard.tsx       # Class listing card
│   │   ├── BookingForm.tsx          # Multi-step form
│   │   ├── MockPaymentForm.tsx      # Payment simulation
│   │   ├── StripePaymentForm.tsx    # Stripe integration
│   │   ├── BookingStatusDialog.tsx  # Status modal
│   │   ├── BookingConfirmation.tsx  # Confirmation view
│   │   ├── RosterTable.tsx          # Student roster
│   │   ├── BookingStats.tsx         # Admin statistics
│   │   ├── RecentActivity.tsx       # Activity feed
│   │   └── ErrorBoundary.tsx        # Error handling
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── server.ts            # Server-side auth
│   │   │   └── client.ts            # Client-side auth hooks
│   │   ├── supabase.ts              # Supabase client
│   │   ├── stripe.ts                # Stripe server
│   │   ├── stripe-client.ts         # Stripe client
│   │   ├── email.ts                 # Email service
│   │   ├── email-templates.ts       # Email templates
│   │   ├── errors.ts                # Error classes
│   │   ├── utils.ts                 # Utility functions
│   │   ├── seed-data.ts             # Seed data constants
│   │   └── validations/
│   │       └── booking.ts           # Zod schemas
│   ├── types/
│   │   └── booking.ts               # TypeScript types & enums
│   ├── middleware.ts                 # Route protection
│   └── __tests__/                   # Jest tests (43 suites / 559 tests)
├── artifacts/                       # Documentation
│   ├── seed.sql                     # Database schema
│   ├── setup.md                     # Setup guide
│   ├── test.md                      # Test guide
│   ├── AI_USAGE.md                  # AI tool usage
│   ├── complete_plan.md             # Complete plan
│   └── todo_sprint_core.md          # Sprint breakdown
└── logo/                            # Ottodot logo
```

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase account (free tier works)
- Stripe account (optional, for live payment processing)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/OTTODOT_Trial_Booking_System.git
cd OTTODOT_Trial_Booking_System

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your credentials:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - STRIPE_SECRET_KEY (optional, required for "stripe" provider)
# - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (optional)
# - PAYMENT_PROVIDER (optional: "mock" | "stripe", default "mock" in dev/test)
# - SMTP_HOST, SMTP_USER, SMTP_PASS (for emails, required for notifications)

# Run database schema
# Copy artifacts/seed.sql to Supabase SQL Editor and run

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

For detailed instructions, see [artifacts/setup.md](artifacts/setup.md).

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/trial-classes` | List classes with seats | No |
| GET | `/api/bookings` | List all bookings | Admin |
| POST | `/api/bookings` | Create new booking | Yes |
| GET | `/api/bookings/[id]` | Get booking details | Yes |
| POST | `/api/payments/confirm` | Confirm payment | Yes |
| POST | `/api/payments/create-intent` | Create Stripe intent | Yes |
| POST | `/api/payments/webhook` | Stripe webhook | No |
| POST | `/api/payments/refund` | Process refund | Admin |
| GET | `/api/payments/history` | Payment history | Yes |
| GET | `/api/roster/[class_id]` | Get class roster | Yes |
| POST | `/api/notifications` | Send notifications | Admin |
| POST | `/api/notifications/send-reminders` | Batch reminders | Admin |
| POST | `/api/seed` | Initialize seed data | No |

> **The `Auth` column above is what the design intends, not what the code does.** As of 2026-09-29 **no API route
> performs authentication or authorization** (fix_plan §3.2 P0) - `refund`, `seed`, `notifications` and
> `admin/students` are fully open, and only the Stripe webhook verifies anything (its signature). `401`/`403` are
> never returned by any route. Measured detail: `artifacts/api.md`.

## Database Schema

### Tables
- **parents** - Parent accounts with role (parent/admin)
- **students** - Student profiles linked to parents
- **classes** - Base class definitions (Math, Science)
- **trial_classes** - Scheduled trial instances with seats
- **bookings** - Trial bookings with status tracking
- **payment_attempts** - Payment attempt records
- **payment_headers** - Invoice headers for email
- **payment_details** - Invoice line items

### Stored Procedure
`confirm_trial_booking` - Handles race conditions with row-level locking:
- Locks booking and trial class rows
- Checks for duplicate confirmed booking
- Validates seat availability
- Updates booking status atomically

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

**Test Suites:** 43 passed, 43 total
**Tests:** 559 total (492 passed, 67 `todo`)

The 67 `todo` cases are *targets* for defects that are still open: the suite pins today's behaviour with
`[BUG-ASSERT]` and carries the desired assertion as `test.todo` until the fix lands (see
[`artifacts/booking_testing.md`](artifacts/booking_testing.md) §10 and [`artifacts/fix_plan_sept_26.md`](artifacts/fix_plan_sept_26.md)).

For testing details, see [artifacts/test.md](artifacts/test.md).

## Seed Data

The system comes with pre-loaded test data:

- **3 Parents:** ALICE LEE (admin), BOB OLSEN, CAROL NG
- **4 Students:** CHARLIE LEE, DAISY LEE, ETHAN OLSEN, FIONA NG
- **3 Classes:** MATH TRIAL, SCIENCE TRIAL, ADVANCED MATH
- **4 Trial Classes:** Scheduled instances with seats
- **6 Bookings:** Various statuses for testing scenarios
- **4 Payment Attempts:** Success and failed attempts
- **4 Payment Headers:** Invoice records for email
- **4 Payment Details:** Line items

See [artifacts/seed.sql](artifacts/seed.sql) for full schema and data.

## Edge Cases (design intent vs. measured reality)

| Case | Intended handling | Reality (2026-09-29) |
|------|-------------------|------------------------|
| **Duplicate Booking** | Unique constraint + RPC check | Unique index is `WHERE status='CONFIRMED'`; the webhook **bypasses the RPC**, and the RPC's duplicate check has no `id <> p_booking_id` guard (**D-B05**) |
| **Overbooking** | Seat count check in locked transaction | Only inside `confirm_trial_booking()`; create-time and webhook paths never lock (**L2**, **L3**) |
| **Payment Failure** | Booking marked `PAYMENT_FAILED` | Yes - but the UI sends `SUCCESS`/`FAILED`, which the schema rejects (**B3**) |
| **Last Seat Race** | `FOR UPDATE` row locking | **Unproven**: `concurrency.test.ts` mocks `supabase.rpc`; the real L4/L5 suites need a database (blocked, E2) |
| **Concurrent Payments** | Serialized by row lock | Same as above - lock exists only in the RPC path |

## Features Implemented

### Authentication
- Email/password login
- Magic link authentication
- Session management
- Route protection middleware
- Admin role checking

### Booking Flow
- 3-step booking process
- Parent/student selection
- Real-time seat availability
- Booking confirmation
- Status tracking

### Payment
- Mock payment simulation
- Stripe integration (optional)
- Payment intent creation
- Webhook handling
- Refund capability
- Payment history

### Email Notifications
- Booking confirmation emails
- Payment failure notifications
- 24-hour class reminders
- SMTP configuration

### Admin Dashboard
- Booking statistics
- Recent activity feed
- Booking management (search, filter, cancel)
- Class management (create, delete)
- Student management

> **Claims that do not hold yet** (details in `artifacts/fix_plan_sept_26.md`): *Admin role checking* and *Route
> protection middleware* do not cover the API (`/roster` and `/payments/history` are also unprotected);
> *Cancel booking* and *class create/delete* call endpoints that **do not exist** (B12); *Refund capability* has no
> caller and no auth (L4); *Payment history* always returns `[]` (B18); *Stripe checkout* is unreachable from the UI;
> *Booking confirmation emails* / *Payment failure notifications* / *24-hour reminders* are **never triggered by the
> booking flow** - only `/api/notifications` and `/api/notifications/send-reminders` send mail, neither has a caller
> or a cron job, and `sendEmail` reports success even with no SMTP configured (L6/L7/B19).

## Deployment

### Docker

```bash
# Start all services (app + PostgreSQL + Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The app will be available at `http://localhost:3000`.

### Vercel

1. Push to GitHub
2. Import repository on [vercel.com](https://vercel.com)
3. Configure environment variables
4. Deploy

```bash
# Or deploy with Vercel CLI
npm i -g vercel
vercel --prod
```

### Environment Variables for Production

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional
STRIPE_SECRET_KEY=your_stripe_key
PAYMENT_PROVIDER=mock # "mock" (PayMock) | "stripe"; resolves to "mock" unless STRIPE_SECRET_KEY is set outside tests
SENTRY_DSN=your_sentry_dsn
```

## Monitoring

### Sentry (Optional)

Add to `.env.local`:

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENPLOY_PROJECT=your-project
```

## AI Usage

This project was built with assistance from:
- **GitHub Copilot** - README, seed.sql, code completion
- **OpenCode with Mimo v2.5** - Full implementation, components, tests

See [artifacts/AI_USAGE.md](artifacts/AI_USAGE.md) for details.

## Color Scheme

| Color | Hex | Usage |
|-------|-----|-------|
| Yellow | `#faaf22` | Primary CTA |
| Red | `#e7344a` | Errors, full seats |
| Blue | `#69cce1` | Links, primary actions |
| Green | `#82c340` | Success, available seats |

## Documentation

- [Setup Guide](artifacts/setup.md)
- [Test Guide](artifacts/test.md)
- [API Documentation](artifacts/api.md)
- [AI Usage](artifacts/AI_USAGE.md)
- [Complete Plan](artifacts/complete_plan.md)
- [Sprint Breakdown](artifacts/todo_sprint_core.md)

## License

Private - Ottodot
