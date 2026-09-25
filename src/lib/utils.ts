import { BookingStatus, PaymentAttemptStatus, TrialClassWithSeats } from "@/types/booking";

export function isValidBookingStatus(status: string): status is BookingStatus {
  return Object.values(BookingStatus).includes(status as BookingStatus);
}

export function isValidPaymentAttemptStatus(
  status: string
): status is PaymentAttemptStatus {
  return Object.values(PaymentAttemptStatus).includes(
    status as PaymentAttemptStatus
  );
}

export function mapPaymentResultToBookingStatus(
  paymentResult: string
): BookingStatus {
  const normalized = paymentResult.toUpperCase();
  if (normalized === "SUCCESS") {
    return BookingStatus.Confirmed;
  }
  return BookingStatus.PaymentFailed;
}

export function formatBookingResponse(
  bookingId: string,
  status: BookingStatus
) {
  return {
    booking_id: bookingId,
    status,
  };
}

export function getSeatsRemaining(
  maxSeats: number,
  confirmedCount: number
): number {
  return Math.max(0, maxSeats - confirmedCount);
}

export function getSeatStatus(trialClass: TrialClassWithSeats) {
  const { seats_remaining, max_seats } = trialClass;
  const percentage = (max_seats - seats_remaining) / max_seats;

  if (seats_remaining === 0) {
    return { text: "No seats available", color: "red" as const, level: "full" as const };
  }
  if (seats_remaining <= 1 || percentage >= 0.75) {
    return { text: `${seats_remaining} seat${seats_remaining === 1 ? "" : "s"} left`, color: "yellow" as const, level: "limited" as const };
  }
  return {
    text: `${seats_remaining} seats available`,
    color: "green" as const,
    level: "available" as const,
  };
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
