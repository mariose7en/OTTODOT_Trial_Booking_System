# API Documentation

## Overview

The OTTODOT Trial Booking System API provides endpoints for managing trial class bookings, payments, and notifications.

**Base URL:** `/api`

**Authentication (as built, 2026-09-29):** **no API route checks authentication or authorization** - the
`session cookie` requirement that used to appear here is aspirational (fix_plan §3.2 P0). Public by design today:
`GET /api/trial-classes`, `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/[id]`,
`POST /api/payments/confirm`, `GET /api/roster/*`, `GET /api/payments/history`.
**Unprotected but should not be:** `POST /api/payments/refund` (money), `POST /api/seed` (destructive write),
`POST /api/notifications/*` (bulk email), `GET /api/admin/students` (student PII).
Only `POST /api/payments/webhook` verifies anything (Stripe signature).

**Response Format:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "statusCode": 400,
    "fields": { "field": "error detail" }
  }
}
```

> **Not uniform in practice (defect B8):** `createErrorResponse` produces the object above, but several routes
> return `error` as a plain **string** (`POST /api/payments/confirm` 409 path, `POST /api/bookings` 404/409 paths),
> and the React pages render `data.error` directly - which crashes with
> *"Objects are not valid as a React child"*. Clients must handle both shapes until B8 is fixed.

---

## Endpoints

### Trial Classes

#### GET /api/trial-classes

List all trial classes with seat availability.

**Query Parameters:**
- `available` (optional): Filter to classes with available seats

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "TRC-001",
      "class_id": "CLS-001",
      "class_name": "MATH TRIAL - OCT 1",
      "subject": "MATH",
      "start_time": "2026-10-01T10:00:00Z",
      "end_time": "2026-10-01T11:00:00Z",
      "location": "Online Zoom",
      "max_seats": 4,
      "confirmed_count": 2,
      "seats_remaining": 2
    }
  ]
}
```

---

### Bookings

#### GET /api/bookings

List all bookings (admin only).

**Query Parameters:**
- `status` (optional): Filter by status (PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, CANCELLED, REFUNDED)
- `trial_class_id` (optional): Filter by trial class

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "BKG-001",
      "student_id": "STU-001",
      "trial_class_id": "MT-M-20261001T1000-4",
      "status": "CONFIRMED",
      "registered_at": "2026-09-25T10:00:00Z"
    }
  ]
}
```

#### POST /api/bookings

Create a new booking.

**Request Body:**
```json
{
  "trial_class_id": "TRC-001",
  "parent": {
    "first_name": "ALICE",
    "last_name": "LEE",
    "email": "alice@example.com",
    "phone": "+1234567890"
  },
  "student": {
    "first_name": "CHARLIE",
    "last_name": "LEE",
    "grade": 4
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": "BOOKING007-20261001",
    "status": "PENDING_PAYMENT"
  }
}
```

> The nested body above is what `CreateBookingSchema` accepts. The booking UI sends **flat** keys
> (`parent_first_name`, `student_email`, ...) and therefore gets `400 VALIDATION_ERROR` today - **defect B1**.
> `trial_class_id` must match `/^[A-Z]{2}-[A-Z]-\d{8}T\d{4}-\d+$/`, so the seed ids `TRC-001...TRC-004` are
> rejected - **defect B5**. Ids are generated as `BOOKING<000-999>-<YYYYMMDD>` with no collision retry - **D-B08**.

**Errors:**
- `400`: Validation error (flat payload, bad class-id format, missing `parent`/`student`)
- `404`: Trial class not found
- `409`: No seats available

#### GET /api/bookings/[id]

Get booking details.

> **Two known defects on this endpoint.**
> 1. `id` is validated with `z.string().uuid()` while every id the system generates is `BOOKING###-YYYYMMDD`
>    -> a valid, freshly created id returns **400 `Invalid booking ID format`** (defect **B4**).
> 2. The query is `select("*")` with **no joins**, so the `students` / `trial_classes` objects shown in the
>    example below are **never returned** - the confirmation page reads them and renders empty content
>    (defects **B14** / **B11**).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "BOOKING007-20261001",
    "student_id": "CHR-4-20261001",
    "trial_class_id": "MT-M-20261001T1000-4",
    "status": "CONFIRMED",
    "registered_at": "2026-10-01T02:00:00Z"
  }
}
```

---

### Payments

#### POST /api/payments/confirm

Confirm a payment and update booking status.

**Request Body:**
```json
{
  "booking_id": "BKG-001",
  "payment_result": "success"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": "BKG-001",
    "status": "CONFIRMED"
  }
}
```

**Payment Results:**
- `success`: Payment successful, booking confirmed
- `failure`: Payment failed, booking marked as PAYMENT_FAILED

#### POST /api/payments/create-intent

Create a Stripe PaymentIntent.

**Request Body:**
```json
{
  "booking_id": "BKG-001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client_secret": "pi_xxx_secret_xxx",
    "payment_intent_id": "pi_xxx"
  }
}
```

#### POST /api/payments/webhook

Handle Stripe webhooks (called by Stripe).

**Headers:**
- `stripe-signature`: Stripe webhook signature

#### POST /api/payments/refund

Process a refund for a confirmed booking (admin only).

**Request Body:**
```json
{
  "booking_id": "BKG-001",
  "reason": "Customer request"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "refund_id": "re_xxx",
    "status": "succeeded",
    "amount": 2000
  }
}
```

#### GET /api/payments/history

Get payment history for a user.

**Query Parameters:**
- `user_id` (required): User ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "PAY-001",
      "booking_id": "BKG-001",
      "status": "SUCCESS",
      "txn_id": "TXN-SUCCESS-001",
      "created_at": "2026-09-25T10:00:00Z",
      "bookings": {
        "trial_classes": {
          "class_name": "MATH TRIAL - OCT 1",
          "subject": "MATH"
        }
      }
    }
  ]
}
```

---

### Roster

#### GET /api/roster/[class_id]

Get the roster for a trial class.

**Response:**
```json
{
  "success": true,
  "data": {
    "class_id": "TRC-001",
    "class_name": "MATH TRIAL - OCT 1",
    "confirmed_students": [
      {
        "student_id": "STU-001",
        "first_name": "CHARLIE",
        "last_name": "LEE",
        "email": "charlie@example.com"
      }
    ],
    "seats_remaining": 2,
    "max_seats": 4
  }
}
```

---

### Notifications

#### POST /api/notifications

Send a notification email (admin only).

**Request Body:**
```json
{
  "type": "booking_confirmed",
  "booking_id": "BKG-001"
}
```

**Notification Types:**
- `booking_confirmed`: Send confirmation email
- `payment_failed`: Send payment failure email
- `booking_reminder`: Send 24-hour reminder

#### POST /api/notifications/send-reminders

Send reminders for classes happening tomorrow (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Sent 5 reminders, 0 failed",
    "count": 5,
    "failed": 0
  }
}
```

---

### Admin

#### GET /api/admin/students

Get all students with booking counts.

> **Not admin-only (fix_plan §3.2 P0):** the route performs **no authentication or authorization** and dumps
> every student's name, email and grade to any caller. It also has no `dynamic` directive, so the PII response is
> cacheable. `grade` is stored as an integer (the `"P4"` string below was wrong).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "STU-001",
      "first_name": "CHARLIE",
      "last_name": "LEE",
      "email": "charlie@example.com",
      "grade": 4,
      "created_at": "2026-09-25T10:00:00Z",
      "booking_count": 3
    }
  ]
}
```

---

### Seed Data

#### POST /api/seed

Initialize seed data for development.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Seed data initialized"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid input data |
| `BOOKING_ERROR` | Booking operation failed |
| `DATABASE_ERROR` | Database operation failed |
| `AUTH_ERROR` | Authentication error |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict (e.g., no seats) |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad request / validation error |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not found |
| `409` | Conflict |
| `429` | Rate limit exceeded - **never returned** (no limiter exists in `src/`) |
| `500` | Server error |

> **Reality:** only `200`, `400`, `404`, `409` and `500` are produced by any route today. `401`, `403` and `429`
> appear in this table and in the README endpoint matrix but **no route ever emits them** (fix_plan §3.1).

---

## Booking Status Flow

```
PENDING_PAYMENT → CONFIRMED (payment success)
PENDING_PAYMENT → PAYMENT_FAILED (payment failure)
PENDING_PAYMENT → PAYMENT_FAILED (duplicate detected)
CONFIRMED → CANCELLED (admin cancel)
CONFIRMED → REFUNDED (admin refund)
```

> **The last two transitions have no implementation.** `POST /api/bookings/[id]/cancel` does not exist (B12) and
> `POST /api/payments/refund` exists but has **no caller and no auth check** (L4) - so neither transition is
> reachable from the UI today. Also note the webhook writes `CONFIRMED` directly, bypassing the RPC (L2).

---

## Rate Limits

**Not implemented.** `RateLimitError` exists in `src/lib/errors.ts` but is never thrown, and there is no limiter
middleware, Redis or Upstash integration anywhere in `src/` (fix_plan §3.1, P2). The table below is the **target**
state, kept for the F5/F7 work - until then `POST /api/seed` is a fully open destructive endpoint.

| Endpoint | Target limit | Implemented |
|----------|--------------|-------------|
| POST /api/bookings | 10/hour per IP | no |
| POST /api/payments/confirm | 10/hour per IP | no |
| POST /api/seed | 1/hour per IP | no |

---

*API Version: 1.0*
*Last Updated: September 29, 2026 (doc-truth pass: auth, envelope, ids, joins, status codes and rate limits corrected against measured behaviour - fix_plan F8)*
