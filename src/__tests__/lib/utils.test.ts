import {
  isValidBookingStatus,
  isValidPaymentAttemptStatus,
  mapPaymentResultToBookingStatus,
  formatBookingResponse,
  getSeatsRemaining,
  getSeatStatus,
  formatDate,
  formatTime,
} from "@/lib/utils";
import { BookingStatus, PaymentAttemptStatus } from "@/types/booking";

describe("isValidBookingStatus", () => {
  it("should return true for valid status strings", () => {
    expect(isValidBookingStatus("PENDING_PAYMENT")).toBe(true);
    expect(isValidBookingStatus("CONFIRMED")).toBe(true);
    expect(isValidBookingStatus("PAYMENT_FAILED")).toBe(true);
    expect(isValidBookingStatus("CANCELLED")).toBe(true);
    expect(isValidBookingStatus("DUPLICATE_BOOKING")).toBe(true);
    expect(isValidBookingStatus("NO_SEATS_AVAILABLE")).toBe(true);
  });

  it("should return false for invalid status strings", () => {
    expect(isValidBookingStatus("INVALID_STATUS")).toBe(false);
    expect(isValidBookingStatus("")).toBe(false);
    expect(isValidBookingStatus("pending_payment")).toBe(false);
    expect(isValidBookingStatus("CONFIRM")).toBe(false);
  });
});

describe("isValidPaymentAttemptStatus", () => {
  it("should return true for valid status strings", () => {
    expect(isValidPaymentAttemptStatus("INITIATED")).toBe(true);
    expect(isValidPaymentAttemptStatus("SUCCESS")).toBe(true);
    expect(isValidPaymentAttemptStatus("FAILED")).toBe(true);
  });

  it("should return false for invalid status strings", () => {
    expect(isValidPaymentAttemptStatus("PENDING")).toBe(false);
    expect(isValidPaymentAttemptStatus("")).toBe(false);
    expect(isValidPaymentAttemptStatus("COMPLETED")).toBe(false);
  });
});

describe("mapPaymentResultToBookingStatus", () => {
  it("should map SUCCESS to Confirmed", () => {
    expect(mapPaymentResultToBookingStatus("SUCCESS")).toBe(
      BookingStatus.Confirmed
    );
    expect(mapPaymentResultToBookingStatus("success")).toBe(
      BookingStatus.Confirmed
    );
  });

  it("should map failure to PaymentFailed", () => {
    expect(mapPaymentResultToBookingStatus("FAILED")).toBe(
      BookingStatus.PaymentFailed
    );
    expect(mapPaymentResultToBookingStatus("error")).toBe(
      BookingStatus.PaymentFailed
    );
    expect(mapPaymentResultToBookingStatus("")).toBe(
      BookingStatus.PaymentFailed
    );
  });
});

describe("formatBookingResponse", () => {
  it("should return correct response object", () => {
    const result = formatBookingResponse("booking-123", BookingStatus.Confirmed);
    expect(result).toEqual({
      booking_id: "booking-123",
      status: BookingStatus.Confirmed,
    });
  });
});

describe("getSeatsRemaining", () => {
  it("should calculate remaining seats correctly", () => {
    expect(getSeatsRemaining(10, 5)).toBe(5);
    expect(getSeatsRemaining(3, 3)).toBe(0);
    expect(getSeatsRemaining(5, 0)).toBe(5);
  });

  it("should return 0 when confirmed exceeds max (edge case)", () => {
    expect(getSeatsRemaining(3, 5)).toBe(0);
  });
});

describe("getSeatStatus", () => {
  it("should return full when no seats remaining", () => {
    const result = getSeatStatus({
      id: "1",
      class_name: "Test",
      subject: "MATH",
      start_time: "2026-01-01T00:00:00Z",
      max_seats: 4,
      created_at: "2026-01-01T00:00:00Z",
      confirmed_count: 4,
      seats_remaining: 0,
    });
    expect(result.level).toBe("full");
    expect(result.color).toBe("red");
    expect(result.text).toBe("No seats available");
  });

  it("should return limited when 1 seat remaining", () => {
    const result = getSeatStatus({
      id: "1",
      class_name: "Test",
      subject: "MATH",
      start_time: "2026-01-01T00:00:00Z",
      max_seats: 4,
      created_at: "2026-01-01T00:00:00Z",
      confirmed_count: 3,
      seats_remaining: 1,
    });
    expect(result.level).toBe("limited");
    expect(result.color).toBe("yellow");
    expect(result.text).toBe("1 seat left");
  });

  it("should return available when many seats remaining", () => {
    const result = getSeatStatus({
      id: "1",
      class_name: "Test",
      subject: "MATH",
      start_time: "2026-01-01T00:00:00Z",
      max_seats: 10,
      created_at: "2026-01-01T00:00:00Z",
      confirmed_count: 3,
      seats_remaining: 7,
    });
    expect(result.level).toBe("available");
    expect(result.color).toBe("green");
    expect(result.text).toBe("7 seats available");
  });
});

describe("formatDate", () => {
  it("should format date string correctly", () => {
    const result = formatDate("2026-10-01T10:00:00Z");
    expect(result).toContain("October");
    expect(result).toContain("1");
    expect(result).toContain("2026");
  });
});

describe("formatTime", () => {
  it("should format time string correctly", () => {
    const result = formatTime("2026-10-01T10:00:00Z");
    expect(result).toBeTruthy();
  });
});
