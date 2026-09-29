import { BookingStatus, PaymentAttemptStatus } from "@/types/booking";

describe("BookingStatus enum", () => {
  it("should have correct status values", () => {
    expect(BookingStatus.PendingPayment).toBe("PENDING_PAYMENT");
    expect(BookingStatus.Confirmed).toBe("CONFIRMED");
    expect(BookingStatus.PaymentFailed).toBe("PAYMENT_FAILED");
    expect(BookingStatus.Cancelled).toBe("CANCELLED");
    expect(BookingStatus.DuplicateBooking).toBe("DUPLICATE_BOOKING");
    expect(BookingStatus.NoSeatsAvailable).toBe("NO_SEATS_AVAILABLE");
  });

  it("should have 6 statuses", () => {
    const statusCount = Object.keys(BookingStatus).length;
    expect(statusCount).toBe(6);
  });
});

describe("PaymentAttemptStatus enum", () => {
  it("should have correct status values", () => {
    expect(PaymentAttemptStatus.Initiated).toBe("INITIATED");
    expect(PaymentAttemptStatus.Success).toBe("SUCCESS");
    expect(PaymentAttemptStatus.Failed).toBe("FAILED");
  });

  it("should have 4 statuses", () => {
    // REFUNDED exists in the DB CHECK list and is written by the refund route
    // (payment_mockup D9) — the ledger must not invent a second SUCCESS row.
    const statusCount = Object.keys(PaymentAttemptStatus).length;
    expect(statusCount).toBe(4);
    expect(PaymentAttemptStatus.Refunded).toBe("REFUNDED");
  });
});
