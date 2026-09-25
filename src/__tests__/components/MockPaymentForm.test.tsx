/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockPaymentForm } from "@/components/MockPaymentForm";

describe("MockPaymentForm component", () => {
  const mockOnPaymentResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should render payment form", () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    expect(screen.getByText("Mock Payment")).toBeInTheDocument();
    expect(screen.getByText("FREE")).toBeInTheDocument();
    expect(screen.getByText("Pay FREE")).toBeInTheDocument();
  });

  it("should render card details", () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    expect(screen.getByDisplayValue("4242 4242 4242 4242")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12/28")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123")).toBeInTheDocument();
  });

  it("should have simulate failure checkbox", () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("should call onPaymentResult with SUCCESS when paying without failure", async () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    const payButton = screen.getByRole("button", { name: /pay free/i });
    fireEvent.click(payButton);

    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockOnPaymentResult).toHaveBeenCalledWith("SUCCESS");
    });
  });

  it("should call onPaymentResult with FAILED when failure checkbox is checked", async () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    fireEvent.click(screen.getByRole("checkbox"));
    const payButton = screen.getByRole("button", { name: /pay free/i });
    fireEvent.click(payButton);

    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockOnPaymentResult).toHaveBeenCalledWith("FAILED");
    });
  });

  it("should disable button during payment processing", async () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    const payButton = screen.getByRole("button", { name: /pay free/i });
    fireEvent.click(payButton);

    // Button should be disabled during processing
    expect(payButton).toBeDisabled();

    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(payButton).not.toBeDisabled();
    });
  });

  it("should show demo notice", () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    expect(screen.getByText("This is a mock payment for demonstration purposes only.")).toBeInTheDocument();
  });

  it("should show simulate failure label", () => {
    render(<MockPaymentForm amount="FREE" onPaymentResult={mockOnPaymentResult} />);
    
    expect(screen.getByText("Simulate payment failure (for demo)")).toBeInTheDocument();
  });
});
