# OTTODOT Trial Booking System

A minimal, working slice of a trial booking system for Ottodot's live online science and math classes for Primary 1-6 students.

## Overview

This system handles trial class bookings with focus on correctness under critical edge cases: duplicate bookings, overbooking, payment failures, and the last seat race condition.

**Key Features:**
- Book trial Math and Science classes
- Real-time seat availability tracking
- Mock payment processing
- Parent/student registration
- Admin dashboard with booking stats

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS with Ottodot brand colors |
| **Backend** | Next.js API Routes |
| **Database** | Supabase (PostgreSQL) |
| **Testing** | Jest, React Testing Library, SWC |
| **Deployment** | Vercel (ready) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  Home   │  │Bookings │  │ Roster  │  │ Admin   │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       │            │            │            │              │
│  ┌────┴────────────┴────────────┴────────────┴────┐        │
│  │              API Client Layer                   │        │
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
│   │   ├── bookings/
│   │   │   ├── page.tsx             # Trial class listing
│   │   │   └── [classId]/page.tsx   # 3-step booking flow
│   │   ├── roster/page.tsx          # Class roster view
│   │   ├── admin/page.tsx           # Admin dashboard
│   │   └── api/
│   │       ├── trial-classes/route.ts
│   │       ├── bookings/route.ts
│   │       ├── payments/confirm/route.ts
│   │       ├── roster/[class_id]/route.ts
│   │       └── seed/route.ts
│   ├── components/                   # React components
│   │   ├── Logo.tsx                 # Ottodot logo
│   │   ├── Header.tsx               # Navigation
│   │   ├── Footer.tsx               # Footer
│   │   ├── Button.tsx               # Reusable button
│   │   ├── Card.tsx                 # Card wrapper
│   │   ├── StatusBadge.tsx          # Booking status badge
│   │   ├── TrialClassCard.tsx       # Class listing card
│   │   ├── BookingForm.tsx          # Multi-step form
│   │   ├── MockPaymentForm.tsx      # Payment simulation
│   │   ├── BookingStatusDialog.tsx  # Status modal
│   │   ├── BookingConfirmation.tsx  # Confirmation view
│   │   ├── RosterTable.tsx          # Student roster
│   │   ├── BookingStats.tsx         # Admin statistics
│   │   └── RecentActivity.tsx       # Activity feed
│   ├── lib/
│   │   ├── supabase.ts              # Supabase client
│   │   ├── utils.ts                 # Utility functions
│   │   └── seed-data.ts            # Seed data constants
│   ├── types/
│   │   └── booking.ts               # TypeScript types & enums
│   └── __tests__/                   # Jest tests (65 tests)
├── artifacts/                       # Documentation
│   ├── seed.sql                     # Database schema
│   ├── setup.md                     # Setup guide
│   ├── test.md                      # Test guide
│   └── AI_USAGE.md                  # AI tool usage
└── logo/                            # Ottodot logo
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/OTTODOT_Trial_Booking_System.git
cd OTTODOT_Trial_Booking_System

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run database schema
# Copy artifacts/seed.sql to Supabase SQL Editor and run

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

For detailed instructions, see [artifacts/setup.md](artifacts/setup.md).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trial-classes` | List classes with seat counts |
| GET | `/api/bookings` | List all bookings |
| POST | `/api/bookings` | Create new booking |
| POST | `/api/payments/confirm` | Confirm payment |
| GET | `/api/roster/:class_id` | Get class roster |
| POST | `/api/seed` | Initialize seed data |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

**Test Suites:** 8 passed, 8 total
**Tests:** 65 passed, 65 total

For testing details, see [artifacts/test.md](artifacts/test.md).

## Seed Data

The system comes with pre-loaded test data:

- **2 Parents:** ALICE LEE, BOB OLSEN
- **3 Students:** CHARLIE LEE, DAISY LEE, ETHAN OLSEN
- **2 Trial Classes:** MATH TRIAL (4 seats), SCIENCE TRIAL (4 seats)
- **5 Bookings:** Various statuses for testing scenarios
- **1 Payment Attempt:** Failed payment for testing

See [artifacts/seed.sql](artifacts/seed.sql) for full schema and data.

## Edge Cases Handled

| Case | Handling |
|------|----------|
| **Duplicate Booking** | Unique constraint + RPC check |
| **Overbooking** | Seat count check in locked transaction |
| **Payment Failure** | Booking marked `PAYMENT_FAILED` |
| **Last Seat Race** | `FOR UPDATE` row locking |

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

## Time Spent

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Project Setup** | ~30 min | Next.js scaffolding, TypeScript config, Jest setup, folder structure |
| **Phase 2: Backend** | ~45 min | API routes (trial-classes, bookings, payments, roster, seed), Supabase integration, stored procedure |
| **Phase 3: Frontend** | ~60 min | 14 components, 4 pages, Ottodot branding, booking flow, mock payment |
| **Phase 4: Testing** | ~20 min | 8 test suites, 65 tests, SWC config, WSL optimization |
| **Phase 5: Documentation** | ~25 min | README, setup.md, test.md, AI_USAGE.md, 4hour_todo.md, 4hour_results.md |
| **Total** | **~3 hours** | Full working prototype with tests and documentation |

### Deliverables Summary

| Category | Count |
|----------|-------|
| Source Files | 30 |
| Components | 14 |
| API Routes | 5 endpoints |
| Pages | 4 |
| Test Suites | 8 |
| Tests | 65 (all passing) |
| Documentation Files | 8 |

## License

Private - Ottodot
