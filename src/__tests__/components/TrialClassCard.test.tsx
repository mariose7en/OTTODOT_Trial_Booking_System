/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { TrialClassCard } from "@/components/TrialClassCard";
import { TrialClassWithSeats } from "@/types/booking";

const mockTrialClass: TrialClassWithSeats = {
  id: "MT-M-20261001T1000-4",
  class_name: "MATH TRIAL",
  subject: "MATH",
  start_time: "2026-10-01T10:00:00Z",
  max_seats: 4,
  created_at: "2026-01-01T00:00:00Z",
  confirmed_count: 2,
  seats_remaining: 2,
};

const mockFullTrialClass: TrialClassWithSeats = {
  ...mockTrialClass,
  confirmed_count: 4,
  seats_remaining: 0,
};

const mockLimitedTrialClass: TrialClassWithSeats = {
  ...mockTrialClass,
  confirmed_count: 3,
  seats_remaining: 1,
};

describe("TrialClassCard component", () => {
  it("should render class name", () => {
    render(<TrialClassCard trialClass={mockTrialClass} />);
    expect(screen.getByText("MATH TRIAL")).toBeInTheDocument();
  });

  it("should render subject badge", () => {
    render(<TrialClassCard trialClass={mockTrialClass} />);
    expect(screen.getByText("MATH")).toBeInTheDocument();
  });

  it("should render seat count", () => {
    render(<TrialClassCard trialClass={mockTrialClass} />);
    expect(screen.getByText("2 seats available")).toBeInTheDocument();
  });

  it("should render Book Now button when seats available", () => {
    render(<TrialClassCard trialClass={mockTrialClass} />);
    expect(screen.getByText("Book Now")).toBeInTheDocument();
  });

  it("should render Fully Booked when no seats", () => {
    render(<TrialClassCard trialClass={mockFullTrialClass} />);
    expect(screen.getByText("Fully Booked")).toBeInTheDocument();
    expect(screen.queryByText("Book Now")).not.toBeInTheDocument();
  });

  it("should render 1 seat left when limited", () => {
    render(<TrialClassCard trialClass={mockLimitedTrialClass} />);
    expect(screen.getByText("1 seat left")).toBeInTheDocument();
  });

  it("should have link to booking page", () => {
    render(<TrialClassCard trialClass={mockTrialClass} />);
    const link = screen.getByText("Book Now").closest("a");
    expect(link).toHaveAttribute("href", "/bookings/MT-M-20261001T1000-4");
  });
});
