# OTTODOT Trial Booking System — Payment System Mockup Plan

| | |
|---|---|
| Document | `artifacts/payment_mockup.md` |
| Purpose | Build a deterministic, in-repo **payment mock** ("PayMock") so every payment-touching case in `artifacts/booking_testing.md` can be exercised without Stripe keys, network access or a browser — and so the payment defects those cases pin can actually be fixed and flipped |
| Status | **Plan (draft)** — no code written yet; §7 milestones are unchecked |
| Consumes | `artifacts/booking_testing.md` (125 cases, 63 of them payment/webhook/confirm related), `artifacts/fix_plan_sept_26.md` (B1–B24, L1–L15, D-B05…D-B27, sprints F1–F8) |
| Produces | `src/lib/payments/{mock,contracts,price,ledger}.ts`, `src/app/api/mock/*`, `PAYMENT_PROVIDER` switch, new suites `src/__tests__/api/paymentsMock.test.ts` + `src/__tests__/lib/paymentsMock.test.ts`, harness hooks for §6.3 |
| Convention | Tasks are checkboxes; each milestone has an exit gate. Case ids (`BK-*`), defect ids (`B*`, `L*`, `D-B*`) and sprint ids (`F1`…`F8`) refer to the two documents above. |
| Non-negotiable | Mock must be **deterministic** (no `Math.random` outcomes, no real 1.5 s timers, no network) and **production-disabled** (§10) |

---

## 0. Summary

**Why.** The booking plan can only execute its payment half through mocks that were never designed as a payment system: `MockPaymentForm` fakes a card form client-side, `src/lib/stripe.ts` *throws at import* when `STRIPE_SECRET_KEY` is missing (B16), `payments/webhook` writes `CONFIRMED` straight to the table (L2), `payments/refund` passes a synthetic `TXN-…` id to Stripe (L4), `payments/confirm` is unreachable for the ids the app itself mints (B4) and speaks a different `payment_result` vocabulary than the schema (B3). Result: **63 of 125 cases touch payment code, none of it is covered by a designed test double**, and the race/E2E payment actors (RC-009/010/011/023, E2E-004/005/010/013) are `⛔` for want of a controllable gateway.

**What we build.** A provider-switched payment layer:

- `PAYMENT_PROVIDER=mock` (default in dev/CI): intents, outcomes, refunds and webhook delivery are produced in-process by PayMock — scripted per intent (`success`, `failure`, `declined:card_declined`, `delayed`, `out_of_order`, `duplicate`), HMAC-signed exactly like Stripe, and resettable per test.
- `PAYMENT_PROVIDER=stripe`: the existing Stripe code paths, unchanged, behind the same contracts.

**What it fixes** (so `test.todo` Targets can flip): B3 (vocabulary), B4 (id gates), B8 (payment-route envelopes), L2 (webhook must route through the confirm path), L4 (refund ledger + real intent id), D-B07 (attempt write mandatory), the 4-ways price row, B16 (no import-time throw).

**What it does not fix:** E2 stays E2 — L4/L5/L7 still need a database URL and a browser. PayMock removes the *Stripe* dependency from those levels and gives the race harness a controllable payment actor (path D in `booking_testing.md` §6.2); it does not supply Postgres or Playwright.

---

## 1. Objective and success criteria

1. A booking journey (create → pay → confirm → refund → history) runs end-to-end in CI with **no `STRIPE_*` env vars at all**.
2. Every payment-related case in `booking_testing.md` is either (a) runnable today against PayMock, or (b) explicitly marked blocked on **E2 only** (DB/browser) — never on "no Stripe".
3. The payment defects pin-able without a database move from `[BUG-ASSERT]` pins to fixed + flipped Targets (list in §8.3).
4. The race harness (`booking_race_harness.ts`, §6.3) can drive payment actor **D (webhook)** and actor **B (HTTP confirm)** deterministically, including the out-of-order/duplicate storms of RC-010/011/023.
5. Gates stay green: `npx tsc --noEmit`, `npx next lint`, `npx jest --ci`, `npm run build`, `npx jest --ci --coverage` (≥ 70 % all four metrics — currently 88.46/80.76/89.72/89.36).

---

## 2. Scope

### 2.1 In scope
- Provider abstraction + `PAYMENT_PROVIDER` switch over intent creation, charge confirmation, webhook emission/verification, refund.
- **PayMock**: in-memory intent store, outcome scripting, HMAC-SHA256 webhook signer/verifier reusing Stripe's header format, deterministic ids, controllable delivery order/parallelism, reset API.
- Contract fixes on the payment routes: `payment_result` vocabulary (B3), business-id validation (B4), unified error envelope (B8), attempt bookkeeping (D-B07), single price source, refund ledger (L4).
- Webhook correctness: route confirmations through the same transition rules as `payments/confirm` (L2, I5/I8/I10).
- Test suites for the mock and for the mock-backed routes; flips for the affected `booking_testing.md` rows.
- Harness hooks (`§6.3`), fixture seeding, and a documented E2E recipe for E2E-013 without the Stripe CLI.
- Docs: `.env.local.example`, `artifacts/api.md`, `README` payment section, this plan's §12 gates.

### 2.2 Out of scope (tracked elsewhere)
| Item | Owner |
|---|---|
| Database URL / `seed.sql` applied / RLS (D-B20) — blocks L4/L5/L7 | fix_plan F4 + **E2** |
| Real Stripe checkout UX, `StripePaymentForm` polish, 3-D Secure | fix_plan F6 / backlog |
| Seat-capacity RPC rewrite (D-B05/D-B06), id generator rewrite (D-B08) | fix_plan F3/F7 |
| Email delivery (L7 false success) | fix_plan F5 |
| A11y / contrast (payment page included) | fix_plan F8 |
| Rate limiting, auth guards on payment routes | fix_plan F4 |

---

## 3. Current state (measured)

| Piece | File | Behaviour today | Gap / defect |
|---|---|---|---|
| Mock card form | `src/components/MockPaymentForm.tsx` | client-side only: 1500 ms `setTimeout`, checkbox → `"SUCCESS"/"FAILED"` | not a payment system — no intent, no ledger, no webhook; hard 1.5 s delay in every UI test |
| Stripe form + page | `src/components/StripePaymentForm.tsx`, `app/bookings/[classId]/payment/page.tsx` | loads Elements, calls `create-intent` with `bookingId` taken from the **classId** route param | B15 (wrong id); price hardcoded `$20.00` here, `2000` in the route, `FREE` in the UI |
| Intent creation | `api/payments/create-intent/route.ts` | `z.uuid()` on `booking_id`, `students!inner` cast to array, `TRIAL_CLASS_PRICE = 2000`, throws at import without `STRIPE_SECRET_KEY` | B4, B16, price ×4, envelope is string (B8), object-vs-array (types row) |
| Confirm | `api/payments/confirm/route.ts` | read-then-RPC, `payment_attempts` insert *before* the RPC, failure only `console.error`, ids `ATTEMPT###-date` / `TXN-<ts>-<rand>` | D-B07, D-B08, TOCTOU (RC-009), 409 with string error (B8), unreachable for real ids (B4) |
| Schema | `lib/validations/booking.ts:56-62` | `payment_result: z.enum(["success","failure"])` | B3 — UI and RPC both use `"SUCCESS"/"FAILED"` |
| Webhook | `api/payments/webhook/route.ts` | verifies signature, `UPDATE bookings SET status='CONFIRMED'` + insert attempt; failures `console.error` | L2 (bypasses the confirm path, I10), no idempotency (L2 out-of-order clobbers, RC-023), 409/400 strings (B8) |
| Refund | `api/payments/refund/route.ts` | passes `payment_attempts.txn_id` (`TXN-…`) to `stripe.refunds.create({payment_intent})`, records refund as another `SUCCESS` attempt | L4 (always throws in real Stripe; ledger corrupted) |
| History | `api/payments/history/route.ts` | `uuid` gate + `.eq("student_id", auth uuid)` → always `[]` | B18, D-B25 |
| Ledger | `payment_attempts` table + `seed.sql:349-354` | statuses `SUCCESS/FAILED`, ids `PAY-###`, amounts present only in SQL | no `REFUNDED`/`INITIATED` rows written by app code; `PaymentAttempt` type omits `amount/currency/payment_method` |
| Stripe module | `lib/stripe.ts` | `throw` at import when `STRIPE_SECRET_KEY` missing | B16 — any route importing it is untestable without a key |
| Price | 4 sites | `2000` cents, `$20.00` ×3, `FREE` | fix_plan §7 P2 row |
| Rate limit / auth on money routes | — | none | fix_plan §3.2 P0 (F4), out of scope here but must not be *worsened* |

---

## 4. Requirements derived from `booking_testing.md`

Every row below is a capability the mock must expose, with the cases that depend on it.

| # | Capability | Cases that need it | Defects it must respect or fix |
|---|---|---|---|
| **R1** | Create an intent for a *booking* id (not class id) without Stripe | API-019/021, UI-013/014, E2E-010 | B4, B15, B16, price |
| **R2** | Script the outcome of a payment (`SUCCESS` / `FAILED` / decline code) per intent | UT-008, UI-015/016, API-021/022, E2E-004/005 | B3 |
| **R3** | Emit a signed `payment_intent.succeeded` / `.payment_failed` webhook with the same header format Stripe uses | API-027/028, E2E-013, RC-010/011/023 | L2, B8 |
| **R4** | Deliver webhooks **out of order, duplicated, and N-way parallel** with a start barrier | API-028, RC-010/011/023 | L2, D-B05, I5/I8/I10 |
| **R5** | Refund a mock intent and record it in the ledger with a distinct status | (refund has no booking case today — §14 Q3) | L4, D-B07 |
| **R6** | Deterministic, collision-free intent / attempt / txn ids under N concurrent creates | UT-013/014, API-013, NFR-006, RC-012/024 | D-B08, D-B07, I9 |
| **R7** | One price source readable by route, UI and email | UI-013/014, API-019 | fix_plan §7 P2 (price ×4) |
| **R8** | Uniform error envelope on every payment route (object with `code`) | UI-019/020, API-023, NFR-008 | B8, D-B25, D-B27 |
| **R9** | Deterministic timing: no wall-clock sleeps in tests; delay injectable for UI states | UI-014/017, NFR-006 | D-v3 (50-create limit) |
| **R10** | A reset/plan API so harness and suites start from a known ledger | RC-020, RC-024, all suites | §6.5 fixture discipline |
| **R11** | Same behaviour whether provider is `mock` or `stripe` (contract parity) | all | B3/B4/B8 must be fixed **above** the provider layer so Stripe gets them too |
| **R12** | Webhook/confirm transition rules enforced in one place (state machine) | API-021/027/028, RC-009/023 | L2, D-B05, I5/I8 |

---

## 5. Target architecture

```
                        ┌────────────────────────────────────────────┐
   UI / tests / harness │  PAYMENT_PROVIDER = mock | stripe          │
   ────────────────────▶│  src/lib/payments/index.ts  (port)         │
                        │   createIntent() charge() refund() emit()  │
                        └───────────────┬────────────────────────────┘
                                        │  same contracts (§6)
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
   ┌─────────────────────────────┐            ┌──────────────────────────────┐
   │ PayMock (in-process)        │            │ Stripe adapter               │
   │ lib/payments/mock/*.ts      │            │ lib/payments/stripeAdapter   │
   │ • intent store (Map)        │            │ • wraps existing lib/stripe  │
   │ • outcome script (determin.)│            │   (no import-time throw)     │
   │ • id factory (seq + day)    │            └──────────────────────────────┘
   │ • HMAC signer (stripe-style)│
   │ • refund store              │                       │
   └──────────────┬──────────────┘                       │
                  │  POST /api/payments/webhook          │ (real Stripe → same route)
                  ▼                                      ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │ api/payments/{create-intent,confirm,webhook,refund,history}        │
   │  – validation via shared IdSchema (B4)                             │
   │  – createErrorResponse envelope everywhere (B8)                    │
   │  – ONE transition function confirmBooking() (L2/I5/I8/I10)         │
   │      → RPC confirm_trial_booking when a DB is present,             │
   │      → route-level state machine (same rules) when not             │
   │  – payment_attempts written transactionally (D-B07)                │
   └────────────────────────────────────────────────────────────────────┘

   Test-facing control plane (dev/test only, §10):
   POST /api/mock/payments/plan      { intent_id | booking_id, outcome, delay_ms }
   POST /api/mock/payments/emit      { event, delivery: once|duplicate|reverse|parallel:N }
   POST /api/mock/payments/reset     (clear intents + ledger + scripts)
   GET  /api/mock/payments/state     (introspection for assertions)
```

### 5.1 Data model (mock, in-memory)
| Entity | Key | Fields |
|---|---|---|
| `MockIntent` | `id` (`pi_mock_<seq>_<yyyymmdd>`) | `booking_id`, `amount_cents`, `currency`, `status` (`requires_payment_method` → `succeeded` \| `canceled`), `client_secret`, `metadata`, `created_seq` |
| `OutcomeScript` | `booking_id` or `intent_id` | `outcome` (`success` \| `failure` \| `declined:<code>`), `delay_ms` (default 0), `deliver_webhook` (default true), `delivery` (`once` \| `duplicate` \| `reverse` \| `parallel:N`) |
| `MockRefund` | `id` (`re_mock_<seq>`) | `intent_id`, `amount_cents`, `status` (`succeeded`), `reason`, `created_seq` |

Id rules: monotonic per-process sequence + date, **no `Math.random`** → satisfies I9/R6 and lets UT-013/014/API-013 expectations become deterministic.

### 5.2 State machine (single writer — R12)
```
PENDING_PAYMENT ── success ──▶ CONFIRMED            (terminal for payment)
PENDING_PAYMENT ── failure ──▶ PAYMENT_FAILED       (terminal for payment)
CONFIRMED       ── refund   ──▶ REFUNDED            (explicit admin path only)
CONFIRMED       ── any other event ──▶ ✗ ignored, logged, HTTP 200 (idempotent)
CANCELLED       ── success  ──▶ ✗ ignored (fixes RC-017 expectation)
```
Enforced by `confirmBooking(bookingId, result, source)` in `src/lib/payments/confirmBooking.ts`:
- with a DB → calls `confirm_trial_booking` (keeps I1/I2/I8 where the DB provides them);
- without a DB (unit/mock mode) → applies the identical rules to the injected store, so L3 suites assert the same behaviour the DB will enforce.

---

## 6. Contract decisions (each needs one answer before M2)

| # | Decision | Recommendation | Cases / defects affected |
|---|---|---|---|
| **D1** | `payment_result` vocabulary | **Canonical `SUCCESS` \| `FAILED`** (matches UI, RPC SQL and `PaymentAttempt`); widen `ConfirmPaymentSchema` to `z.enum(["SUCCESS","FAILED"])`, keep a one-release lowercase tolerance only if some caller is found | B3 → flip UT-008, UI-015/016, API-022 |
| **D2** | Business-id validation | Shared `IdSchema` factories (`bookingId`, `trialClassId`, `studentId`, `parentId`) accepting **both** seed (`TRC-001`, `BKG-001`) and generated (`BOOKING001-…`, `MT-M-…`) formats; **never** `.uuid()` on business ids | B4, B5 → flip API-019, UT-009; unblocks RC-009 |
| **D3** | Error envelope | Every payment route returns `{ success:false, error:{ code, message, fields? } }` via `createErrorResponse` | B8, D-B25, D-B27 → flip UI-019, API-023 |
| **D4** | Price | Single exported `TRIAL_CLASS_PRICE_CENTS` (+ derived `TRIAL_CLASS_PRICE_LABEL`) in `src/lib/payments/price.ts`, used by create-intent, both forms and emails; UI shows the same label as the charge | fix_plan §7 P2 price row |
| **D5** | Mock provider selection | `PAYMENT_PROVIDER=mock` default when `STRIPE_SECRET_KEY` unset; explicit `stripe` requires the key; **removes B16 import-throw** | B16; makes every route importable in CI |
| **D6** | Webhook signature | PayMock signs with the **same** `stripe-signature` format (`t=…,v1=…`, HMAC-SHA256 of `t.body` with `STRIPE_WEBHOOK_SECRET`, or a dev default `whsec_mock`) so `webhook/route.ts` verification code is exercised unchanged | API-027/028, E2E-013 |
| **D7** | Where confirmation lives | One `confirmBooking()` used by HTTP confirm **and** webhook (no direct `UPDATE`) | L2 → flip API-027/028, RC-010/023 expectations |
| **D8** | Attempt ledger | Insert `payment_attempts` in the same unit of work as the status change; on failure → 500 (not `console.error`); statuses `INITIATED \| SUCCESS \| FAILED \| REFUNDED` | D-B07 → flip API-026; RC-024 |
| **D9** | Refund id | Refund looks up the **intent id** stored in `txn_id` (mock or real `pi_…`); ledger row `status='REFUNDED'`, distinct id namespace | L4 → new tests + fix_plan row flips |
| **D10** | Control-plane exposure | `/api/mock/*` mounted only when `PAYMENT_PROVIDER=mock` **and** `NODE_ENV !== 'production'`; 404 otherwise; never referenced by production UI | §10 |

### 6.1 Decision log (M0, 2026-09-29) — all ten decided

| # | Status | Resolution |
|---|---|---|
| **D1** | decided | Canonical `SUCCESS` \| `FAILED`; `ConfirmPaymentSchema` widens to `z.enum(["SUCCESS","FAILED","success","failure"])` with a `.transform(v => v.toUpperCase())` so both casings parse to one canonical value (one-release lowercase tolerance as recommended; UI payload is already uppercase). |
| **D2** | decided | Shared `bookingIdSchema` in `src/lib/payments/id.ts` accepting **uuid, `BOOKING###-YYYYMMDD` and `BKG-###`** (superset — existing uuid-based callers/tests stay valid). `.uuid()` removed from `ConfirmPaymentSchema.booking_id`, `create-intent` and `refund`. Trial-class/student/parent id schemas are **out of this pass** (F1, `CreateBookingSchema` B5 unchanged). |
| **D3** | decided | All five payment routes answer through `createErrorResponse`; hand-rolled `{success:false,error:"…"}` strings removed. |
| **D4** | decided *(keep both)* | `TRIAL_CLASS_PRICE_CENTS = 2000` + `TRIAL_CLASS_PRICE_LABEL = "FREE"` exported from `src/lib/payments/price.ts` as the single source; **existing `FREE` UI/email copy is left untouched this pass**, so the fix_plan price row stays *half-fixed* until F1 wires the forms. |
| **D5** | decided | `PAYMENT_PROVIDER` (`mock` \| `stripe`); auto-resolve: explicit value wins, otherwise `stripe` only when `STRIPE_SECRET_KEY` is set and `NODE_ENV !== "test"`, else `mock`. `src/lib/stripe.ts` becomes a lazy proxy → **B16 closed**. |
| **D6** | decided | PayMock signs `t=…,v1=…` (HMAC-SHA256 of `${t}.${body}`) with `STRIPE_WEBHOOK_SECRET` or dev default `whsec_mock`; verification stays in one `verifyPaymentSignature()` used by the webhook route. |
| **D7** | decided | Single `confirmBooking()` in `src/lib/payments/confirmBooking.ts` (pre-read → guard → `confirm_trial_booking` RPC); no direct `bookings` `UPDATE` outside the RPC. |
| **D8** | decided | Attempt insert `INITIATED` then terminal update `SUCCESS`/`FAILED` in the same unit of work; any ledger failure → 500 `DATABASE_ERROR` (no more `console.error` swallow). |
| **D9** | decided | Refund resolves the intent id from `payment_attempts.txn_id` (must be `pi_…`), else **400** with the object envelope; ledger row moves to `REFUNDED`. |
| **D10** | decided | `/api/mock/payments/*` guard: `getPaymentProvider() === "mock"` **and** `NODE_ENV !== "production"`, else 404. |

---

## 7. Work breakdown

### M0 — Decisions & guardrails (0.25 d) ✅ **done 2026-09-29**
- [x] Sign off D1–D10 (§6) — decision log added at §6.1; fix_plan F1 rows for B3/B4/B8 annotated
- [x] Add `PAYMENT_PROVIDER` to `.env.local.example` + README env notes (default `mock`)
- [x] Baseline gates recorded (current: 40 suites / 529 tests, coverage 88.46/80.76/89.72/89.36)
- **Exit gate:** §6 table has no blank "Recommendation accepted" column; `fix_plan_sept_26.md` §11 F1 rows for B3/B4/B8 note "decided in payment_mockup.md §6".

### M1 — Contracts & provider port (0.5 d) → fix_plan **F1** ✅ **done 2026-09-29**
- [x] `src/lib/payments/contracts.ts`: `PaymentIntent`, `ChargeResult`, `RefundResult`, `PaymentEvent`, `PaymentProvider` interface
- [x] `src/lib/payments/price.ts` (D4) + delete the 4 hardcoded prices (route + `StripePaymentForm` + history page; UI `FREE` copy untouched per D4)
- [x] `src/lib/payments/id.ts`: `generateIntentId()`, `generateAttemptId()`, `generateTxnId()` — sequence + date (feeds D-B08 fix in F7)
- [x] `ConfirmPaymentSchema` → D1; shared `bookingIdSchema` (D2) applied to `create-intent`, `refund`, `payments/history`
- [x] `src/lib/stripe.ts`: remove import-time `throw` → lazy proxy behind `getStripe()` (B16)
- [x] All payment routes → `createErrorResponse` (D3); `rethrowIfDatabaseError` added for D-B25/D-B27
- **Exit gate ✅:** `npx tsc --noEmit` + `npx next lint` green; BK-UT-008/009, API-019/022/023, UI-015/016, NFR-008 pins flipped with the schema change.

### M2 — PayMock core (1 d) ✅ **done 2026-09-29** (one item deferred)
- [x] `src/lib/payments/mock/{store,ids,signer,outcomes}.ts` per §5.1
- [x] Provider adapter `src/lib/payments/mock/index.ts` implementing the M1 port: `createIntent`, `refund`, `verifySignature` (+ `mockControls` plan/emit/charge/reset/state)
- [x] Determinism: sequence ids, `delay_ms` default 0, no `setTimeout` in the library path (R9)
- [ ] `MockPaymentForm`: drive from intent state instead of a blind 1.5 s timer; keep the `Simulate payment failure` control (E2E-005) but route it through `plan(outcome)` — **deferred to M4/F1** (UI rework is outside the agreed "M0–M3 through routes" scope; component keeps its pinned timer behaviour for now)
- [x] Unit suite `src/__tests__/lib/paymentsMock.test.ts` (22 tests): id sequence, outcome scripting, signature verify/verify-fail, delivery modes, refund store, reset, D5/D10 resolution, B16 import safety
- **Exit gate ✅:** suite green with **zero** `STRIPE_*` env vars present.

### M3 — Control plane + route integration (1 d) ✅ **done 2026-09-29**
- [x] `src/app/api/mock/payments/{plan,emit,reset,state}/route.ts` with the production guard (D10)
- [x] `payments/create-intent`, `confirm`, `webhook`, `refund` switched to the port (behaviour identical under `stripe` — twin suite `paymentsStripe.test.ts` holds the adapter contract, R11)
- [x] `confirmBooking()` single-writer (D7) replacing the webhook's direct `UPDATE`; **plus an in-process per-booking queue** so concurrent deliveries serialise (I8/RC-010 at route level; the cross-instance guarantee still needs row locks in `confirm_trial_booking` — ⛔ E2)
- [x] Ledger transactional writes (D8 — `INITIATED` → terminal, failures → 500); refund path fixed (D9 — real `pi_…` intent, `REFUNDED` row, no second SUCCESS)
- [x] Integration suite `src/__tests__/api/paymentsMock.test.ts` (17 tests) covering R1–R12 + race suite `src/__tests__/api/paymentsMock.race.test.ts` (3 storms: RC-010/023-style)
- **Exit gate ✅:** `npx jest --ci` green with no Stripe env (43 suites / 491 pass / 67 todo / 0 fail); `npx next build` green; `/api/mock/payments/*` returns 404 when `PAYMENT_PROVIDER=stripe` (test asserted).
- **Note (found during M3):** the routes were first written at `src/app/api/_mock/…`, which Next.js treats as a **private folder** and silently excludes from routing — `next build` listed no `/api/_mock/*` routes. Renamed to `src/app/api/mock/…` (URL `/api/mock/payments/*`) and the plan/docs updated; the D10 guard still blocks production.

### M4 — Booking-plan flips (0.5 d) → consumes `booking_testing.md`
- [ ] Flip the rows listed in §8.3 from `[BUG-ASSERT]`/⛔ to Target-passing tests (update §10.6 "Fix commit" cells)
- [ ] Re-check the §8.2 "new runnable" rows and set their `Status` cell to `✅` (or `⛔ E2` if a DB is still required)
- [ ] Re-run the four runnable level suites (127 tests) — no regressions, todo count **down** by the number of flips
- **Exit gate:** `booking_testing.md` §10.3 updated; §0/§10.8 tick boxes re-verified.

### M5 — Harness & E2E hooks (0.75 d) → unblocks **P5/P7 actor D** when E2 clears
- [ ] `booking_race_harness.ts` (finally written, §6.3) gains `--payment-provider mock` and actor **D** = `emit(parallel:N, delivery)` behind the start barrier
- [ ] Scenario wiring: RC-010 (webhook storm), RC-011 (create→confirm→webhook storm), RC-023 (webhook vs HTTP confirm), RC-024 (ledger oracle)
- [ ] E2E recipe (no Stripe CLI): `E2E-013` documented as `POST /api/mock/payments/emit` with the same assertions as `stripe trigger`
- [ ] Fixture: `TRC-RACE` reset helper also calls `/api/mock/payments/reset` (R10)
- **Exit gate:** harness runs green in mock mode **against a DB when one exists**; with no DB it still executes the payment-side unit scenarios and prints `SKIPPED (E2)` for SQL assertions.

### M6 — Docs & handover (0.25 d)
- [ ] `artifacts/api.md`: new contracts table, `/api/mock/*` marked dev-only, corrected curl bodies
- [ ] `README`: payment provider section (mock default, switching to Stripe), price note
- [ ] `artifacts/test.md`: two new suites in the inventory; coverage table refreshed
- [ ] `artifacts/fix_plan_sept_26.md`: tick F1/F3 rows closed by this work; move `L2`, `L4`, `D-B07`, price row to "fixed"
- [ ] `artifacts/AI_USAGE.md` entry + this plan's §12 status update
- **Exit gate:** §12 checklist all ticked; gates green and recorded here.

**Total: ~4.25 d** (M0–M6). M1 and M3 can overlap with fix_plan F1/F3; M5 must follow a DB being available for its SQL half.

---

## 8. Test plan

### 8.1 New suites
| Suite | Covers | Notable assertions |
|---|---|---|
| `src/__tests__/lib/paymentsMock.test.ts` | R2, R6, R9, R10 | outcome script honoured exactly; ids unique over 1 000 sequential + 100 parallel creates; `delay_ms=0` path never touches a timer; reset clears store |
| `src/__tests__/api/paymentsMock.test.ts` | R1, R3, R4, R5, R8, R12 | create-intent → mock intent; charge success → `CONFIRMED` + `SUCCESS` attempt; **webhook `succeeded` does not write status directly** (mock the single-writer and assert no `UPDATE` outside it); out-of-order `payment_failed` after success is ignored (I5); duplicate delivery is idempotent (I8); refund → `REFUNDED` row + `re_mock_…`; every failure path returns the object envelope (B8) |
| `src/__tests__/api/paymentsMock.race.test.ts` (mock-level, no DB) | R4, R12 at route level | 10 parallel emits on one booking → exactly one transition; barrier implemented with `Promise.all` + resolved ticks (not timers) |

### 8.2 `booking_testing.md` cases that become runnable / change status
| Cases | Today | After this plan |
|---|---|---|
| API-019, API-021, API-022, API-023, API-026, API-027, API-028 | ✅ with `[BUG-ASSERT]` pins (B3/B4/B8/D-B07/L2) | ✅ with Targets flipped (M4) |
| UI-013…UI-020 | ✅ pinned | UI-015/016/019/020 flip; UI-014 keeps a deterministic spinner assertion (R9) |
| RC-009, RC-010, RC-011, RC-023, RC-024 | ⛔ E2 (DB) — *and* would need Stripe today | ⛔ **E2 only** (DB); payment actor supplied by PayMock, harness ready (M5) |
| E2E-004, E2E-005, E2E-010, E2E-013 | ⛔ E2 (DB + browser) | ⛔ **E2 only**; E2E-013 recipe no longer needs the Stripe CLI |
| NFR-006, UT-013/014, API-013 | ✅ pinned (id collisions, D-v3 workaround) | deterministic id factory lets the 100-create variant run (D-B08 fix in F7 keeps it honest) |
| Refund cases | added in M4 | **BK-API-030:** happy refund (CONFIRMED + pi_); **BK-API-031:** refund of non-CONFIRMED → 400 BOOKING_ERROR; **BK-API-032:** idempotent second refund → 400 BOOKING_ERROR, provider called once |

### 8.3 Defects this plan lets us flip
| Defect | Flips when | Cases |
|---|---|---|
| **B3** `payment_result` | M1 (D1) | UT-008, UI-015, UI-016, API-022 |
| **B4** `.uuid()` on business ids | M1 (D2) | UT-009, API-019, RC-009 |
| **B8** string/object envelopes on payment routes | M1 (D3) | UI-019, API-023, NFR-008 |
| **B16** import-throw | M1 (D5) | (no case — new pin) |
| **L2** webhook bypass + out-of-order clobber | M3 (D7) | API-027, API-028, RC-010, RC-023 |
| **L4** refund `TXN-…` + ledger corruption | M3 (D9) | new API-030…032 |
| **D-B07** attempt write best-effort | M3 (D8) | API-026 |
| **price ×4** | M1 (D4) | UI-013/014, API-019 |

---

## 9. What this plan does **not** unblock

| Still blocked | Blocker | Owner |
|---|---|---|
| L4 `BK-DB-*`, L5 `BK-RC-*`, harness SQL half, I1–I10 against a real database | **E2 — no database URL**, `seed.sql` not applied | fix_plan F4 + environment |
| L7 `BK-E2E-*` (browser journey) | **E2 — no browser stack** | environment |
| `D-B05`, `D-B06`, `D-B20` reproduction | database | fix_plan F3/F4 |
| RLS / anon-key hardening (RC-021) | database + policies | fix_plan F4 |
| A11y on the payment page | design sign-off | fix_plan F8 |

PayMock's contribution to each: supplies the payment actor and removes the Stripe dependency, so when the credentials arrive the remaining work is "point harness at DB" rather than "also stand up Stripe".

---

## 10. Security & safety

- **No real card data, ever.** PayMock accepts no PAN/CVV; `MockPaymentForm` fields stay readonly (UI-014) and are not transmitted.
- **Control plane is dev/test only**: `/api/mock/*` 404s unless `PAYMENT_PROVIDER=mock` *and* `NODE_ENV !== 'production'` (D10); add a startup log line when enabled.
- **Secrets**: mock signing key defaults to `whsec_mock` in dev and uses `STRIPE_WEBHOOK_SECRET` when set — never a new secret type; `.env.local.example` documents it.
- **No network in CI**: provider `mock` performs zero outbound calls; a test asserts `fetch` is not called during a full journey.
- **Production path unchanged**: `PAYMENT_PROVIDER=stripe` keeps today's Stripe calls (behind the fixed contracts); switching providers requires an env change, not a deploy.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Mock drifts from real Stripe (signature format, event names, id prefixes) | D6: reuse Stripe's header format and event names; one parity test compares PayMock's emitted body to the Stripe event shape documented in `api.md`; keep the adapter thin |
| Fixing B3/B4/B8 breaks existing pins mid-sprint | flip rules from `booking_testing.md` §9: pin and Target change in the **same commit** as the fix; M4 exists solely to reconcile the plan |
| Single-writer refactor regresses the RPC path | `confirmBooking()` keeps calling `confirm_trial_booking` when a DB is present; route-level unit tests assert "no direct UPDATE" rather than reimplementing SQL |
| Control plane leaks into production | D10 guard + a dedicated test (`state` route → 404 with `PAYMENT_PROVIDER=stripe` and with `NODE_ENV=production` simulated) |
| Scope creep into E2 work | §9 is explicit; M5's SQL half is marked "runs when a DB exists" |
| Flaky timings | R9: no library timers, `delay_ms` default 0, harness barrier per §6.3 (no sleeps > 100 ms) |

---

## 12. Acceptance / exit gates (tick as they land)

- [x] M0 decisions signed off (D1–D10)
- [x] `npx jest --ci` green **with no `STRIPE_*` variables set** — **43 suites / 492 pass / 67 todo / 559 total, 0 fail**
- [x] New suites: `paymentsMock` (lib 22 + api 18 + race 3) all green; suite total **43 / 559** (was 40 / 529)
- [x] §8.3 defects flipped with their fixes → `booking_testing.md` §10.6 "Fix commit" cells: **B3, B4, L2, D-B07, D-B25, D-B27** filled, **B8** marked partial (payment/booking-core routes), **L4** added as its own row, **B16** has no booking case. **Price row still open** (UI-013/014 — D4 keeps both sources this pass)
- [x] New refund cases `BK-API-030…032` written and executed (**M4** — the `paymentsStripe`/`paymentsMock` refund pins cover the route contract meanwhile)
- [x] `PAYMENT_PROVIDER=stripe` path still builds and its adapter tests pass (`paymentsStripe.test.ts` green with `PAYMENT_PROVIDER=stripe`, R11 parity)
- [x] `/api/mock/*` 404s in stripe mode **and** in `NODE_ENV=production` (both asserted)
- [x] Gates: `tsc` 0 · `lint` 0 errors · `jest` green · `build` green (route table lists the 4 `/api/mock/payments/*` routes) · coverage ≥ 70 % all four — **89.56 % stmt / 79.08 % branch / 92.28 % fn / 90.92 % line, `jest --coverage` exit 0**
- [ ] Docs updated: `.env.local.example` ✅ · `fix_plan_sept_26.md` §11/§15 ✅ · `booking_testing.md` §0/§10.6/§10.8 ✅ · `AI_USAGE.md` ✅ · **`api.md` payment contracts + `_mock`→`mock` correction, README payment-provider section, `test.md` 43-suite inventory remain (M6)**
- [ ] Harness hook (M5) written and runnable in mock mode; SQL half explicitly `SKIPPED (E2)` until credentials exist

---

## 13. Deliverables / file map

| Path | Kind | Milestone |
|---|---|---|
| `src/lib/payments/contracts.ts` | new | M1 |
| `src/lib/payments/price.ts` | new | M1 |
| `src/lib/payments/id.ts` | new | M1 |
| `src/lib/payments/confirmBooking.ts` | new (single writer) | M3 |
| `src/lib/payments/mock/{store,ids,signer,outcomes,index}.ts` | new | M2 |
| `src/lib/payments/stripeAdapter.ts` | refactor of `lib/stripe.ts` + route call sites | M1–M3 |
| `src/app/api/mock/payments/{plan,emit,reset,state}/route.ts` | new | M3 |
| `src/app/api/payments/{create-intent,confirm,webhook,refund,history}/route.ts` | modified (D1–D9) | M1, M3 |
| `src/lib/validations/booking.ts` | modified (`ConfirmPaymentSchema`, shared `IdSchema`) | M1 |
| `src/components/{MockPaymentForm,StripePaymentForm}.tsx`, `app/bookings/[classId]/payment/page.tsx` | modified (intent-driven, price, B15 id) | M2–M3 |
| `src/__tests__/lib/paymentsMock.test.ts`, `src/__tests__/api/paymentsMock{,.race}.test.ts` | new suites | M2–M3 |
| `src/__tests__/helpers/paymentMockHarness.ts` | new (test-side scripting helper) | M2 |
| `artifacts/booking_race_harness.ts` | new (M5, also closes plan §9 "harness not committed") | M5 |
| `.env.local.example`, `artifacts/api.md`, `artifacts/test.md`, `README.md` | docs | M6 |

---

## 14. Open questions

1. **Is the product free or $20?** UI says `FREE`, route charges `2000` cents, docs say "trial". D4 picks one source — but the *value* needs a product answer (affects UI-013/014 and the new refund cases).
2. **Does `payments/confirm` remain a public path** once the webhook is trustworthy, or become an internal fallback? (Affects RC-009's target expectation.)
3. **Refund has no booking-level test case today** — confirm adding `BK-API-030…032` (and who is allowed to call it: F4 auth guard lands separately).
4. **Should the mock own `payment_attempts` writes?** D8 says the *route* writes them transactionally; confirm the mock never writes to `payment_attempts` directly (keeps I10 "no path writes except …" honest).
5. **Playwright availability for L7** — if a browser stack is never coming, E2E-004/005/010/013 should be reclassified from `⛔ E2` to "not automated" in the plan.

---

## 15. Traceability back to `booking_testing.md`

| Plan section | Booking plan section |
|---|---|
| §4 requirements R1–R12 | §5.3 L3, §5.4/§5.5 payment actors (B/D in §6.2), §5.7 E2E-004/005/010/013 |
| §5.2 state machine | §6.1 invariants **I2, I5, I8, I10**, §2.3 RPC semantics |
| §7 M5 harness hooks | §6.3 harness design, §6.4 scenario map, §9 exit criterion "harness committed" |
| §8.2 status changes | §5 case tables + §10.4 schedule + §10.6 defect table |
| §9 not-unblocked list | §10.7 open work (E2 blocker) |
| §12 acceptance | §9 exit criteria + §10.2 gates |

---
*Plan drafted 2026-09-29 from `artifacts/booking_testing.md` (executed: 125 rows, 73 ✅ / 52 ⛔) and `artifacts/fix_plan_sept_26.md`. No code written yet — §7 checkboxes are the work queue. Owner decision needed on §6 (D1–D10) and §14 before M1 starts.*
