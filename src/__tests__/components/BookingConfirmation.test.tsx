/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { BookingConfirmation } from "@/components/BookingConfirmation";
import { BookingStatus } from "@/types/booking";

const props = {
  bookingId: "BOOKING001-20261001",
  studentName: "CHARLIE LEE",
  className: "MATH TRIAL - OCT 1",
  subject: "MATH",
  startTime: "2026-10-01T10:00:00+08:00",
  status: BookingStatus.Confirmed,
};

describe("BookingConfirmation", () => {
  test("renders booking reference, student, class and subject", () => {
    render(<BookingConfirmation {...props} />);
    expect(screen.getByText("Booking Reference")).toBeInTheDocument();
    expect(screen.getByText(props.bookingId)).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.getByText(props.studentName)).toBeInTheDocument();
    expect(screen.getByText(props.className)).toBeInTheDocument();
    expect(screen.getByText(props.subject)).toBeInTheDocument();
  });

  test("renders the status badge for the given status", () => {
    render(<BookingConfirmation {...props} />);
    // StatusBadge renders the human label for CONFIRMED
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  test("renders a different status label when the booking is not confirmed", () => {
    render(<BookingConfirmation {...props} status={BookingStatus.PaymentFailed} />);
    expect(screen.getByText("Payment Failed")).toBeInTheDocument();
  });

  test("renders the schedule block with date and time", () => {
    render(<BookingConfirmation {...props} />);
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    const scheduleValues = screen.getAllByText(/2026/);
    expect(scheduleValues.length).toBeGreaterThan(0);
  });

  test("[BUG-ASSERT L6] the schedule is formatted with the host timezone — no timeZone option", () => {
    render(<BookingConfirmation {...props} />);
    const onHost = new Date(props.startTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const inSG = new Date(props.startTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Singapore",
    });
    expect(inSG).toBe("10:00 AM");
    // whichever zone the runner is in, the component follows the runner —
    // that is the defect: the reader is in Singapore, the runner may not be
    expect(screen.getByText(onHost)).toBeInTheDocument();
    if (onHost !== inSG) {
      expect(screen.queryByText(inSG)).not.toBeInTheDocument();
    }
  });

  test.todo(
    "Target [FIX L6]: the schedule is rendered with timeZone Asia/Singapore (or the class's own offset)"
  );
});
