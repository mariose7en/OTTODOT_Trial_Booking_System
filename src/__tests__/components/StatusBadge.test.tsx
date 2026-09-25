/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import { BookingStatus } from "@/types/booking";

describe("StatusBadge component", () => {
  it("should render Confirmed status with correct text", () => {
    render(<StatusBadge status={BookingStatus.Confirmed} />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("should render PendingPayment status with correct text", () => {
    render(<StatusBadge status={BookingStatus.PendingPayment} />);
    expect(screen.getByText("Pending Payment")).toBeInTheDocument();
  });

  it("should render PaymentFailed status with correct text", () => {
    render(<StatusBadge status={BookingStatus.PaymentFailed} />);
    expect(screen.getByText("Payment Failed")).toBeInTheDocument();
  });

  it("should render Cancelled status with correct text", () => {
    render(<StatusBadge status={BookingStatus.Cancelled} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("should render DuplicateBooking status with correct text", () => {
    render(<StatusBadge status={BookingStatus.DuplicateBooking} />);
    expect(screen.getByText("Duplicate Booking")).toBeInTheDocument();
  });

  it("should render NoSeatsAvailable status with correct text", () => {
    render(<StatusBadge status={BookingStatus.NoSeatsAvailable} />);
    expect(screen.getByText("No Seats Available")).toBeInTheDocument();
  });

  it("should apply green styling for Confirmed", () => {
    render(<StatusBadge status={BookingStatus.Confirmed} />);
    const badge = screen.getByText("Confirmed");
    expect(badge).toHaveClass("bg-green-100");
  });

  it("should apply yellow styling for PendingPayment", () => {
    render(<StatusBadge status={BookingStatus.PendingPayment} />);
    const badge = screen.getByText("Pending Payment");
    expect(badge).toHaveClass("bg-yellow-100");
  });
});
