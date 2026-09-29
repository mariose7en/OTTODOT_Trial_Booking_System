/**
 * @jest-environment jsdom
 *
 * `StripePaymentForm` is currently unreachable from the UI (fix_plan B16 —
 * `create-intent` throws on import) and the payment page uses
 * `MockPaymentForm` instead. This suite pins the component's own contract so
 * that wiring it up later cannot silently break the confirmation flow.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StripePaymentForm } from "@/components/StripePaymentForm";

const mockConfirmPayment = jest.fn();
const mockRefresh = jest.fn();
let stripeValue: { confirmPayment: typeof mockConfirmPayment } | null = {
  confirmPayment: mockConfirmPayment,
};
let elementsValue: object | null = {};

jest.mock("@stripe/react-stripe-js", () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => stripeValue,
  useElements: () => elementsValue,
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

describe("StripePaymentForm", () => {
  beforeEach(() => {
    mockConfirmPayment.mockReset();
    mockRefresh.mockReset();
    stripeValue = { confirmPayment: mockConfirmPayment };
    elementsValue = {};
  });

  test("renders the amount, the booking id and the Stripe payment element", () => {
    render(
      <StripePaymentForm bookingId="BOOKING001-20261001" clientSecret="pi_x" />
    );
    expect(screen.getByText("Amount to pay:")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(screen.getByText(/Booking ID:/)).toBeInTheDocument();
    expect(screen.getByText(/BOOKING001-20261001/)).toBeInTheDocument();
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pay \$20\.00/i })).toBeEnabled();
  });

  test("[BUG-ASSERT] the amount is hard-coded to $20.00 while trial classes are free (MockPaymentForm says 'Pay FREE')", () => {
    render(<StripePaymentForm bookingId="BKG" clientSecret="pi_x" />);
    expect(screen.getByText("Pay $20.00")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Pay FREE");
  });

  test("the submit button is disabled while Stripe is still loading", () => {
    stripeValue = null;
    render(<StripePaymentForm bookingId="BKG" clientSecret="pi_x" />);
    expect(screen.getByRole("button", { name: /pay \$20\.00/i })).toBeDisabled();
  });

  test("a no-op submit when stripe/elements are not ready", () => {
    stripeValue = null;
    render(<StripePaymentForm bookingId="BKG" clientSecret="pi_x" />);
    submit();
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  test("successful confirmPayment calls onSuccess and refreshes the router", async () => {
    mockConfirmPayment.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();
    render(
      <StripePaymentForm
        bookingId="BOOKING001-20261001"
        clientSecret="pi_x"
        onSuccess={onSuccess}
      />
    );

    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
    const args = mockConfirmPayment.mock.calls[0][0];
    expect(args.confirmParams.return_url).toBe(
      `${window.location.origin}/bookings/BOOKING001-20261001/confirmation`
    );
    expect(args.elements).toBe(elementsValue);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("a Stripe error is shown inline and forwarded to onError", async () => {
    mockConfirmPayment.mockResolvedValue({
      error: { message: "Your card was declined." },
    });
    const onError = jest.fn();
    render(
      <StripePaymentForm
        bookingId="BKG"
        clientSecret="pi_x"
        onError={onError}
      />
    );

    submit();

    expect(
      await screen.findByText("Your card was declined.")
    ).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Your card was declined.");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a thrown error falls back to the generic message", async () => {
    mockConfirmPayment.mockRejectedValue(new Error("network down"));
    const onError = jest.fn();
    render(
      <StripePaymentForm bookingId="BKG" clientSecret="pi_x" onError={onError} />
    );

    submit();

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("network down");
  });

  test("an empty Stripe message is replaced by the generic 'Payment failed'", async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: "" } });
    render(<StripePaymentForm bookingId="BKG" clientSecret="pi_x" />);

    submit();

    expect(await screen.findByText("Payment failed")).toBeInTheDocument();
  });

  test.todo(
    "Target: the amount comes from the booking/class price instead of a literal $20.00, and the form is reachable from the payment page"
  );
});
