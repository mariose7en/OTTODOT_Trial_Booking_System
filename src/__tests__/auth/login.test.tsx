/**
 * L2 — login flow (/auth/login).
 * Test cases: LR-LG-001 … LR-LG-020, LR-LG-030 … LR-LG-034, LR-LG-040/041/045
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "fs";
import path from "path";
import LoginPage from "@/app/auth/login/page";
import { useAuth } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

jest.mock("@/lib/auth/client", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next/link", () => {
  function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  }
  return MockLink;
});

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockSignInWithMagicLink = jest.fn();
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, "", "/auth/login");
  mockUseAuth.mockReturnValue({
    signInWithEmail: mockSignInWithEmail,
    signInWithMagicLink: mockSignInWithMagicLink,
  });
  mockSignInWithEmail.mockResolvedValue({ error: null });
  mockSignInWithMagicLink.mockResolvedValue({ error: null });
  (useRouter as unknown as jest.Mock).mockReturnValue({
    push: mockPush,
    refresh: mockRefresh,
    replace: jest.fn(),
  });
});

function renderLogin() {
  const utils = render(<LoginPage />);
  const form = utils.container.querySelector("form") as HTMLFormElement;
  return { ...utils, form };
}

function fillPassword(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("LR-LG UI & structure", () => {
  test("LR-LG-001: renders Welcome back with email + password + Sign In", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  test("LR-LG-002: password mode is the default (magic panel hidden)", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Password" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Magic Link" })).toBeNull();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  test("LR-LG-003: toggling to Magic Link hides password and back restores it", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByRole("button", { name: "Send Magic Link" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Password" }));
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Magic Link" })).toBeNull();
  });

  test("LR-LG-004: toggle clicks never trigger an auth call", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    fireEvent.click(screen.getByRole("button", { name: "Password" }));
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
    expect(mockSignInWithMagicLink).not.toHaveBeenCalled();
  });

  test("LR-LG-005: cross-link to signup", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/auth/signup"
    );
  });

  test("LR-LG-006: inputs are labelled via htmlFor/id; no password strength hint", () => {
    renderLogin();
    expect(screen.getByLabelText("Email address").id).toBe("email");
    expect(screen.getByLabelText("Password").id).toBe("password");
    expect(screen.queryByText(/at least 6 characters/i)).toBeNull();
  });

  test("LR-LG-007: error region has NO role=alert/aria-live (current a11y defect, fix in F8)", async () => {
    mockSignInWithEmail.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const { form } = renderLogin();
    fillPassword("a@example.com", "wrong");
    fireEvent.submit(form);
    await screen.findByText("Invalid login credentials");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("LR-LG-008: pending login disables the button and swaps the label", () => {
    mockSignInWithEmail.mockReturnValue(new Promise(() => {}));
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    const button = screen.getByRole("button", { name: "Signing in..." });
    expect(button).toBeDisabled();
  });

  test("LR-LG-009: render + error interaction produces no console.error/warn", async () => {
    const spyError = jest.spyOn(console, "error").mockImplementation(() => {});
    const spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSignInWithEmail.mockResolvedValue({ error: { message: "boom" } });
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    await screen.findByText("boom");
    expect(spyError).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    spyError.mockRestore();
    spyWarn.mockRestore();
  });
});

describe("LR-LG password login", () => {
  test("LR-LG-010: success pushes /bookings and calls refresh exactly once", async () => {
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/bookings"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockSignInWithEmail).toHaveBeenCalledWith("a@example.com", "secret");
  });

  test("LR-LG-011: hook receives unmodified strings (no app-side trim, no lowercase)", async () => {
    const { form } = renderLogin();
    fillPassword("  Mixed.Case@Example.COM  ", "  secret  ");
    fireEvent.submit(form);
    await waitFor(() => expect(mockSignInWithEmail).toHaveBeenCalledTimes(1));
    // type=email strips surrounding whitespace (DOM sanitization only);
    // the value is NOT lowercased and the password is passed verbatim.
    expect(mockSignInWithEmail).toHaveBeenCalledWith(
      "Mixed.Case@Example.COM",
      "  secret  "
    );
  });

  test("LR-LG-012: wrong password shows message, no redirect, button re-enabled", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { form } = renderLogin();
    fillPassword("a@example.com", "wrong");
    fireEvent.submit(form);
    expect(
      await screen.findByText("Invalid login credentials")
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
  });

  test("LR-LG-013: unknown email yields the same generic message (no enumeration in UI)", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { form } = renderLogin();
    fillPassword("ghost@example.com", "whatever1");
    fireEvent.submit(form);
    expect(
      await screen.findByText("Invalid login credentials")
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("LR-LG-014: empty fields fail HTML5 validation → browser blocks, no network call", () => {
    const { form } = renderLogin();
    expect(form.checkValidity()).toBe(false); // email+password are required
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  test("LR-LG-015: malformed email fails HTML5 validation", () => {
    const { form } = renderLogin();
    fillPassword("foo", "secret");
    expect(form.checkValidity()).toBe(false); // type=email mismatch
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  test("LR-LG-016: unconfirmed-account error message shown verbatim", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: { message: "Email not confirmed" },
    });
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    expect(await screen.findByText("Email not confirmed")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("LR-LG-017: no try/catch around signInWithEmail → rejection escapes unhandled (pin defect, F1)", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "auth", "login", "page.tsx"),
      "utf8"
    );
    const start = source.indexOf("const handlePasswordLogin");
    const end = source.indexOf("const handleMagicLinkLogin");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const handler = source.slice(start, end);
    expect(handler).toContain("await signInWithEmail");
    expect(handler).not.toMatch(/try\s*\{/);
    expect(handler).not.toMatch(/\.catch\(/);
    // Behavioural proof is an unhandled rejection at runtime (observed in L5);
    // it cannot be asserted here because Jest fails the suite on it.
  });

  test("LR-LG-018: object error renders its message, never [object Object]", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Too many attempts" },
    });
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    expect(await screen.findByText("Too many attempts")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  test("LR-LG-019: rate-limit message shown and button re-enabled", async () => {
    mockSignInWithEmail.mockResolvedValue({
      error: { message: "Too many requests" },
    });
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
  });

  test("LR-LG-020: second submit while pending does not fire a duplicate auth call", async () => {
    mockSignInWithEmail.mockReturnValue(new Promise(() => {}));
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Signing in..." }));
    expect(mockSignInWithEmail).toHaveBeenCalledTimes(1);
  });

  test("LR-LG-034: no password input in magic-link mode", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
});

describe("LR-LG magic-link login", () => {
  test("LR-LG-030: OTP hook called with email + emailRedirectTo → /auth/callback", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "a@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Magic Link" }));
    await waitFor(() => expect(mockSignInWithMagicLink).toHaveBeenCalledTimes(1));
    expect(mockSignInWithMagicLink).toHaveBeenCalledWith("a@example.com");
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  test("LR-LG-031: success panel with entered email, no redirect", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "parent@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Magic Link" }));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/parent@example.com/)).toBeInTheDocument();
    expect(
      screen.getByText(/click the link in the email to sign in/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("LR-LG-032: magic-link failure keeps the form and shows the error", async () => {
    renderLogin();
    mockSignInWithMagicLink.mockResolvedValue({
      error: { message: "Unable to process email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "a@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Magic Link" }));
    expect(await screen.findByText("Unable to process email")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  test("LR-LG-033: server-side invalid email error surfaced", async () => {
    renderLogin();
    mockSignInWithMagicLink.mockResolvedValue({
      error: { message: "Invalid email address" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "a@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Magic Link" }));
    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
  });
});

describe("LR-LG query-string behaviour (?next / ?error)", () => {
  test("LR-LG-040: ?next= is IGNORED — login still pushes /bookings [BUG-ASSERT] (D-05/F4)", async () => {
    window.history.pushState({}, "", "/auth/login?next=%2Fadmin");
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(mockPush).toHaveBeenCalledWith("/bookings");
    expect(mockPush).not.toHaveBeenCalledWith("/admin");
  });

  test("LR-LG-041: ?error= is never rendered [BUG-ASSERT] (D-04/F1)", () => {
    window.history.pushState({}, "", "/auth/login?error=Could%20not%20authenticate");
    renderLogin();
    expect(
      screen.queryByText("Could not authenticate")
    ).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("LR-LG-045: ?next=@evil.com — no redirect occurs at all today [BUG-ASSERT]", async () => {
    window.history.pushState({}, "", "/auth/login?next=@evil.com");
    const { form } = renderLogin();
    fillPassword("a@example.com", "secret");
    fireEvent.submit(form);
    await waitFor(() => expect(mockSignInWithEmail).toHaveBeenCalledTimes(1));
    expect(mockPush).toHaveBeenCalledWith("/bookings");
  });
});
