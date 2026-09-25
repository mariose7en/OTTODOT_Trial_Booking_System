/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookingForm } from "@/components/BookingForm";

describe("BookingForm component", () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render step 1 by default", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    expect(screen.getByText("Parent Information")).toBeInTheDocument();
    expect(screen.getByText("Next Step")).toBeInTheDocument();
  });

  it("should disable Next Step when fields are empty", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    const nextButton = screen.getByText("Next Step");
    expect(nextButton).toBeDisabled();
  });

  it("should enable Next Step when all fields are filled", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByPlaceholderText("ALICE"), { target: { value: "ALICE" } });
    fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "LEE" } });
    fireEvent.change(screen.getByPlaceholderText("alice@example.com"), { target: { value: "alice@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("RES123"), { target: { value: "RES123" } });

    const nextButton = screen.getByText("Next Step");
    expect(nextButton).not.toBeDisabled();
  });

  it("should navigate to step 2 when Next Step is clicked", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByPlaceholderText("ALICE"), { target: { value: "ALICE" } });
    fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "LEE" } });
    fireEvent.change(screen.getByPlaceholderText("alice@example.com"), { target: { value: "alice@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("RES123"), { target: { value: "RES123" } });
    
    fireEvent.click(screen.getByText("Next Step"));

    expect(screen.getByText("Student Information")).toBeInTheDocument();
  });

  it("should navigate back to step 1 when Back is clicked", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    
    // Fill step 1
    fireEvent.change(screen.getByPlaceholderText("ALICE"), { target: { value: "ALICE" } });
    fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "LEE" } });
    fireEvent.change(screen.getByPlaceholderText("alice@example.com"), { target: { value: "alice@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("RES123"), { target: { value: "RES123" } });
    fireEvent.click(screen.getByText("Next Step"));

    // Go back
    fireEvent.click(screen.getByText("Back"));

    expect(screen.getByText("Parent Information")).toBeInTheDocument();
  });

  it("should uppercase input values", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByPlaceholderText("ALICE"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "lee" } });

    expect(screen.getByPlaceholderText("ALICE")).toHaveValue("ALICE");
    expect(screen.getByPlaceholderText("LEE")).toHaveValue("LEE");
  });

  it("should show step indicators", () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should show step 3 form when navigating through steps", () => {
    render(<BookingForm onSubmit={mockOnSubmit} isLoading={true} />);
    
    // Fill all fields to get to step 3
    fireEvent.change(screen.getByPlaceholderText("ALICE"), { target: { value: "ALICE" } });
    fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "LEE" } });
    fireEvent.change(screen.getByPlaceholderText("alice@example.com"), { target: { value: "alice@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("RES123"), { target: { value: "RES123" } });
    fireEvent.click(screen.getByText("Next Step"));
    
    fireEvent.change(screen.getByPlaceholderText("CHARLIE"), { target: { value: "CHARLIE" } });
    fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "LEE" } });
    fireEvent.change(screen.getByPlaceholderText("RES789"), { target: { value: "RES789" } });
    fireEvent.click(screen.getByText("Next Step"));

    // Should be on step 3
    expect(screen.getByText("Review & Confirm")).toBeInTheDocument();
  });
});
