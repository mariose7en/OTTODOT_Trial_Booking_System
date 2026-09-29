/**
 * L2 — booking pages (list, class detail/3-step form, mock payment, confirmation).
 * Cases: BK-UI-001 … BK-UI-020
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockUseParams = jest.fn();
const mockUseRouter = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => mockUseRouter(),
}));

jest.mock("next/link", () => {
  function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  }
  return MockLink;
});

import BookingsPage from "@/app/bookings/page";
import BookingDetailPage from "@/app/bookings/[classId]/page";
import ConfirmationPage from "@/app/bookings/[classId]/confirmation/page";
import PaymentPage from "@/app/bookings/[classId]/payment/page";
import { ConfirmPaymentSchema } from "@/lib/validations/booking";

const fetchMock = jest.fn();

const classes = [
  {
    id: "TRC-001",
    class_name: "MATH TRIAL - OCT 1",
    subject: "MATH",
    start_time: "2026-10-01T10:00:00+08:00",
    max_seats: 4,
    confirmed_count: 1,
    seats_remaining: 3,
  },
  {
    id: "TRC-002",
    class_name: "SCIENCE TRIAL - OCT 2",
    subject: "SCIENCE",
    start_time: "2026-10-02T14:00:00+08:00",
    max_seats: 4,
    confirmed_count: 4,
    seats_remaining: 0,
  },
  {
    id: "TRC-003",
    class_name: "MATH TRIAL - OCT 8",
    subject: "MATH",
    start_time: "2026-10-08T10:00:00+08:00",
    max_seats: 4,
    confirmed_count: 3,
    seats_remaining: 1,
  },
];

const apiError = (fields?: Record<string, string>, statusCode = 400) => ({
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    fields,
    statusCode,
  },
});

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}
function fail(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

function defaultFetch(url: string, init?: RequestInit): Promise<unknown> {
  if (url.startsWith("/api/trial-classes")) {
    return Promise.resolve(ok({ success: true, data: classes }));
  }
  if (url === "/api/bookings" && init?.method === "POST") {
    return Promise.resolve(
      ok({
        success: true,
        data: { booking_id: "BOOKING123-20260929", status: "PENDING_PAYMENT" },
      })
    );
  }
  if (url === "/api/payments/confirm") {
    return Promise.resolve(
      ok({
        success: true,
        data: { booking_id: "BOOKING123-20260929", status: "CONFIRMED" },
      })
    );
  }
  if (url === "/api/payments/create-intent") {
    return Promise.resolve(fail(400, apiError({ booking_id: "Invalid booking ID format" })));
  }
  if (url.startsWith("/api/bookings/")) {
    return Promise.resolve(fail(400, apiError({ id: "Invalid booking ID format" })));
  }
  return Promise.resolve(fail(404, { success: false, error: "not found" }));
}

/** Error boundary so a bad render (B8) is observable instead of fatal to the run. */
class TestBoundary extends React.Component<
  { onError: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.hasError ? (
      <div data-testid="error-boundary" />
    ) : (
      this.props.children
    );
  }
}

function renderWithBoundary(ui: React.ReactElement) {
  const errors: Error[] = [];
  const utils = render(
    <TestBoundary onError={(error) => errors.push(error)}>{ui}</TestBoundary>
  );
  return { ...utils, errors };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseParams.mockReturnValue({ classId: "TRC-001" });
  mockUseRouter.mockReturnValue({ push: jest.fn(), replace: jest.fn(), back: jest.fn() });
  fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    defaultFetch(String(url), init)
  );
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

function classesRequest() {
  return fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/trial-classes"));
}

function bookingPostCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) => String(url) === "/api/bookings" && (init as RequestInit)?.method === "POST"
  );
}

function confirmPostCall() {
  return fetchMock.mock.calls.find(([url]) => String(url) === "/api/payments/confirm");
}

function fillStep1() {
  fireEvent.change(screen.getByPlaceholderText("ALICE"), { target: { value: "alice" } });
  fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "lee" } });
  fireEvent.change(screen.getByPlaceholderText("alice@example.com"), {
    target: { value: "alice@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("RES123"), { target: { value: "RES123" } });
}

function fillStep2() {
  fireEvent.change(screen.getByPlaceholderText("CHARLIE"), {
    target: { value: "charlie" },
  });
  fireEvent.change(screen.getByPlaceholderText("LEE"), { target: { value: "lee" } });
  fireEvent.change(screen.getByPlaceholderText("RES789"), { target: { value: "RES789" } });
}

async function submitBooking() {
  fillStep1();
  fireEvent.click(screen.getByText("Next Step"));
  fillStep2();
  fireEvent.click(screen.getByText("Next Step"));
  fireEvent.click(screen.getByText("Proceed to Payment"));
  await waitFor(() => expect(screen.getByText("Card Number")).toBeInTheDocument());
}

describe("BK-UI /bookings list page", () => {
  test("BK-UI-001: renders a card per class with a booking link", async () => {
    render(<BookingsPage />);
    await waitFor(() =>
      expect(screen.getByText("MATH TRIAL - OCT 1")).toBeInTheDocument()
    );
    expect(screen.getByText("SCIENCE TRIAL - OCT 2")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2); // the full class card has no link
    expect(links.map((l) => l.getAttribute("href"))).toContain("/bookings/TRC-001");
  });

  test("BK-UI-002: loading, empty and network-error states (with Try Again)", async () => {
    // loading
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const loadingView = render(<BookingsPage />);
    expect(screen.getByText(/Loading classes/i)).toBeInTheDocument();
    loadingView.unmount();

    // empty
    fetchMock.mockImplementation(() =>
      Promise.resolve(ok({ success: true, data: [] }))
    );
    const emptyView = render(<BookingsPage />);
    await waitFor(() =>
      expect(screen.getByText(/No trial classes available/i)).toBeInTheDocument()
    );
    emptyView.unmount();

    // network error (string error → no crash) + retry
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    const errorView = render(<BookingsPage />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load trial classes/i)).toBeInTheDocument()
    );
    const retry = screen.getByRole("button", { name: /Try Again/i });
    fetchMock.mockImplementation(() =>
      Promise.resolve(ok({ success: true, data: classes }))
    );
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(retry);
    // [BUG-ASSERT D-B23]: the retry does fetch, but `error` is never cleared on
    // success (bookings/page.tsx:13-34) so the error card stays up forever.
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() =>
      expect(classesRequest()).toBeDefined()
    );
    expect(screen.getByText(/Failed to load trial classes/i)).toBeInTheDocument();
    expect(screen.queryByText("MATH TRIAL - OCT 1")).toBeNull();
    errorView.unmount();
  });

  test.todo(
    "BK-UI-002 Target [FIX D-B23]: a successful Try Again clears the error and renders the class list"
  );

  test("BK-UI-003: seat badge reflects seats_remaining (0 → fully booked, 1 → one seat left)", async () => {
    render(<BookingsPage />);
    await waitFor(() => expect(screen.getByText("SCIENCE TRIAL - OCT 2")).toBeInTheDocument());
    expect(screen.getByText("No seats available")).toBeInTheDocument();
    expect(screen.getByText("1 seat left")).toBeInTheDocument();
    expect(screen.getByText("3 seats available")).toBeInTheDocument();
  });

  test("BK-UI-006: [BUG-ASSERT B8] a structured API error object crashes the page render", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(() =>
      Promise.resolve(fail(500, apiError(undefined, 500)))
    );
    const { errors } = renderWithBoundary(<BookingsPage />);
    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(errors[0].message).toMatch(/Objects are not valid as a React child/);
    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  test.todo(
    "BK-UI-006 Target [FIX B8]: a structured API error renders an error message instead of crashing"
  );
});

describe("BK-UI /bookings/[classId] detail page", () => {
  test("BK-UI-004: class summary shows subject, date and time", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("MATH TRIAL - OCT 1")).toBeInTheDocument());
    expect(screen.getByText("MATH")).toBeInTheDocument();
    expect(screen.getByText(/Oct 1/)).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  test("BK-UI-005: unknown class → Class not found + Back to Classes link", async () => {
    mockUseParams.mockReturnValue({ classId: "TRC-NOPE" });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Class not found")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Back to Classes/i })).toHaveAttribute(
      "href",
      "/bookings"
    );
  });

  test("BK-UI-007: step 1 gate — Next Step disabled until all four parent fields are filled", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    expect(screen.getByText("Next Step")).toBeDisabled();
    fillStep1();
    expect(screen.getByText("Next Step")).not.toBeDisabled();
  });

  test("BK-UI-008: step 2 gate and step 3 review shows the entered values", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    fillStep1();
    fireEvent.click(screen.getByText("Next Step"));
    expect(screen.getByText("Student Information")).toBeInTheDocument();
    expect(screen.getByText("Next Step")).toBeDisabled();
    fillStep2();
    expect(screen.getByText("Next Step")).not.toBeDisabled();
    fireEvent.click(screen.getByText("Next Step"));
    expect(screen.getByText("Review & Confirm")).toBeInTheDocument();
    expect(screen.getByText(/alice lee/i)).toBeInTheDocument();
    expect(screen.getByText(/charlie lee/i)).toBeInTheDocument();
  });

  test("BK-UI-009: [BUG-ASSERT] typed input is upper-cased by the form", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    const email = screen.getByPlaceholderText("alice@example.com");
    fireEvent.change(email, { target: { value: "alice@example.com" } });
    expect(email).toHaveValue("ALICE@EXAMPLE.COM");
  });

  test.todo(
    "BK-UI-009 Target: typed values render verbatim (server normalises on write)"
  );

  test("BK-UI-010: [BUG-ASSERT B2] the form collects 7 fields — no phone, no grade", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("ALICE")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("RES123")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/\+65/i)).toBeNull();
    expect(screen.queryByLabelText(/grade/i)).toBeNull();
    // step 2 has no grade selector either
    fillStep1();
    fireEvent.click(screen.getByText("Next Step"));
    expect(screen.queryByLabelText(/grade/i)).toBeNull();
    expect(screen.queryByLabelText(/phone/i)).toBeNull();
  });

  test.todo(
    "BK-UI-010 Target [FIX B2]: the form collects every field CreateBookingSchema requires (phone + grade)"
  );

  test("BK-UI-011: [BUG-ASSERT B1] the create-booking payload uses flat keys, not the nested schema", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    const call = bookingPostCall();
    expect(call).toBeDefined();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(
      [
        "parent_email",
        "parent_first_name",
        "parent_last_name",
        "parent_residential_id",
        "student_first_name",
        "student_last_name",
        "student_residential_id",
        "trial_class_id",
      ].sort()
    );
    expect(body).not.toHaveProperty("parent");
    expect(body).not.toHaveProperty("student");
  });

  test.todo(
    "BK-UI-011 Target [FIX B1]: the payload matches CreateBookingSchema (nested parent/student, phone, grade)"
  );

  test("BK-UI-012: [BUG-ASSERT B1/B8] a 400 from POST /api/bookings crashes the page", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url) === "/api/bookings" && (init as RequestInit)?.method === "POST") {
        return Promise.resolve(fail(400, apiError({ parent: "Required", student: "Required" })));
      }
      return defaultFetch(String(url), init);
    });
    const { errors } = renderWithBoundary(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    fillStep1();
    fireEvent.click(screen.getByText("Next Step"));
    fillStep2();
    fireEvent.click(screen.getByText("Next Step"));
    fireEvent.click(screen.getByText("Proceed to Payment"));
    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(errors[0].message).toMatch(/Objects are not valid as a React child/);
    consoleError.mockRestore();
  });

  test.todo(
    "BK-UI-012 Target [FIX B1+B8]: the 400 is shown as a readable validation message, no crash"
  );

  test("BK-UI-013: successful create moves to the mock payment step", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    expect(screen.getByRole("heading", { name: "Mock Payment" })).toBeInTheDocument();
    expect(bookingPostCall()).toBeDefined();
  });

  test("BK-UI-014: mock payment form content — readonly card, failure toggle, Pay FREE button", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    const card = screen.getByDisplayValue("4242 4242 4242 4242");
    expect(card).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Simulate payment failure/i)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Pay FREE/i })).toBeInTheDocument();
    expect(screen.getByText(/mock payment for demonstration/i)).toBeInTheDocument();
  });

  test("BK-UI-015: Pay sends payment_result 'SUCCESS' (accepted by ConfirmPaymentSchema)", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    fireEvent.click(screen.getByRole("button", { name: /Pay FREE/i }));
    await waitFor(() => expect(confirmPostCall()).toBeDefined(), { timeout: 4000 });
    const body = JSON.parse((confirmPostCall()![1] as RequestInit).body as string);
    expect(body.payment_result).toBe("SUCCESS");
    expect(body.booking_id).toBe("BOOKING123-20260929");
    expect(
      ConfirmPaymentSchema.safeParse(body).success
    ).toBe(true);
  });

  test("BK-UI-016: the failure toggle sends payment_result 'FAILED' (accepted by ConfirmPaymentSchema)", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    fireEvent.click(screen.getByLabelText(/Simulate payment failure/i));
    fireEvent.click(screen.getByRole("button", { name: /Pay FREE/i }));
    await waitFor(() => expect(confirmPostCall()).toBeDefined(), { timeout: 4000 });
    const body = JSON.parse((confirmPostCall()![1] as RequestInit).body as string);
    expect(body.payment_result).toBe("FAILED");
    expect(ConfirmPaymentSchema.safeParse(body).success).toBe(true);
  });

  test("BK-UI-017: confirmed payment → confirmation panel + status dialog", async () => {
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    fireEvent.click(screen.getByRole("button", { name: /Pay FREE/i }));
    await waitFor(
      () => expect(screen.getByText("Booking Confirmed!")).toBeInTheDocument(),
      { timeout: 4000 }
    );
    expect(screen.getByText("Booking Reference")).toBeInTheDocument();
    expect(screen.getAllByText("BOOKING123-20260929").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Your trial class has been successfully booked.")
    ).toBeInTheDocument();
  });

  test("BK-UI-018: RPC code NO_SEATS_AVAILABLE is rendered by the dialog (code vs status drift)", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url) === "/api/payments/confirm") {
        return Promise.resolve(
          ok({
            success: true,
            data: { booking_id: "BOOKING123-20260929", status: "NO_SEATS_AVAILABLE" },
          })
        );
      }
      return defaultFetch(String(url), init);
    });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    fireEvent.click(screen.getByRole("button", { name: /Pay FREE/i }));
    await waitFor(
      () =>
        expect(
          screen.getByRole("heading", { name: "No Seats Available" })
        ).toBeInTheDocument(),
      { timeout: 4000 }
    );
    expect(
      screen.getByText("Sorry, this class is now full. Please try another class.")
    ).toBeInTheDocument();
  });

  test.todo(
    "BK-UI-018 Target [FIX L5]: dialog and a subsequent GET show the same state (stored status, not the RPC code)"
  );

  test("BK-UI-019: a 409 with a string error renders without crashing", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url) === "/api/payments/confirm") {
        return Promise.resolve(
          fail(409, {
            success: false,
            error:
              "Booking is not in pending payment status. Current status: CONFIRMED",
          })
        );
      }
      return defaultFetch(String(url), init);
    });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByText("Parent Information")).toBeInTheDocument());
    await submitBooking();
    fireEvent.click(screen.getByRole("button", { name: /Pay FREE/i }));
    await waitFor(
      () =>
        expect(
          screen.getByText(/Booking is not in pending payment status/i)
        ).toBeInTheDocument(),
      { timeout: 4000 }
    );
    expect(screen.queryByTestId("error-boundary")).toBeNull();
  });
});

describe("BK-NFR-003b display check (L6, jsdom half of BK-NFR-003)", () => {
  test("BK-NFR-003b: [BUG-ASSERT L9] an overbooked class (seats_remaining = -1) still advertises a seat", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        ok({
          success: true,
          data: [
            {
              id: "TRC-005",
              class_name: "OVERBOOKED TRIAL",
              subject: "MATH",
              start_time: "2026-10-05T10:00:00+08:00",
              max_seats: 4,
              confirmed_count: 5,
              seats_remaining: -1,
            },
          ],
        })
      )
    );
    render(<BookingsPage />);
    await waitFor(() =>
      expect(screen.getByText("OVERBOOKED TRIAL")).toBeInTheDocument()
    );
    expect(screen.getByText("1 seat left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /book now/i })).toBeInTheDocument();
  });

  test.todo(
    "BK-NFR-003b Target [FIX L9]: a negative seat count renders as 'No seats available' / Fully Booked"
  );
});

describe("BK-UI confirmation + payment pages", () => {
  test("BK-UI-020a: [BUG-ASSERT B14/B8] the confirmation page shows '[object Object]' for the API's 400", async () => {
    mockUseParams.mockReturnValue({ classId: "BOOKING123-20260929" });
    render(<ConfirmationPage />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bookings/BOOKING123-20260929"
      )
    );
    await waitFor(() => expect(screen.getByText(/\[object Object\]/)).toBeInTheDocument());
  });

  test.todo(
    "BK-UI-020a Target [FIX B4+B14]: the confirmation page loads the booking and renders its details"
  );

  test("BK-UI-020b: [BUG-ASSERT B15] the payment page sends the route param classId as booking_id", async () => {
    mockUseParams.mockReturnValue({ classId: "TRC-001" });
    render(<PaymentPage />);
    await waitFor(() =>
      expect(screen.getByText(/Payment Setup Failed/i)).toBeInTheDocument()
    );
    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/payments/create-intent")
    );
    expect(call).toBeDefined();
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
      booking_id: "TRC-001",
    });
  });

  test.todo(
    "BK-UI-020b Target [FIX B15]: create-intent is called with the booking id, and the payment page is reachable"
  );
});
