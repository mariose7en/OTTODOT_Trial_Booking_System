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

  it("should have 3 statuses", () => {
    const statusCount = Object.keys(PaymentAttemptStatus).length;
    expect(statusCount).toBe(3);
  });
});
