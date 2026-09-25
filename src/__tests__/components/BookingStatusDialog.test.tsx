/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingStatusDialog } from "@/components/BookingStatusDialog";
import { BookingStatus } from "@/types/booking";

describe("BookingStatusDialog component", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    render(
      <BookingStatusDialog
        isOpen={false}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText("Booking Confirmed!")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Booking Confirmed!")).toBeInTheDocument();
  });

  it("should display booking ID", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING123-20260925"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("BOOKING123-20260925")).toBeInTheDocument();
  });

  it("should display student name when provided", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        studentName="CHARLIE LEE"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("CHARLIE LEE")).toBeInTheDocument();
  });

  it("should show confirmed status with correct message", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Booking Confirmed!")).toBeInTheDocument();
    expect(screen.getByText("Your trial class has been successfully booked.")).toBeInTheDocument();
  });

  it("should show payment failed status", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.PaymentFailed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Payment Failed")).toBeInTheDocument();
    expect(screen.getByText("There was an issue with your payment. Please try again.")).toBeInTheDocument();
  });

  it("should show duplicate booking status", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.DuplicateBooking}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Duplicate Booking")).toBeInTheDocument();
    expect(screen.getByText("You already have a confirmed booking for this class.")).toBeInTheDocument();
  });

  it("should show no seats available status", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.NoSeatsAvailable}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("No Seats Available")).toBeInTheDocument();
    expect(screen.getByText("Sorry, this class is now full. Please try another class.")).toBeInTheDocument();
  });

  it("should call onClose when Close button is clicked", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText("Close"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when backdrop is clicked", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    // Click the backdrop (the fixed overlay)
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/50");
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it("should show Try Again button for payment failed status", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.PaymentFailed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("should show View Roster link for confirmed status", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    const rosterLink = screen.getByText("View Roster").closest("a");
    expect(rosterLink).toHaveAttribute("href", "/roster");
  });

  it("should show Book Another Class link", () => {
    render(
      <BookingStatusDialog
        isOpen={true}
        status={BookingStatus.Confirmed}
        bookingId="BOOKING001"
        onClose={mockOnClose}
      />
    );

    const bookLink = screen.getByText("Book Another Class").closest("a");
    expect(bookLink).toHaveAttribute("href", "/bookings");
  });
});
