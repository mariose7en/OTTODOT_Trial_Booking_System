# API Documentation

## Overview

The OTTODOT Trial Booking System API provides endpoints for managing trial class bookings, payments, and notifications.

**Base URL:** `/api`

**Authentication:** Most endpoints require authentication via Supabase Auth. Include the session cookie in requests.

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
    "fields": { "field": "error detail" }
  }
}
```

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
      "trial_class_id": "TRC-001",
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
    "booking_id": "BKG-001",
    "status": "PENDING_PAYMENT"
  }
}
```

**Errors:**
- `400`: Validation error
- `404`: Trial class not found
- `409`: No seats available

#### GET /api/bookings/[id]

Get booking details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "BKG-001",
    "student_id": "STU-001",
    "trial_class_id": "TRC-001",
    "status": "CONFIRMED",
    "registered_at": "2026-09-25T10:00:00Z",
    "students": {
      "first_name": "CHARLIE",
      "last_name": "LEE"
    },
    "trial_classes": {
      "class_name": "MATH TRIAL - OCT 1",
      "subject": "MATH",
      "start_time": "2026-10-01T10:00:00Z"
    }
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

Get all students with booking counts (admin only).

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
      "grade": "P4",
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
| `429` | Rate limit exceeded |
| `500` | Server error |

---

## Booking Status Flow

```
PENDING_PAYMENT → CONFIRMED (payment success)
PENDING_PAYMENT → PAYMENT_FAILED (payment failure)
PENDING_PAYMENT → PAYMENT_FAILED (duplicate detected)
CONFIRMED → CANCELLED (admin cancel)
CONFIRMED → REFUNDED (admin refund)
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/bookings | 10/hour per IP |
| POST /api/payments/confirm | 10/hour per IP |
| POST /api/seed | 1/hour per IP |

---

*API Version: 1.0*
*Last Updated: September 25, 2026*
