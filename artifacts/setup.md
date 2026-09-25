# OTTODOT Trial Booking System - Setup Guide

## Prerequisites

- **Node.js** 18+ (recommended: 20.x)
- **npm** 9+ or **yarn** 1.22+
- **Supabase Account** (free tier works) - [supabase.com](https://supabase.com)
- **Git**

---

## 1. Clone & Install

```bash
git clone https://github.com/your-username/OTTODOT_Trial_Booking_System.git
cd OTTODOT_Trial_Booking_System
npm install
```

---

## 2. Supabase Setup

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Enter project details:
   - **Name:** `ottodot-trial-booking`
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to your users
4. Click **"Create new project"**
5. Wait for project to be ready (~2 minutes)

### 2.2 Get API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Anon Public Key** (starts with `eyJ...`)

### 2.3 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `artifacts/seed.sql`
4. Paste into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Verify success: You should see "Success. No rows returned"

This creates:
- 5 tables (parents, students, trial_classes, bookings, payment_attempts)
- Indexes for performance
- Stored procedure `confirm_trial_booking`
- Seed data (2 parents, 3 students, 2 classes, 5 bookings, 1 payment attempt)

---

## 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** Never commit `.env.local` to git. It's already in `.gitignore`.

---

## 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Seed Data Overview

The database comes pre-loaded with this test data:

### Parents

| ID | Name | Email |
|----|------|-------|
| `AL-RES123-20260925` | ALICE LEE | alice@example.com |
| `BO-RES456-20260925` | BOB OLSEN | bob@example.com |

### Students

| ID | Name | Parent |
|----|------|--------|
| `CH-RES789-20260925` | CHARLIE LEE | ALICE LEE |
| `DA-RES321-20260925` | DAISY LEE | ALICE LEE |
| `ET-RES654-20260925` | ETHAN OLSEN | BOB OLSEN |

### Trial Classes

| ID | Class | Subject | Seats |
|----|-------|---------|-------|
| `MT-M-20261001T1000-4` | MATH TRIAL | MATH | 4 |
| `SC-S-20261002T1400-4` | SCIENCE TRIAL | SCIENCE | 4 |

### Bookings

| ID | Student | Class | Status |
|----|---------|-------|--------|
| `BOOKING001-20260925` | CHARLIE LEE | SCIENCE | CONFIRMED |
| `BOOKING002-20260925` | DAISY LEE | SCIENCE | CONFIRMED |
| `BOOKING003-20260925` | ETHAN OLSEN | SCIENCE | CONFIRMED |
| `BOOKING004-20260925` | CHARLIE LEE | SCIENCE | PENDING_PAYMENT |
| `BOOKING005-20260925` | ETHAN OLSEN | MATH | PAYMENT_FAILED |

### Booking Scenarios

1. **SCIENCE TRIAL:** 3 confirmed → 1 seat remaining
2. **MATH TRIAL:** 0 confirmed → 4 seats available
3. **Duplicate attempt:** CHARLIE has 2 bookings for SCIENCE (1 confirmed + 1 pending)
4. **Payment failure:** ETHAN has a failed payment for MATH

---

## 6. Alternative: Seed via API

If you need to re-seed the database, call the seed endpoint:

```bash
curl -X POST http://localhost:3000/api/seed
```

Or use the UI: Admin Dashboard → (button coming soon)

---

## 7. Verify Setup

### 7.1 Check Database Connection

Visit: [http://localhost:3000/api/trial-classes](http://localhost:3000/api/trial-classes)

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "MT-M-20261001T1000-4",
      "class_name": "MATH TRIAL",
      "subject": "MATH",
      "max_seats": 4,
      "confirmed_count": 0,
      "seats_remaining": 4
    },
    {
      "id": "SC-S-20261002T1400-4",
      "class_name": "SCIENCE TRIAL",
      "subject": "SCIENCE",
      "max_seats": 4,
      "confirmed_count": 3,
      "seats_remaining": 1
    }
  ]
}
```

### 7.2 Check Roster

Visit: [http://localhost:3000/api/roster/SC-S-20261002T1400-4](http://localhost:3000/api/roster/SC-S-20261002T1400-4)

Should show 3 confirmed students for SCIENCE TRIAL.

### 7.3 Check Frontend

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Book a Trial Class"
3. See trial classes with seat availability
4. Click "Book Now" on MATH TRIAL (4 seats available)
5. Fill in parent and student information
6. Complete mock payment
7. See booking confirmation

---

## 8. Troubleshooting

### "Failed to fetch trial classes"

- Check `.env.local` has correct Supabase URL and key
- Verify you ran `artifacts/seed.sql` in Supabase SQL Editor
- Check Supabase project is not paused (free tier limitation)

### "Table does not exist"

- Run the full `artifacts/seed.sql` in Supabase SQL Editor
- Make sure you ran it in the correct project

### Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

### WSL Performance Issues

If running on Windows WSL with files on `/mnt/d/`:
- Move project to WSL filesystem: `~/projects/OTTODOT_Trial_Booking_System`
- Tests may be slow on NTFS mounts

---

## 9. Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## 10. Project Structure

```
OTTODOT_Trial_Booking_System/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities, Supabase client, seed data
│   ├── types/            # TypeScript types & enums
│   └── __tests__/        # Jest tests
├── artifacts/            # Documentation & SQL
├── logo/                 # Ottodot logo
├── public/               # Static assets
├── jest.config.js        # Jest configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies & scripts
```
