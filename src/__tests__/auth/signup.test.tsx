/**
 * L2 — registration flow (/auth/signup).
 * Test cases: LR-SU-001 … LR-SU-037 (automatable subset)
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "fs";
import path from "path";
import SignupPage from "@/app/auth/signup/page";
import { useAuth } from "@/lib/auth/client";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/auth/client", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
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

const mockSignUpWithEmail = jest.fn();
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ signUpWithEmail: mockSignUpWithEmail });
  mockSignUpWithEmail.mockResolvedValue({ data: {}, error: null });
});

function renderSignup() {
  const utils = render(<SignupPage />);
  const form = utils.container.querySelector("form") as HTMLFormElement;
  return { ...utils, form };
}

function fill(container: HTMLElement, email: string, password: string, confirm: string) {
  if (email !== "") fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  if (password !== "") fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  if (confirm !== "") fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
}

describe("LR-SU UI & structure", () => {
  test("LR-SU-001: renders Create account form", () => {
    renderSignup();
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  test("LR-SU-002: field types and required attributes", () => {
    renderSignup();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("required");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("required");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("required");
  });

  test("LR-SU-003: min-6 password hint is visible", () => {
    renderSignup();
    expect(screen.getByText("Must be at least 6 characters")).toBeInTheDocument();
  });

  test("LR-SU-004: cross-link to login exists", () => {
    renderSignup();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/auth/login"
    );
  });

  test("LR-SU-005: every input has an associated label (htmlFor/id pairs)", () => {
    renderSignup();
    for (const label of ["Email address", "Password", "Confirm password"]) {
      const el = screen.getByLabelText(label);
      expect(el.id).toBeTruthy();
    }
  });

  test("LR-SU-006: error region is NOT announced to assistive tech (current a11y defect, fix in F8)", async () => {
    mockSignUpWithEmail.mockResolvedValue({ data: {}, error: { message: "User already registered" } });
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    await screen.findByText("User already registered");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("LR-SU-007: submit disabled and label changes while pending", () => {
    mockSignUpWithEmail.mockReturnValue(new Promise(() => {}));
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    const button = screen.getByRole("button", { name: /creating account/i });
    expect(button).toBeDisabled();
  });

  test("LR-SU-008: render + error path produces no console.error/warn", async () => {
    const spyError = jest.spyOn(console, "error").mockImplementation(() => {});
    const spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSignUpWithEmail.mockResolvedValue({ data: {}, error: { message: "boom" } });
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    await screen.findByText("boom");
    expect(spyError).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    spyError.mockRestore();
    spyWarn.mockRestore();
  });
});

describe("LR-SU client-side validation (decision table)", () => {
  test("LR-SU-010: mismatched short passwords → 'Passwords do not match', no signUp", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "abc", "xyz");
    fireEvent.submit(form);
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  test("LR-SU-011: matching but 5 chars → min-6 message, no signUp (boundary)", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "12345", "12345");
    fireEvent.submit(form);
    expect(await screen.findByText("Password must be at least 6 characters")).toBeInTheDocument();
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  test("LR-SU-012: exactly 6 chars accepted → signUp called", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    await screen.findByText("Check your email");
    expect(mockSignUpWithEmail).toHaveBeenCalledTimes(1);
  });

  test("LR-SU-013: long mismatched passwords → mismatch message", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "aaaaaaaa", "bbbbbbbb");
    fireEvent.submit(form);
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  test("LR-SU-014: mismatch wins over length (validation order)", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "abc", "abcd");
    fireEvent.submit(form);
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(
      screen.queryByText("Password must be at least 6 characters")
    ).toBeNull();
  });

  test("LR-SU-015/016: HTML5 constraints present (browser blocks empty/malformed)", () => {
    renderSignup();
    const email = screen.getByLabelText("Email address") as HTMLInputElement;
    expect(email).toHaveAttribute("required");
    expect(email).toHaveAttribute("type", "email");
    expect(email.validity.valueMissing).toBe(true); // empty + required
    expect(email.validity.typeMismatch).toBe(false); // nothing to type-check yet
    fireEvent.change(email, { target: { value: "foo" } });
    expect(email.validity.typeMismatch).toBe(true); // not an email address
    // jsdom does not run interactive form validation on submit; the required/type
    // attributes above are what browsers enforce (no network call happens).
  });

  test("LR-SU-017: passwords with spaces are accepted (no trimming)", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", " 12345", " 12345");
    fireEvent.submit(form);
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(mockSignUpWithEmail).toHaveBeenCalledWith("a@b.co", " 12345");
  });

  test("LR-SU-018: min-6 is the ONLY password rule (no complexity requirement)", async () => {
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "abcdef", "abcdef");
    fireEvent.submit(form);
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
  });
});

describe("LR-SU registration success path", () => {
  test("LR-SU-020/021: success panel with email + Go to Login link", async () => {
    const { form } = renderSignup();
    fill(document.body, "parent@example.com", "123456", "123456");
    fireEvent.submit(form);
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/parent@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute(
      "href",
      "/auth/login"
    );
  });

  test("LR-SU-022: signUpWithEmail called exactly once with (email, password)", async () => {
    const { form } = renderSignup();
    fill(document.body, "parent@example.com", "secret1", "secret1");
    fireEvent.submit(form);
    await screen.findByText("Check your email");
    expect(mockSignUpWithEmail).toHaveBeenCalledTimes(1);
    expect(mockSignUpWithEmail).toHaveBeenCalledWith(
      "parent@example.com",
      "secret1"
    );
  });

  test("LR-SU-023: signup never touches the database via the supabase singleton (no parents insert)", async () => {
    const { form } = renderSignup();
    fill(document.body, "parent@example.com", "secret1", "secret1");
    fireEvent.submit(form);
    await screen.findByText("Check your email");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test("LR-SU-024: remounting after success shows a fresh form", async () => {
    const { form, unmount } = renderSignup();
    fill(document.body, "parent@example.com", "secret1", "secret1");
    fireEvent.submit(form);
    await screen.findByText("Check your email");
    unmount();
    render(<SignupPage />);
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
  });

  test("LR-SU-030: Supabase duplicate-user error is surfaced verbatim", async () => {
    mockSignUpWithEmail.mockResolvedValue({
      data: {},
      error: { message: "User already registered" },
    });
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    expect(await screen.findByText("User already registered")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
  });

  test.each([
    ["LR-SU-031", "Invalid email address"],
    ["LR-SU-032", "Password should be at least 6 characters"],
    ["LR-SU-033", "For security purposes, you can only request this after 60 seconds"],
  ])("%s: server-side error message shown", async (_id, message) => {
    mockSignUpWithEmail.mockResolvedValue({ data: {}, error: { message } });
    const { form } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeEnabled();
  });

  test("LR-SU-036: error object WITHOUT .message renders nothing (pins B8-class defect — fix in F1)", async () => {
    mockSignUpWithEmail.mockResolvedValue({ data: {}, error: { code: "some_code" } });
    const { form, container } = renderSignup();
    fill(document.body, "a@b.co", "123456", "123456");
    fireEvent.submit(form);
    await waitFor(() => expect(mockSignUpWithEmail).toHaveBeenCalledTimes(1));
    // Current behaviour: setError(undefined) → no error box, user gets no feedback.
    expect(container.querySelector(".bg-red-50")).toBeNull();
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
  });

  test("LR-SU-034: no try/catch around signUpWithEmail → rejection escapes unhandled (pin defect, F1)", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "auth", "signup", "page.tsx"),
      "utf8"
    );
    const start = source.indexOf("const handleSubmit");
    const end = source.indexOf("if (success)");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const handler = source.slice(start, end);
    expect(handler).toContain("await signUpWithEmail");
    expect(handler).not.toMatch(/try\s*\{/);
    expect(handler).not.toMatch(/\.catch\(/);
    // Behavioural proof is an unhandled rejection at runtime (observed in L5);
    // it cannot be asserted here because Jest fails the suite on it.
  });
});
