# OTTODOT Trial Booking System — QA Audit & Complete Refactor Plan

**Document:** `fix_plan_sept_26.md`
**Date:** September 26, 2026
**Author role:** IT QA / IT Architect / Full-stack / DevOps (per `artifacts/role.md`)
**Scope:** Full codebase review — bugs, runtime errors, dead code, API endpoints, wrong logic, incomplete syntax/build, type & enum drift, test & doc truth.
**Prepared from:** full read of `src/app`, `src/components`, `src/lib`, `src/types`, `src/__tests__`, `src/middleware.ts`, `artifacts/seed.sql`, `artifacts/api.md`, `README.md`, plus automated tooling.

---

## 0. Baseline Verification (measured, not assumed)

| Check | Command | Result |
|-------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ clean (0 errors) |
| Tests | `npx jest --ci` | ✅ 15 suites / 125 tests pass |
| Lint | `npx next lint` | ❌ 2 errors, 4 warnings |
| Build/Deploy | `next build` (CI env: only Supabase vars) | ⚠️ expected failure: `src/lib/stripe.ts:3-5` throws at import without `STRIPE_SECRET_KEY` |
| Docker | `docker build` | ⚠️ expected failure: `Dockerfile:44` copies `./public` which does not exist |

**QA headline: the pipeline is green while the product is broken.** `tsc` and Jest pass because (a) `tsconfig.json` has no `noUnusedLocals`, (b) `ApiResponse.error` is typed `string` while the server sends an object, so the mismatch is type-invisible, (c) `jest.config.js:30-36` excludes `src/**/page.tsx` from coverage — i.e. every P0 found below lives outside the 70% threshold — and (d) `concurrency.test.ts` mocks `supabase.rpc` then asserts the mock's own return value.

**Lint errors to fix immediately (blocking CI):**
- [P0] `src/__tests__/components/Header.test.tsx:14:10` — `react/display-name`
- [P0] `src/app/page.tsx:75:35` — `react/no-unescaped-entities` (`'` must be escaped)

**Lint warnings:**
- [P2] `src/app/bookings/[classId]/page.tsx:41`, `src/app/payments/history/page.tsx:40` — `react-hooks/exhaustive-deps`
- [P2] `src/app/page.tsx:10`, `src/components/Logo.tsx:15` — `@next/next/no-img-element`

### Severity definitions

| Level | Meaning |
|-------|---------|
| **P0** | Core flow broken / security hole / data corruption. Ship blocker. |
| **P1** | Feature non-functional or contradicts documented behavior. Fix before release. |
| **P2** | Dead code, inconsistency, polish, doc drift. Fix in cleanup sprint. |

---

## 1. Findings — Bugs & Runtime Errors (P0)

The primary user journey **create booking → pay → confirm → view confirmation is broken end-to-end by 5 independent defects**; any one of them is fatal.

| # | Sev | Location | Defect |
|---|-----|----------|--------|
| B1 | P0 | `src/lib/validations/booking.ts:3-54` vs `src/app/bookings/[classId]/page.tsx:68-77` | Client sends **flat** `CreateBookingRequest {parent_first_name, parent_email, parent_residential_id, student_residential_id…}` (`src/types/booking.ts:69-78`); server parses **nested** `{parent:{first_name,…,phone}, student:{first_name,last_name,grade}}`. `POST /api/bookings` → **400 on every UI submission**. |
| B2 | P0 | `src/components/BookingForm.tsx:6-14,156-201` | Form collects 7 fields; API requires `parent.phone` (required) and `student.grade` (int 1–6). Payload can never validate even with the correct envelope. |
| B3 | P0 | `src/lib/validations/booking.ts:61` vs `src/app/bookings/[classId]/page.tsx:109` + `MockPaymentForm.tsx:24` | Server: `z.enum(["success","failure"])`; client sends `"SUCCESS"/"FAILED"` (which is what the RPC compares at `seed.sql:210`). **`POST /api/payments/confirm` → 400 always.** |
| B4 | P0 | `src/lib/validations/booking.ts:56-62`, `src/app/api/bookings/[id]/route.ts:7-9`, `payments/create-intent/route.ts:7-9`, `payments/refund/route.ts:7-10` | `z.string().uuid()` on booking IDs that are `BOOKING001-20260925` / `BKG-001`. **Booking detail, Stripe intent, refund, payment confirm permanently 400.** |
| B5 | P0 | `src/lib/validations/booking.ts:7,78,91` | ID regex `^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$` matches only `lib/seed-data.ts` IDs (`MT-M-20261001T1000-4`) and **rejects every ID produced by `artifacts/seed.sql`** (`TRC-001`). With README's documented seed: create booking, `GET /api/roster/TRC-001`, `GET /api/bookings?trial_class_id=TRC-001` all → 400. `artifacts/api.md:100` uses `TRC-001` in its own example. |
| B6 | P0 | `src/app/api/roster/[class_id]/route.ts:49-57` | To-one embed cast to array: `booking.students as {...}[]; studentData[0]` → `undefined` → `student.id` throws → **500 on every roster request** (roster page dead). |
| B7 | P0 | `src/app/api/payments/create-intent/route.ts:51-60` | Same array-cast defect → **TypeError → 500 before Stripe is ever called.** |
| B8 | P0 | `src/types/booking.ts:108` (`error?: string`) vs `src/lib/errors.ts:114-127` (`error: {code,message,fields,statusCode}`) | Structured error object rendered as React child in `bookings/page.tsx:25,54`, `roster/page.tsx:37,83`, `bookings/[classId]/page.tsx:56,93,125,225` → **"Objects are not valid as a React child" crash on any API error**; `admin/*.tsx:41` do `new Error(data.error)` → `"[object Object]"`. |
| B9 | P0 | `src/middleware.ts:60-68` | Admin gate: `.from("parents").eq("id", user.id)` — `user.id` is the auth **UUID**, `parents.id` is TEXT (`PAR-001`), and **signup never inserts a `parents` row** (`lib/auth/client.ts:56-61`). `profile` is always `null` → **`/admin` is unreachable by everyone**, including the seeded admin. |
| B10 | P0 | `src/middleware.ts:84-90` | Matcher covers only `/admin`, `/bookings`, `/auth` — **no `/api/*` route is authenticated anywhere** (grep for `getUser|getSession` in `src/app/api` = 0 hits). See §3. |
| B11 | P0 | `src/app/admin/bookings/page.tsx:52-59,195-209` | Reads `booking.students.first_name` / `booking.trial_classes.class_name`, but `GET /api/bookings` does `select("*")` with no joins (`api/bookings/route.ts:42-45`) → **TypeError → error boundary** on first render. |
| B12 | P0 | `src/app/admin/bookings/page.tsx:68` | Calls `POST /api/bookings/[id]/cancel` — **route does not exist** (only `GET`). Cancel always 404. Contradicts `README.md:329`, `artifacts/api.md:419`. |
| B13 | P0 | `src/app/admin/classes/page.tsx:58,91` | Calls `POST /api/trial-classes` and `DELETE /api/trial-classes/[id]` — **neither exists** (GET-only route). Create/Delete class always 405/404. Contradicts `README.md:330`. |
| B14 | P0 | `src/app/bookings/[classId]/confirmation/page.tsx:37-44,82-83` | Fetches `/api/bookings/${id}` (400s per B4) and reads `booking.students`/`trial_classes` that the route never returns → dead confirmation page. |
| B15 | P0 | `src/app/bookings/[classId]/payment/page.tsx:19,30` | Passes the **route param `classId`** as `booking_id` to `create-intent` (`/bookings/TRC-001/payment` → `{booking_id:"TRC-001"}`) — semantic ID mix-up. |
| B16 | P1 | `src/lib/stripe.ts:3-5` | `throw` at **module load** when `STRIPE_SECRET_KEY` unset, though README/`.env.local.example:7` call Stripe optional → 3 routes fail at import; CI `next build` fails. |
| B17 | P1 | `src/app/api/payments/webhook/route.ts:49-55,69-84` | Inserts into `payment_attempts` **without `id`** but `id TEXT PRIMARY KEY` has no default (`seed.sql:111`) → NOT NULL violation, only `console.error`'d, then **returns `200 {success:true}`**. Stripe attempt records never persisted. |
| B18 | P1 | `src/app/api/payments/history/route.ts:7,14,20` | Validates `user_id` as UUID, queries `.eq("student_id", user_id)` where the page passes the auth UUID and `students.id` is `STU-001` → **always returns `[]`** (payment history feature dead). |
| B19 | P1 | `src/app/api/notifications/send-reminders/route.ts:37-39` | Filters embedded `trial_classes.*` **without `!inner`** → PostgREST rejects/mis-filters → wrong set or 500; reminders cannot work as documented. |
| B20 | P2 | `src/app/api/bookings/route.ts:143-149`, `trial-classes/route.ts:27-36` | Seat-count `error` never checked; on DB/RLS error `count=null` → `seatsRemaining = max_seats` → **seat guard silently bypassed**. |

---

## 2. Findings — Wrong Logic

| # | Sev | Location | Defect |
|---|-----|----------|--------|
| L1 | P0 | `src/app/api/bookings/route.ts:119-124,135` | Student lookup filters `.eq("residential_id", student.grade.toString())` — **siblings/peers with same grade are conflated**: booking for child B attaches to child A's `student_id` (silent wrong-child booking), and `grade` is persisted into `residential_id` (destroys the RES id), while `grade`/`email` columns are never written. Also structural PK collisions (`generateSmartId` = initials+residentialId+date, no retry) → 500. |
| L2 | P0 | `src/app/api/payments/webhook/route.ts:40-43,69-72` | Webhook sets `bookings.status='CONFIRMED'` **directly, bypassing `confirm_trial_booking`** → no `FOR UPDATE` lock, no seat count, no duplicate check, no status guard. Overbooking (5 on 4 seats), duplicate confirm, and re-confirming a `CANCELLED` booking are all possible; failures swallowed while Stripe gets 200. `payment_failed` clobbers `CONFIRMED` on out-of-order delivery. |
| L3 | P1 | `src/app/api/bookings/route.ts:143-165` | No duplicate check at creation (only `CONFIRMED` rows are unique per `seed.sql:99-101`) → N `PENDING_PAYMENT` rows for same (student, class); each payment can succeed → unique index rejects confirmations → **customer charged, booking stuck**. Also TOCTOU: count and insert are separate round-trips, pending rows reserve nothing → last seat can be paid for and then fail (`NO_SEATS_AVAILABLE` → `PAYMENT_FAILED`, no refund path). |
| L4 | P1 | `src/app/api/payments/refund/route.ts:43-56,75-81` | Refund passes `payment_attempts.txn_id` (our synthetic `TXN-<ts>-<rand>`) to `stripe.refunds.create({payment_intent})` → always throws; then records the refund as a **`SUCCESS` payment attempt** with a `re_…` id, corrupting the ledger. Refunds broken end-to-end. |
| L5 | P1 | `src/app/api/payments/confirm/route.ts:71-74,87-103` | RPC returns `DUPLICATE_BOOKING`/`NO_SEATS_AVAILABLE` while **writing `PAYMENT_FAILED` to the row** (`seed.sql:197-219`); route casts `data as BookingStatus` → dialog shows one status, subsequent GET shows another. `data: null` → returns `200 {status: null}`. |
| L6 | P1 | `src/app/api/notifications/send-reminders/route.ts:9-14` | "Tomorrow" window computed in server-local time then `toISOString()` (UTC) against `+08` class times → **off by the host offset** (wrong-day or missed reminders). Same class of bug: `src/lib/email-templates.ts:15-30,193-203` and `src/lib/utils.ts:59-73` format dates **without `timeZone`** → emails show wrong class time (verified: `2026-10-01T10:00+08` renders 02:00 on a UTC host). |
| L7 | P1 | `src/lib/email.ts:22-27` | No SMTP config → `sendEmail` returns `true` → `POST /api/notifications` reports `email_sent: true` for **emails never sent** (silent false positive). |
| L8 | P1 | `src/lib/email-templates.ts:66-94,152-169,237-264` | DB/user values interpolated into HTML unescaped → injection into emailed content. |
| L9 | P2 | `src/app/api/trial-classes/route.ts:36`, `roster/[class_id]/route.ts:60` | `seats_remaining = max_seats - confirmed` not clamped → negative values (progress bar >100%) or `NaN%` when `max_seats=0`; clamping util `getSeatsRemaining` (`lib/utils.ts:35`) exists but is dead. N+1 count query per class (`:25-39`). |
| L10 | P2 | `src/app/admin/classes/page.tsx:26,73,195` | Subjects sent as `"Math"` but DB CHECK requires `'MATH'|'SCIENCE'` (`seed.sql:57`) → insert would fail even if the route existed; badge predicate `=== "Math"` never true. |
| L11 | P2 | `src/app/api/bookings/route.ts:107` | `residential_id: parent.phone` — phone stored as residential id; generated parent ids embed raw phone (`AL-+65 1234-20260926`). |
| L12 | P2 | `src/app/api/seed/route.ts` vs `artifacts/seed.sql` | **Two incompatible seed datasets** (2 vs 3 parents, 3 vs 4 students, `MT-M-…` vs `TRC-001`, `BKG-001` vs `BOOKING001-…`); running both → email unique conflict → seed route 500. Only one of them satisfies the validation regexes. |
| L13 | P2 | `src/app/auth/callback/route.ts:4-18` | No try/catch; `next` param used unvalidated → **open redirect**; contradicts `4hour_results.md:43` "Error handling included in all API routes". |
| L14 | P2 | `src/app/api/notifications/send-reminders/route.ts:76-87` | No reminder dedup (no `reminders_sent`/`last_reminder_at`) → double-call sends duplicates to every parent. |
| L15 | P2 | `src/app/globals.css:5` | `@import url(...)` placed **after** `@tailwind` directives → ignored by browsers, documented Nunito/Open Sans fonts never load. |

---

## 3. Findings — API Endpoints (claimed vs reality)

### 3.1 Endpoint inventory

| Endpoint | On disk | Called by UI | Auth claimed (`README.md:218-232`) | Auth implemented | Status |
|---|---|---|---|---|---|
| GET `/api/trial-classes` | ✅ | ✅ | No | n/a | ⚠️ works, unchecked seat-count errors, N+1 |
| GET `/api/bookings` | ✅ | ✅ | Admin | ❌ none | ❌ no joins → admin page crash (B11) |
| POST `/api/bookings` | ✅ | ✅ | Yes | ❌ none | ❌ 400 (B1) + wrong-child logic (L1) |
| GET `/api/bookings/[id]` | ✅ | ✅ | Yes | ❌ none | ❌ 400 uuid (B4) |
| POST `/api/payments/confirm` | ✅ | ✅ | Yes | ❌ none | ❌ 400 casing (B3); no payment proof check |
| POST `/api/payments/create-intent` | ✅ | ⚠️ (unreachable page) | Yes | ❌ none | ❌ 500 (B7) / 400 (B4) / import-throw (B16) |
| POST `/api/payments/webhook` | ✅ | Stripe | No (signature) | ✅ sig | ❌ bypasses RPC (L2), insert fails (B17) |
| POST `/api/payments/refund` | ✅ | **no caller** | Admin | ❌ none — **unauthenticated money movement** | ❌ broken (L4) |
| GET `/api/payments/history` | ✅ | ✅ | Yes | ❌ none | ❌ always `[]` (B18) |
| GET `/api/roster/[class_id]` | ✅ | ✅ | Yes | ❌ none | ❌ 500 (B6) |
| POST `/api/notifications` | ✅ | **no caller** | Admin | ❌ none — anon bulk email | ⚠️ reports false success (L7) |
| POST `/api/notifications/send-reminders` | ✅ | **no caller** (no cron) | Admin | ❌ none | ❌ wrong filter (B19) |
| POST `/api/seed` | ✅ | ✅ | No | ❌ none — anon destructive upsert | ⚠️ no rate limit despite `api.md:431` |
| GET `/api/admin/students` | ✅ | ✅ | Admin (api.md) | ❌ none — PII dump | ⚠️ also missing from README table; cacheable (no `dynamic`) |

**Missing endpoints called/documented:**
- [P1] `POST /api/bookings/[id]/cancel` — `admin/bookings/page.tsx:68`, `README.md:329`, `api.md:419`
- [P1] `POST /api/trial-classes`, `DELETE /api/trial-classes/[classId]` — `admin/classes/page.tsx:58,91`, `README.md:330`
- [P2] `GET /api/sitemap` — `vercel.json:42-43` rewrite target, no route → 404 in prod
- [P2] Rate limits (10/hr, 1/hr) — `api.md:425-431`; `RateLimitError` exists (`errors.ts:101-110`) but is never thrown; no limiter in `src`
- [P2] `401/403/429` responses — documented `api.md:404-408`, **never returned by any route**

### 3.2 Auth & security (cross-cutting)

- [P0] **No API route performs authentication or authorization** — README's Auth column (11 rows) is aspirational. Highest risk: `payments/refund` (money), `seed` (destructive write), `notifications` (email abuse), `admin/students` (student PII), `payments/confirm` (anyone can confirm any booking).
- [P0] **No RLS policies** in `seed.sql`; server uses the browser-exposed **anon key** (`src/lib/supabase.ts:3-6`) → anyone can read/write every table via PostgREST directly, bypassing the API. `SUPABASE_SERVICE_ROLE_KEY` documented but never used.
- [P1] `vercel.json:26` — `Access-Control-Allow-Origin: *` on all `/api/*` combined with cookie auth = cross-site credentialed calls from any origin.
- [P1] `src/middleware.ts:40` — `/roster` and `/payments/history` unprotected; `/roster` publicly exposes confirmed student names, IDs and emails (`RosterTable.tsx:82-88`) via the home page link.
- [P1] Signup creates an auth user but **no `parents` row** → no profile, no admin, no FK target for bookings created post-signup (`bookings/route.ts` has a find-or-create fallback that writes garbage ids — see L1).
- [P2] `middleware.ts:40` `startsWith("/bookings/")` leaves bare `/bookings` unprotected (inconsistent with matcher).
- [P2] `middleware.ts:54` sets `?next=` but `auth/login/page.tsx:32` always pushes `/bookings` — return-to-target flow dead.

---

## 4. Findings — Dead Code

### 4.1 Dead files & barrels (zero importers)
- [P1] `src/lib/index.ts`, `src/types/index.ts`, `src/components/index.ts` — barrels never imported anywhere.
- [P1] `src/components/Skeleton.tsx` — all 8 skeletons unused (contradicts "Loading skeletons ✅" in `todo_sprint_core.md:565`); not even re-exported by the barrel.
- [P1] `src/components/Card.tsx` — used only by its own test.
- [P1] `src/app/bookings/[classId]/payment/page.tsx` — no inbound link anywhere → Stripe payment flow unreachable by clicking; `StripePaymentForm`/`getStripe` dead in practice.

### 4.2 Dead exports (definition-only)
- [P1] `src/lib/utils.ts:3,7,15,25,35,42,59,68` — all 8 helpers imported only by `utils.test.ts`.
- [P1] `src/lib/auth/client.ts:74-77` `signOut()` never called → **no logout control in the UI** (Header has Home/Book/Roster/Admin only).
- [P1] `src/lib/auth/server.ts:34,42,50` — `getSession`, `getUser`, `signOut` never imported (middleware builds its own client).
- [P2] `getSupabaseClient` (`supabase.ts:8`), `BookingError`, `RateLimitError`, `handleApiError` (export-only), `useSupabase` (internal only).
- [P1] `src/types/booking.ts:16-23,25-32,34-41,56-59,61-67` — `Parent`, `Student`, `TrialClass`, `BookingWithStudent`, `PaymentAttempt` never imported (pages re-declare local copies → drift, see §6).
- [P2] `src/lib/validations/booking.ts:94-98` — 5 `*Input` types never imported; `parent_email` query param validated but never used by `GET /api/bookings`.

### 4.3 Dead imports / locals (invisible: no `noUnusedLocals`)
- [P2] `api/bookings/route.ts:5,6,14-20` — `CreateBookingRequest`, `ApiResponse`, `ValidationError`; `api/bookings/[id]/route.ts:3,5` — `ApiResponse`, `DatabaseError`; `api/trial-classes/route.ts:3`; `api/roster/[class_id]/route.ts:3`; `api/payments/confirm/route.ts:6,7`.
- [P2] `useRouter()` unused in `bookings/[classId]/page.tsx:4,23`, `confirmation/page.tsx:4,28`, `auth/signup/page.tsx:4,10`.
- [P2] `package.json` — `@react-email/render`, `ts-jest`, `ts-node` declared, never used (Jest uses `@swc/jest`).
- [P2] `.env.local.example:20-22` Sentry vars — **zero Sentry code** in `src`; `SUPABASE_SERVICE_ROLE_KEY` never read.
- [P2] `ErrorBoundary.tsx:7-8` — `fallback`/`onError` props never passed.

### 4.4 Dead features & duplicates
- [P1] Notifications/refund routes have **no frontend caller and no cron** (`vercel.json` has no schedules) → README features "Email notifications", "Refund capability" are backend-only and unreachable.
- [P2] `admin/bookings/page.tsx:159` links `?studentId=…` — no page ever reads `useSearchParams` (0 hits) → filter dead. Same: `roster?classId=` (`admin/classes/page.tsx:242`) ignored by `roster/page.tsx:15-23`.
- [P2] Duplicate `formatDate/formatTime` in `lib/email.ts:45-59` ≡ `lib/utils.ts:59-73`; duplicate seat-status logic in `TrialClassCard.tsx:24-30` ≡ `lib/utils.ts:42-57`; duplicate brand text in `Footer.tsx:9-12` ≡ `Logo.tsx:20-24`; two error UIs (`app/error.tsx` + `ErrorBoundary`); two seed datasets (`lib/seed-data.ts` vs `seed.sql`).
- [P2] `admin/bookings/page.tsx:219` "View" links `/bookings/${booking.id}` — that route expects a **class** id → "Class not found".

---

## 5. Findings — Incomplete Syntax, Build & Config

| Sev | Location | Defect |
|-----|----------|--------|
| P0 | `src/__tests__/components/Header.test.tsx:14`, `src/app/page.tsx:75` | **Lint errors fail CI** (`react/display-name`, `react/no-unescaped-entities`) |
| P1 | `Dockerfile:44`, `docker-compose.yml:26` | Copies/mounts `./public` — **directory does not exist** → Docker build fails; logo 404s (`/logo.webp` referenced by `Logo.tsx`, `page.tsx:10`) |
| P1 | `vercel.json:42-43` | Rewrite `/sitemap.xml → /api/sitemap` — route missing → 404 |
| P1 | `.github/workflows/ci.yml` build env | Only Supabase vars set → `next build` hits `stripe.ts:3-5` module-load throw (B16) → CI build red |
| P1 | `src/lib/stripe.ts:3-5` | Module-load `throw` instead of lazy init (Stripe declared "optional") |
| P2 | `src/app/globals.css:5` | `@import` after `@tailwind` → ignored (L15) |
| P2 | `src/app/api/admin/students/route.ts:5` | `GET()` with no request access → Next 14 caches by default; needs `export const dynamic = "force-dynamic"` |
| P2 | `src/lib/email-templates.ts:100,166` | Hardcoded `http://localhost:3000` links in production emails |
| P2 | `src/components/StripePaymentForm.tsx:69,114`, `payments/history/page.tsx:160`, `create-intent/route.ts:11`, `bookings/[classId]/page.tsx:206` | Price hardcoded **4 different ways** (`$20.00` ×3, `2000` cents, `FREE`) |
| P2 | Missing `loading.tsx` anywhere | Every navigation blocks on client fetch |

---

## 6. Findings — Type & Enum Drift

| Sev | Location | Defect |
|-----|----------|--------|
| P0 | `src/types/booking.ts:1-8` vs `seed.sql:92-93` | DB CHECK allows `PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, CANCELLED, REFUNDED`. Enum **adds** `DUPLICATE_BOOKING`/`NO_SEATS_AVAILABLE` (RPC *return codes*, not storable), **omits `REFUNDED`** (which `refund/route.ts:67` writes). |
| P1 | `lib/validations/booking.ts:73` | `BookingQuerySchema.status` accepts `COMPLETED` (exists nowhere) and the enum's real members are inconsistent → filter can never match. |
| P1 | `types/booking.ts:105-109` | `ApiResponse.error?: string` contradicts `errors.ts` object shape **and** the string-shape routes (`seed`, `notifications`, `create-intent`, `webhook`) → root cause of B8. |
| P1 | `types/booking.ts:56-59` | `BookingWithStudent.students: Student` (object) but `roster` & `create-intent` cast to **array**, `notifications/route.ts:55-57` treats as object → codebase internally contradictory about PostgREST cardinality; ≥1 site guaranteed to read `undefined`. |
| P1 | `types/booking.ts:25-32,34-41,61-67` | `Student` omits `email/grade`; `TrialClass` omits `end_time/location/class_id`; `PaymentAttempt` omits `amount/currency/payment_method` → pages re-declare local types: `admin/students/page.tsx:12` `grade: number` renders **"PP4"** (`:146-149`) and `:49` `student.email.toLowerCase()` crashes on nullable email. |
| P1 | `types/booking.ts:69-78` vs `validations/booking.ts:3-54` vs `4hour_results.md:148` | Flat vs nested request — **three documents, two shapes**. |
| P2 | `types/booking.ts:80-83` | `payment_result: string` hides the three vocabularies (`"SUCCESS"` page / `"success"` schema / `'SUCCESS'` SQL). |
| P2 | Mixed conventions | `bookings/route.ts` uses `BookingStatus.*`; `webhook/refund` use raw literals; `trial-classes:31`, `send-reminders:37` hardcode `"CONFIRMED"`. |

---

## 7. Findings — Test & Documentation Truth

| Sev | Claim | Reality |
|-----|-------|---------|
| P0 | `concurrency.test.ts` proves race-condition safety ("Concurrency tests ✅", `todo_sprint_core.md:510`) | All 10 tests **mock `supabase.rpc` then assert the mock's return**; RPC, locks, seat counting never executed |
| P0 | Coverage gate 70% (`jest.config.js:38-45`) | `collectCoverageFrom` **excludes `src/**/page.tsx`** — all P0 bugs live outside the gate |
| P1 | "12 suites / 110+ tests" (`README.md:167,266-267`, `complete_plan.md:153-158`, `4hour_results.md:6-7`) | **15 suites / 125 tests** (own `4hour_results.md:11-27` table lists 15) — **corrected 2026-09-29 to 40 suites / 529 tests (445 pass / 84 todo); `4hour_results` kept as a dated snapshot with a pointer to the current numbers** |
| P1 | `test.md:13-14` "8 suites / 65 tests" | Lists only a subset; omits 7 suites — **corrected 2026-09-29: §1 expected output + a full 40-suite inventory table** |
| P1 | `test.md:54` "BookingStatus matches seed.sql" | Test asserts the enum **against itself**; `seed.sql` never read — and they don't match (§6) — **doc corrected 2026-09-29; the mismatch itself is pinned by `BK-UT-011` and still open (§6)** |
| P1 | `routes.test.ts:21-75` | Only `expect(route.GET).toBeDefined()` — **zero request/response assertions**; none of B1–B7 can fail CI |
| P1 | Zero suites exist for | ~~`lib/errors`, `lib/email`, components `BookingConfirmation, BookingStats, ErrorBoundary, Footer, RecentActivity, Skeleton, StripePaymentForm`~~ **added 2026-09-29 (9 suites / 62 tests)**; ~~`lib/email-templates`, routes `history/create-intent/refund/webhook/notifications/send-reminders/admin-students`, wrong-dataset `seed-data.test.ts`~~ **added the same day (5 suites / 81 tests + 5 L12 drift tests)**. `auth/callback` already had `auth/callback.test.ts` (15 tests) and `lib/validations` is covered indirectly by `bookingSchema.test.ts` → **the list is now fully tested** |
| P1 | `seed-data.test.ts:8-54` asserts `2 parents / AL-… ids` | `README.md:273-285` says `seed.sql` (3 parents / `PAR-001`) is pre-loaded → green test against the wrong dataset — **drift now pinned 2026-09-29 by an L12 block in the same file that reads `artifacts/seed.sql` and asserts counts, ids, emails and the id-regex split** |
| P1 | `test.md:171-201` curl examples | Both documented bodies (flat booking, `payment_result:"SUCCESS"`) return **400** against real schemas |
| P2 | `4hour_results.md:35-43` deliverables | "Smart IDs in seed.sql" (seed.sql uses `PAR-001` sequential), "Class A/B scenarios" true only for `lib/seed-data.ts`, "error handling in all routes" false for `auth/callback` |
| P2 | `BookingStatusDialog.test.tsx:117-129` | Backdrop assertion wrapped in `if (backdrop)` → passes vacuously; no test for unknown-status crash (`statusConfig[status]`, `:80`) — **fixed 2026-09-29: backdrop asserted non-null before the click, `fallbackConfig` added to `BookingStatusDialog`, unknown-status (`REFUNDED`) test added (14 tests)** |

### Documentation corrections required (same sprint as code)
**Corrected 2026-09-29:** `README.md` (suite counts, Auth column note, edge-case reality table, features reality note) · `artifacts/api.md` (auth paragraph, error envelope + B8 note, create/get examples, `TRC-001`→`MT-M-…`, status-code reality, rate-limit reality, admin-students note) · `artifacts/test.md` (expected output, 40-suite inventory, `test.md:54` claim, create/confirm/race curl bodies, coverage table — gate met 88.46/80.76/89.72/89.36) · `artifacts/4hour_results.md` (dated-snapshot note + deliverable caveats + flat-body correction) · `artifacts/complete_plan.md` (test table) · `artifacts/todo_sprint_core.md:510` (concurrency claim corrected).
**Still open:** `README.md` line references that moved, `artifacts/api.md` endpoint-by-endpoint auth column for the *missing* endpoints (cancel / class CRUD / sitemap), `artifacts/4hour_results.md:119-131,148` tree/skeleton claims, `artifacts/todo_sprint_core.md:565`, `artifacts/test.md:218` roster numbers (seed-dependent)..

---

## 8. Findings — Accessibility (vs. `complete_plan.md:167` "a11y ✅")

- [P1] `BookingStatusDialog.tsx:82-111` and create-class overlay `admin/classes/page.tsx:263-286` — no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape, focus restore.
- [P1] `BookingForm.tsx:94-143,159-201`, `MockPaymentForm.tsx:59-92`, `admin/classes/page.tsx:272-366` — labels lack `htmlFor`/`id`; no `<form>` element → native `required`/`type=email` validation never runs.
- [P1] Error messages never announced (`<p>` without `role="alert"`/`aria-live`); inputs lack `aria-invalid`/`aria-describedby`; spinners decorative without `role="status"` (9 pages).
- [P1] Tables lack `<caption>`/`scope="col"` (5 tables incl. `RosterTable.tsx:55-68`).
- [P1] Search inputs have placeholder-only accessible names (`admin/bookings:125-131`, `admin/students:92-98`).
- [P1] **Contrast fails WCAG AA**: white on `#faaf22` ≈1.9:1, `#69cce1` ≈1.8:1, `#82c340` ≈2.1:1 (`globals.css:42-56`); `text-ottodot-yellow` on white for "1 seat left" ≈1.9:1 (`globals.css:83-85`).
- [P2] `admin/bookings:136-147` filter toggles lack `aria-pressed`; destructive actions use native `confirm()`/`alert()`; `TrialClassCard:90-103` progress bar lacks `role="progressbar"`; `admin/page.tsx:77-87` nests `<Button>` inside `<Link>`.
- **What genuinely exists** (keep): skip link (`layout.tsx:29-34`), `:focus-visible` (`globals.css:25-27`), reduced-motion/high-contrast blocks (`:132-151`), `aria-busy`/`aria-disabled` on Button, labelled hamburger + `aria-current` nav, auth-form `htmlFor` pairs.

---

## 9. Root-Cause Analysis

| Root cause | Findings it explains | Structural fix |
|---|---|---|
| **RC1 — No single source of truth for the API contract.** Three competing shapes (flat type, nested Zod, flat doc) and 3 competing ID formats (uuid schema, `MT-M-…` regex, `TRC-001` seed). | B1–B5, B14, §6, test.md curl 400s | Zod schema is the **only** contract: `type X = z.infer<…>`; types and docs generated/derived from it; contract tests pin it. |
| **RC2 — No auth/authz layer at all.** Middleware is page-only; API trusts everyone; no link between auth user and `parents` row. | B9, B10, §3.2 | `requireUser()`/`requireAdmin()` helpers in every route + middleware matcher includes `/api/*` + `parents.auth_user_id` linkage + RLS. |
| **RC3 — Two write paths to `bookings.status`.** RPC (safe) and direct `UPDATE` (webhook/refund). | L2, L3, L5 | **All** status transitions go through `confirm_trial_booking` (extend RPC for cancel/refund) — DB is the only place invariants live. |
| **RC4 — PostgREST cardinality guessed, not known.** To-one embed cast to array in 2 routes, object in 1, type says object. | B6, B7, §6 | Typed select helpers + one shared `mapBookingWithJoins()`; integration test against real PostgREST. |
| **RC5 — Tests verify mocks, docs verify hopes.** | §7, baseline | Contract + integration tests replacing mock-assertions; docs generated from actual run output; coverage includes `page.tsx`. |
| **RC6 — Identity model broken.** Phone-as-residential-id, grade-as-residential-id, no signup→`parents` row, no auth-user→student mapping. | L1, L11, B18, B9 | Canonical ID scheme + `auth_user_id` FK + booking history resolved via parent linkage. |

---

## 10. Refactor Plan — Target State

**Design decisions (fix once, apply everywhere):**

1. **Contract:** `src/lib/validations/booking.ts` is authoritative. All request/response types are `z.infer`. Delete `CreateBookingRequest`/`ConfirmPaymentRequest` flat types or regenerate them from the schemas. Response envelope = one shape only:
   `{ success: true, data: T } | { success: false, error: { code, message, fields?, statusCode } }` — typed as a discriminated union in `src/types/booking.ts`; client helper `getApiErrorMessage(err): string` used by every page (kills B8).
2. **IDs:** one format per entity, documented and regex-validated by one shared `IdSchema` factory (accept `TRC-001` **and** generated smart IDs; **never** `.uuid()`). Seed data unified: `artifacts/seed.sql` is canonical; `lib/seed-data.ts` must match it exactly or be deleted.
3. **Status model:** `BookingStatus` = exactly the DB CHECK set (`PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, CANCELLED, REFUNDED`). New type `BookingRpcResult = BookingStatus | 'DUPLICATE_BOOKING' | 'NO_SEATS_AVAILABLE'` for RPC codes; `confirm` route maps result → `{status, code}` explicitly (kills L5). No raw status literals outside `types/booking.ts`.
4. **Write path:** every transition `PENDING_PAYMENT → CONFIRMED | PAYMENT_FAILED` and `CONFIRMED → CANCELLED | REFUNDED` executes `confirm_trial_booking` (extend it with `p_action: 'CONFIRM'|'CANCEL'|'REFUND'`). Webhook becomes a thin adapter.
5. **Auth:** `src/lib/auth/guard.ts` exporting `requireUser()`, `requireAdmin()` used by every route handler; middleware matcher `("/api/:path*", "/admin/:path*", "/bookings/:path*")`; `parents.auth_user_id UUID` column + signup upserts the profile; middleware resolves admin via `auth_user_id`. Server Supabase client uses service role (env-only) **after** RLS is enabled with policies.
6. **Embeds:** one `src/lib/selects.ts` with typed `bookingsWithJoins` select strings; helpers `toOne<T>(v)` / `toList<T>(v)` that normalize PostgREST shapes and null-guard.
7. **Money:** `payment_attempts.id` always generated server-side; `txn_id` stores the real Stripe `payment_intent` (webhook is the source); refunds use that id; history resolves `student_id` through the parent's auth linkage. Price from one constant/DB row (`TRIAL_CLASS_PRICE`).
8. **Errors:** all routes use `createErrorResponse`/`handleApiError`; malformed JSON → 400; Stripe errors mapped by `stripe.type`; `401/403/429` become real.
9. **Docs are outputs, not inputs:** test counts, endpoint tables and curl examples verified by a `npm run docs:verify` checklist (manual OK) in the final sprint.

---

## 11. Sprints (Fix Sprints F1–F8)

> Each sprint: **Goal → Todos → Exit gate**. Findings closed are listed for traceability. Estimates assume 1 dev + AI pair; durations are working days.

### Fix Sprint F0 — Guardrails & Red Tests (0.5 d)
**Goal:** make the failures visible to CI before changing behavior.
- [ ] Fix the 2 lint errors (`Header.test.tsx:14` display-name, `page.tsx:75` unescaped `'`) and the 4 warnings
- [ ] Write **failing contract tests** that reproduce B1–B7: booking-create payload, payment confirm casing, booking-id schema, ID regex vs `TRC-001`, roster embed shape, create-intent embed shape
- [ ] Write a test asserting the error envelope union (B8) and one asserting `BookingStatus` values vs a checked-in copy of the `seed.sql` CHECK list
- [ ] Turn on `noUnusedLocals`/`noUnusedParameters` in `tsconfig.json` (fix fallout in F6, but surface it now)
- [ ] Add `docs/claims.md` list of every numeric/doc claim to be corrected in F8
- [ ] Record baseline: `tsc`, `jest`, `lint`, `next build`, `docker build` outputs committed to `artifacts/qa_baseline_sept_26.md`
- **Exit gate:** new tests fail for the right reason (red), baseline recorded, lint green.

### Fix Sprint F1 — Contract & Validation (P0) (1 d)
**Goal:** every request the UI sends validates on the server. Closes B1, B2, B3, B4, B5, B14(partial), §6 shape/ID rows.
- [ ] Decide canonical booking-create shape: **nested** (matches Zod + `api.md`) — update `types/booking.ts:69-78` to `z.infer<CreateBookingSchema>`
- [ ] Add `phone` (required) and `grade` (select 1–6) fields to `BookingForm.tsx`; add real `<form>` + `htmlFor`/`id` while touching it
- [ ] Unify `payment_result`: schema `z.enum(["SUCCESS","FAILED"])` (matches UI + RPC SQL) and update `ConfirmPaymentSchema`; type it in `ConfirmPaymentRequest` — **decided D1 in `payment_mockup.md` §6.1, implemented in M1 (lowercase tolerance kept for one release)**
- [ ] Replace every `z.string().uuid()` on business ids with shared `IdSchema`s (`bookingId`, `trialClassId`, `studentId`, `parentId`) that accept seed + generated formats — **payment-path half decided D2 / implemented in M1 (`src/lib/payments/id.ts`); `trialClassId`/`studentId`/`parentId` + `CreateBookingSchema` (B5) remain F1**
- [ ] One ID regex/format decision documented in `api.md`; make `seed.sql`, `lib/seed-data.ts`, `api.md:100` examples agree
- [ ] Fix `BookingQuerySchema.status` to the DB CHECK set (drop `COMPLETED`)
- [ ] `ApiResponse` → discriminated union; add `getApiErrorMessage()`; use it in all 10 pages that render `error` (B8) — **payment-route half decided D3 in `payment_mockup.md` §6.1 (all five payment routes use `createErrorResponse` from M1); client-side union + 10 pages remain F1**
- [ ] Wrap all `request.json()` in try/catch → 400 `VALIDATION_ERROR` (8 routes)
- **Exit gate:** F0 contract tests green; `POST /api/bookings` + `POST /api/payments/confirm` succeed from the real UI against real seed data.

### Fix Sprint F2 — Data Access & Joins (P0/P1) (1 d)
**Goal:** every query returns what callers expect; no 500s from shape assumptions. Closes B6, B7, B11, B18(partial), B20, L9, L10.
- [ ] Create `src/lib/selects.ts` with typed select strings for bookings+student+class
- [ ] Fix `roster/[class_id]/route.ts:49-57` (object embed, null guard, clamp seats)
- [ ] Fix `payments/create-intent/route.ts:51-60` (object embed) — and pass real `booking_id`, not `classId` (B15)
- [ ] `GET /api/bookings` + `GET /api/bookings/[id]`: return joined `students`/`trial_classes` so admin & confirmation pages work (B11, B14); document the shape in `api.md`
- [ ] `GET /api/admin/students`: add `export const dynamic = "force-dynamic"`, return declared type
- [ ] Check every seat-count query `error`; clamp `seats_remaining ≥ 0`; replace per-class N+1 with one grouped count query
- [ ] Fix admin students `grade` rendering (`PP4` → `P4`) and nullable `email` crash; align local types with `types/booking.ts` (extend `Student`/`TrialClass`/`PaymentAttempt` with missing columns)
- [ ] Fix `admin/classes` subject case (`MATH`/`SCIENCE`) + badge predicate
- **Exit gate:** roster page, admin bookings page, confirmation page render real data with zero console errors.

### Fix Sprint F3 — Booking & Payment Core Logic (P0/P1) (1.5 d)
**Goal:** money paths are correct, atomic and auditable. Closes L1, L2, L3, L4, L5, B17, L12(partial), L6(timezones).
- [ ] Extend `confirm_trial_booking` with `p_action` (CONFIRM/CANCEL/REFUND) + status guard; **webhook calls the RPC** instead of `UPDATE` (L2); failed RPC → return 409/409-class error to Stripe instead of 200 — **half done `payment_mockup.md` M3 (2026-09-29): `confirmBooking()` is the single writer for confirm/webhook (no direct `UPDATE`, out-of-order ignored, 409 object envelope); the `p_action` SQL extension + cross-instance row locks remain F3 (needs DB, E2)**
- [ ] Booking creation: reject/merge duplicate `PENDING_PAYMENT` for same (student, class); define seat policy (recommended: RPC-reserved seats with `PENDING_PAYMENT` expiry, or explicit "reserve at confirm only" + UI messaging) (L3)
- [ ] Fix student/parent identity: stop using grade/phone as `residential_id`; look up student by `student_residential_id + parent_id`; write `grade`/`email` columns; add retry/uuid-suffix to `generateSmartId` (L1, L11)
- [ ] Generate `payment_attempts.id` in webhook/refund inserts (B17); store Stripe `payment_intent` in `txn_id`; confirm route records attempt failure instead of swallowing (L5 error branches) — **done `payment_mockup.md` M3 (2026-09-29): shared `generateAttemptId()`, webhook records `txn_id = <pi_…>`, ledger failures are 500s (D-B07)**
- [ ] Refund: use `payment_intent` from the SUCCESS attempt; record with a distinct status/type; update `payment_headers`/`payment_details` or delete the fake invoice tables (decide in F6) — **payment-path half done `payment_mockup.md` M3 (2026-09-29): `txn_id` must be a real `pi_…` (else 400 `BOOKING_ERROR`), provider port issues the refund, ledger row moves to `REFUNDED` (never a second `SUCCESS`); fake invoice tables + auth remain F3/F4**
- [ ] Payment history: resolve bookings via auth user → `parents.auth_user_id` → students (B18); accept `student_id` only after linkage exists
- [ ] Timezone-correct date formatting: single `formatDateTime(iso, timeZone)` used by emails + UI; reminders computed in `Asia/Singapore` day boundaries; reminder dedup column (L6, L14)
- [ ] Map RPC result codes → response `{status, code}` so UI and DB never diverge (L5)
- **Exit gate:** scripted scenario passes: 4/4 seats, 5th payment → `NO_SEATS_AVAILABLE` + `PAYMENT_FAILED`; duplicate child booking → `DUPLICATE_BOOKING`; webhook storm cannot overbook (verified against a real Postgres, see F7); refund recorded correctly.

### Fix Sprint F4 — Auth & Security (P0/P1) (1.5 d)
**Goal:** README's Auth column becomes true. Closes B9, B10, §3.2 all rows.
- [ ] Migration: `parents.auth_user_id UUID UNIQUE REFERENCES auth.users`; backfill for seeded admin (map by email)
- [ ] Signup flow upserts `parents` row (`lib/auth/client.ts` or a server callback after `auth/callback`)
- [ ] `src/lib/auth/guard.ts`: `requireUser()`, `requireAdmin()`; call from **every** route: `bookings`(POST/GET-admin), `bookings/[id]`, `payments/*` (except webhook), `roster`, `payments/history`, `notifications*`, `admin/*`, `seed`
- [ ] Middleware: matcher adds `"/api/:path*"`; admin check resolves via `auth_user_id`; fix `protectedRoutes` trailing-slash gap; honor `?next=` in login page
- [ ] Protect `/roster` and `/payments/history` pages (student PII)
- [ ] `vercel.json`: remove `Access-Control-Allow-Origin: *`; explicit origin allow-list
- [ ] Enable **RLS** on all 8 tables with policies (parent sees own rows; admin via role); switch server client to service-role key; keep anon key for public reads (`trial_classes`, `classes`) only
- [ ] `POST /api/seed`: require admin **or** `NODE_ENV !== 'production'` + rate limit; implement the documented rate limits (use `RateLimitError`) or delete the claims
- [ ] `auth/callback`: validate `next` against an allow-list (open redirect, L13)
- [ ] Add logout button wired to `signOut()` (Header)
- **Exit gate:** unauthenticated `curl` to `refund`, `seed`, `notifications`, `admin/students`, `payments/confirm` → 401/403; seeded admin reaches `/admin`; direct PostgREST calls with anon key are denied for PII tables.

### Fix Sprint F5 — Missing Endpoints & Admin Flows (P1) (1 d)
**Goal:** every button in the UI works; no dead links. Closes B12, B13, B19, sitemap, dead-link items.
- [ ] `POST /api/trial-classes` (admin, Zod-validated, subject uppercase, seats default 4) + `DELETE /api/trial-classes/[id]` (soft-delete or block if confirmed bookings exist)
- [ ] `POST /api/bookings/[id]/cancel` → RPC `p_action='CANCEL'` (admin only), returns updated status
- [ ] Fix `send-reminders`: `trial_classes!inner(...)` filter + timezone window; wire a Vercel cron (`vercel.json` `crons`) **or** remove README claim; add reminder dedup
- [ ] Add `GET /api/sitemap` **or** delete the rewrite (`vercel.json:42-43`)
- [ ] Notifications: add a minimal UI trigger (admin action on a booking) **or** mark the feature "API-only" in README
- [ ] Fix dead links: admin "View" → correct route; honor `?studentId=` / `?classId=` via `useSearchParams` (or remove links)
- [ ] Add `GET /api/admin/students` to the README endpoint table
- **Exit gate:** admin can create/delete a class, cancel a booking; every README "Features Implemented" bullet has a working click path.

### Fix Sprint F6 — Dead Code, Duplicates & Config Cleanup (P2) (1 d)
**Goal:** one implementation per concept; lean dependencies.
- [ ] Delete or adopt: barrels (`lib/index.ts`, `types/index.ts`, `components/index.ts`), `Skeleton.tsx` (wire into 3 list pages or remove + fix the claim), `Card` usage
- [ ] Remove dead exports: `utils.ts` helpers (or use them — recommended: use `getSeatsRemaining`/`formatDate` in `TrialClassCard`/`email`), `auth/server.ts` unused fns, `getSupabaseClient`, `BookingError`, unused `types`/`*Input` types, unused imports flagged by `noUnusedLocals`
- [ ] Single `formatDate/formatTime` (with timezone) shared by `email.ts` and `utils.ts`; single seat-status util; single brand text (`Footer` vs `Logo`); single error UI (keep `error.tsx`, slim `ErrorBoundary`)
- [ ] Unify seeds: regenerate `lib/seed-data.ts` from `artifacts/seed.sql` (or delete the API seed route) — one dataset, one id scheme
- [ ] One price source (`TRIAL_CLASS_PRICE` → shared constant read by UI) — **half done `payment_mockup.md` M1 (2026-09-29): `TRIAL_CLASS_PRICE_CENTS`/`_LABEL`/`formatPrice` exported from `src/lib/payments/price.ts`, used by create-intent + both forms + history; `FREE` copy and the product decision (D4 keep-both) remain**
- [ ] `package.json`: drop `ts-jest`, `ts-node`, `@react-email/render` if unused; add `noUnusedLocals` fallout fixes
- [ ] `.env.local.example` + README: remove Sentry vars (no code) or add Sentry init; document service-role key correctly; `email-templates` base URL from env (kill `localhost:3000`)
- [ ] `globals.css`: move `@import` above `@tailwind`
- **Exit gate:** `rg` shows no definition-only exports in `src/lib`/`src/types`; `npm ls` matches imports; build unchanged green.

### Fix Sprint F7 — Build, DevOps & Real Concurrency Proof (P1) (1 d)
**Goal:** build anywhere; prove race-safety instead of asserting mocks.
- [ ] `stripe.ts` lazy init (`getStripe()` throws only when called and key missing) → CI `next build` green with only Supabase vars
- [ ] Add `public/` with `logo.webp` (from `logo/`), switch `Logo.tsx`/`page.tsx` to `next/image`; fix `Dockerfile:44` / `docker-compose` accordingly → `docker build` green
- [ ] Replace mock-based `concurrency.test.ts` with a **DB-level test**: run against Supabase local/Docker Postgres, execute `seed.sql`, fire N parallel `confirm_trial_booking` calls for the last seat, assert exactly 1 `CONFIRMED` and seats ≤ 4 (keep a small unit layer, but the proof must hit the RPC)
- [ ] Route tests: real handler invocation with a mocked `supabase` **client returning fixed rows**, asserting status codes + envelope for B1–B7 regression cases (replace `toBeDefined()` assertions)
- [ ] Coverage: include `src/app/**/page.tsx` in `collectCoverageFrom`; keep threshold 70%
- [ ] Add `loading.tsx` for `/bookings`, `/roster`, `/admin/*`; fix `admin/students` route caching (F2) — verify `next build` output lists them dynamic
- **Exit gate:** `npm run build`, `docker build`, and the new concurrency test all pass in CI with a documented env matrix.

### Fix Sprint F8 — Test & Documentation Truth + A11y (1 d)
**Goal:** docs match reality; accessibility claims become true.
- [x] Correct all numbers/claims: README (`12 suites`→actual, endpoint Auth column, features that have no UI), `api.md` (401/403/429, rate limits, response shapes, `TRC-001` examples, nested body), `test.md` (suite list, curl bodies), `4hour_results.md`, `complete_plan.md`, `todo_sprint_core.md` (skeletons/concurrency claims) — **done 2026-09-29 (numbers, examples, reality notes); remaining stragglers listed in §7 "Documentation corrections"**
- [x] Add missing test suites for `validations` (→ covered by `bookingSchema.test.ts`), `errors`, `email`, `middleware` (→ `auth/middleware.test.ts`), the 7 untested components, `lib/email-templates`, the untested API routes and the wrong-dataset `seed-data.test.ts` — **done 2026-09-29: window 3 (9 suites / 62 tests), window 4 (`paymentsHistory` / `paymentsStripe` / `notifications` / `adminStudents` / `emailTemplates` = 5 suites / 81 tests) + 5 L12 drift tests in `seed-data.test.ts`. `auth/callback` was already covered by `auth/callback.test.ts`**
- [x] Remove vacuous test (`BookingStatusDialog` backdrop `if`) and add unknown-status fallback test (fix `statusConfig[status]` crash with a default branch) — **done 2026-09-29**
- [ ] A11y: dialog semantics + focus trap + Escape (both modals), `htmlFor/id` on all forms, `role="alert"` on errors, `role="status"` on loaders, `scope="col"`/`<caption>` on tables, `aria-pressed` on filters, `aria-label` on search inputs, `role="progressbar"` on seat bar, replace `confirm()`/`alert()` with styled dialogs
- [ ] Contrast: darken yellow/blue/green text-button variants to ≥4.5:1 (or dark text on brand color) — requires design sign-off; record decision in README color table
- [ ] Final: `npm run lint && npx tsc --noEmit && npm test && npm run build` all green; update `artifacts/AI_USAGE.md`
- **Exit gate:** a fresh-clone reader can follow README end-to-end (signup → book → pay → roster → admin) with **zero** undocumented steps or failing examples.

---

## 12. Traceability Matrix

| Findings | Sprint |
|---|---|
| B1–B5, B8, §6 shape/ID/status-enum rows, test.md curl 400s | **F1** |
| B6, B7, B11, B14, B20, L9, L10, `PP4`, nullable email, N+1 | **F2** |
| L1, L2, L3, L4, L5, L6, L11, L12, B17, B18 | **F3** |
| B9, B10, §3.2 (RLS, CORS, seed auth, open redirect, logout) | **F4** |
| B12, B13, B19, sitemap, dead links, notifications cron | **F5** |
| §4 all dead code/duplicates, L15(partial), price/env/deps | **F6** |
| B16, Docker `public/`, CI build, mock concurrency tests, coverage gate, `loading.tsx` | **F7** |
| §7 doc/test truth, §8 accessibility, vacuous tests | **F8** |
| Lint errors | **F0** (immediate) |
| **D-B05, D-B06, D-B21, D-B23** (§15) | **F3** |
| **D-B07, D-B08** (§15 id/attempt bookkeeping) | **F7** |
| **D-B20** (§15, no RLS) | **F4** |
| **D-B22** (§15, `?available` filter) | **F2** |
| **D-B24** (§15, ignored `?parent_email`) | **F5** |
| **D-B25, D-B27** (§15, error-code mapping) | **F1** |

**Deferred (backlog, not in F0–F8):** Redis caching & real rate-limit infra, load testing, `StripePaymentForm` full Stripe checkout UX (currently unreachable), Sentry wiring, WCAG audit beyond listed items.

---

## 13. Definition of Done (per fix)

1. Code changed + regression test added that fails before / passes after.
2. `npx tsc --noEmit` · `npx next lint` · `npm test` · `npm run build` green.
3. Affected README/`api.md`/`test.md` rows updated in the same commit.
4. No new dead exports (`rg` definition-count = 1 check for touched files).
5. Findings marked closed in this document's matrix.

## 14. Release Regression Checklist (manual, ~20 min)

```
[ ] Signup → parents row created → login → logout works
[ ] Book class (valid payload) → PENDING_PAYMENT → mock pay SUCCESS → CONFIRMED → email attempted
[ ] Mock pay FAILED → PAYMENT_FAILED, roster unchanged
[ ] Duplicate same child+class → DUPLICATE_BOOKING, DB shows one CONFIRMED
[ ] Fill class to 4 → 5th booking+payment → NO_SEATS_AVAILABLE, still 4 confirmed
[ ] Parallel double-confirm of last seat (2 tabs) → exactly one CONFIRMED
[ ] Roster shows correct students; seats never negative
[ ] Confirmation page + payment history show real data
[ ] Admin: dashboard, search/filter, cancel, class create/delete, students list
[ ] Webhook (stripe CLI) confirms booking through RPC; attempt recorded with real payment_intent
[ ] Refund succeeds and is visible in history
[ ] Unauth curl to refund/seed/notifications/admin → 401/403
[ ] Emails show correct class time (SGT) and escape user content
[ ] `docker build` + `docker-compose up` serve logo and app
[ ] Lighthouse/manual a11y spot check: modal, forms, tables, error announcements
```

---

## 15. Findings — Booking Test Execution (Sep 29, 2026)

Raised while executing `artifacts/booking_testing.md` (run 1: L1/L2/L3/L6, 80 tests, 44 defect pins).
"Repro" = automated case that pins the defect (`[BUG-ASSERT]`) in the repo today.

| ID | Sev | Location | Defect | Repro | Sprint |
|---|---|---|---|---|---|
| **D-B05** | S1 | `artifacts/seed.sql:266-278` | `confirm_trial_booking` duplicate check has no `id <> p_booking_id` guard → confirming an already-`CONFIRMED` booking (double submit, retry, 2nd worker of a race) **flips the row back to `PAYMENT_FAILED`** and returns `DUPLICATE_BOOKING`. A paid customer loses the seat; no HTTP layer prevents it (webhook path, direct RPC, parallel confirms that both pass the pre-check). | ⛔ L4/L5 (needs DB) — BK-DB-008, BK-RC-004/005/016 | **F3** |
| **D-B06** | S2 | `artifacts/seed.sql:253-301` | Unknown `p_booking_id` → `FOR UPDATE` matches 0 rows, `v_max_seats` NULL, `COUNT(*)` over `trial_class_id = NULL` = 0 → `0 < NULL` is NULL → function **returns a business code (`NO_SEATS_AVAILABLE` / `PAYMENT_FAILED`) with 0 rows updated**. Callers report success/failure for a row that never changed. | ⛔ L4 (needs DB) — BK-DB-009/010; the HTTP-level guard (404 before RPC) is covered by BK-API-024 ✅ | **F3** |
| **D-B07** | S2 | `src/app/api/payments/confirm/route.ts:55-69` | `payment_attempts` is inserted *before* the RPC and its failure is only `console.error` → attempt rows can silently vanish; attempt ids share the same 1000-value/day space as bookings (`:16-22`) so a collision also disappears silently. | ✅ BK-API-026 | **F7** → ✅ **fixed** `payment_mockup.md` M3 (2026-09-29): `confirmBooking()` writes `INITIATED` → terminal, ledger failure → 500 `DATABASE_ERROR`; BK-API-026 Target flipped |
| **D-B08** | S2 | `src/app/api/bookings/route.ts:27-33,:155-169` | Booking id = `BOOKING<000-999>-<date>`, `Math.random()`, **no retry** → same-day PK collision returns a user-visible 500. Collision probability ≈ 70 % by ~38 bookings/day. | ✅ BK-API-013, BK-UT-014 (deterministic) | **F7** |
| **D-B20** | S1 | `artifacts/seed.sql` (absent) | **No `ENABLE ROW LEVEL SECURITY`, no policies** → with the public anon key (`NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` are client-side) any visitor can `POST /rest/v1/bookings {"status":"CONFIRMED"}` and take a seat without the API, the seat guard or the RPC. | ⛔ L4/L5 (needs DB) — BK-RC-021 | **F4** |
| **D-B21** | S3 | `src/app/api/bookings/route.ts:143-153`, `trial-classes/route.ts:27-39` | Restatement of **L3** with evidence: `PENDING_PAYMENT` rows are invisible to both the create-time seat check and the availability list (BK-API-029 shows `TRC-002` = 1 free while `BKG-004` is pending) → N buyers can all be shown a free seat and all reach payment for it. | ✅ BK-API-029, BK-RC-007/008/014 (L5) | **F3** |
| **D-B22** | S3 | `src/app/api/trial-classes/route.ts:13-16,24-40` | `?available=true` filters on `seats_remaining > 0` only → classes that already started are still advertised as bookable; count errors unchecked (B20) and one count query per class (L9). | ✅ BK-NFR-004 | **F2** |
| **D-B23** | S3 | `src/app/bookings/page.tsx:13-34` | `fetchTrialClasses` never clears `error` on success and the render ternary prefers `error` over the list → after a failed load, **"Try Again" can fetch successfully and still show the error card forever** (button looks broken). | ✅ BK-UI-002 | **F3** |
| **D-B24** | S3 | `src/app/api/bookings/route.ts` (`?parent_email`) | The `parent_email` query parameter is validated by zod and then **silently ignored — no filter is applied** → `GET /api/bookings?parent_email=x` returns every booking, and callers believe they filtered. | ✅ BK-API-018 | **F5** |

| **D-B25** | S3 | `src/lib/errors.ts:143-161` (via `payments/history`, `admin/students`) | Supabase errors are plain objects (`{code, message, details}`), not `Error` instances → they fall through `handleApiError` to **`INTERNAL_ERROR` with the message "An unexpected error occurred"**; the database code/message (`42P01`, `permission denied`) never reach the client. `DATABASE_ERROR` is effectively unreachable on this path. | ✅ `paymentsHistory.test.ts`, `adminStudents.test.ts` `[BUG-ASSERT D-B25]` (pins flipped) | **F1** → ✅ **fixed** `payment_mockup.md` M1 (2026-09-29): `rethrowIfDatabaseError()` maps supabase error objects to `DATABASE_ERROR {code,message [code]}` |
| **D-B27** | S3 | `src/app/api/notifications/route.ts:47-51` | `bookingError \|\| !booking` conflates a **database failure with a missing row** → a timeout/permission error answers **404 "Booking not found"**, so callers retry a 404 that was really a 500. | ✅ `notifications.test.ts` `[BUG-ASSERT D-B27]` (pin flipped; genuine-404 case added) | **F1** → ✅ **fixed** `payment_mockup.md` M1 (2026-09-29): `notifications` route uses `rethrowIfDatabaseError` — a DB failure is 500, only `PGRST116` is 404 |

**Confirmed existing findings (reproduced by this run, no new IDs):** B1, B2, B3, B4, B5, B8, B11, B14, B15, B20, L1, L2, L3 (as D-B21), L4, L5, L6, L7, L8, L9, L11, L12, L14, B18, B19, §6 enum drift — **B18, B19, L4, L8, L12, L14 gained route-level `[BUG-ASSERT]` pins on 2026-09-29 (`paymentsHistory`, `notifications`, `paymentsStripe`, `emailTemplates`, `seed-data` suites).**

**Payment defects closed by `artifacts/payment_mockup.md` (M0–M3, 2026-09-29):** **B3** (canonical `SUCCESS`/`FAILED` + lowercase tolerance, `payment_mockup` D1) · **B4** (payment-path booking ids via `bookingIdSchema`, D2) · **B8** *payment-route half* (all five payment routes on `createErrorResponse`, D3 — `notifications`/client-union half still F1) · **B16** (lazy `getStripe()`, D5) · **L2** (`confirmBooking()` single writer: webhook → `confirm_trial_booking`, out-of-order/duplicate ignored, no direct `UPDATE`; in-process per-booking queue — cross-instance locks still need F3/DB) · **L4** (refund resolves the real `pi_…` from the SUCCESS attempt, else 400; ledger row → `REFUNDED`, no second `SUCCESS` — pins flipped in `paymentsStripe.test.ts`; the SQL/cancel-refund half stays F3) · **D-B07**, **D-B25**, **D-B27** (rows above) · **price ×4 half** (D4 keep-both). Flips and `booking_testing.md` §10.6 "Fix commit" cells updated in the same pass.

**Coverage impact:** 35.58 % (Sep 27) → 65.35 % after the booking suites → 73.77 / 65.65 / 82.58 / 73.83 after the Sep 29 F8 doc suites → **88.46 % statements / 80.76 % branches / 89.72 % functions / 89.36 % lines** after the F8 route + email-template + L12 suites. **All four metrics ≥ 70 %, `npx jest --ci --coverage` exits 0 (verified twice 2026-09-29) → D-v9 closed.** Refreshed after `payment_mockup.md` M0–M3 (2026-09-29): **89.56 % statements / 79.08 % branches / 92.28 % functions / 90.92 % lines** over **43 suites / 559 tests (492 pass / 67 todo / 0 fail)** — statements/functions/lines up, branches −1.67 pts from the new env-fallback branches (`PAYMENT_PROVIDER`, provider resolution, D10 guards), still ≥ 70 %. Caveat retained: `collectCoverageFrom` still excludes `src/**/page.tsx`, where the P0s live.

 · Baseline: tsc 0 errors · 15 suites / 125 tests pass · lint 2 errors / 4 warnings · findings: 20 bugs (11 P0), 15 logic defects, 14 endpoint/auth gaps, ~40 dead-code items, 9 build/config issues, 8 type/enum drifts, 10 doc/test truth gaps, 7 a11y gaps*
