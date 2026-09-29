/**
 * L4 — auth middleware decision table (src/middleware.ts).
 * Test cases: LR-MW-001 … LR-MW-022 (automatable subset)
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { middleware, config } from "@/middleware";

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

const ORIGIN = "http://localhost:3000";
const mockGetUser = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

let capturedCookies: {
  get: (n: string) => string | undefined;
  set: (n: string, v: string, o: unknown) => void;
  remove: (n: string, o: unknown) => void;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockSingle.mockResolvedValue({ data: null, error: { message: "no row" } });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
  (createServerClient as unknown as jest.Mock).mockImplementation(
    (_url: string, _key: string, opts: { cookies: typeof capturedCookies }) => {
      capturedCookies = opts.cookies;
      return { auth: { getUser: mockGetUser }, from: mockFrom };
    }
  );
});

const run = (target: string) =>
  middleware(new NextRequest(`${ORIGIN}${target}`));

const locationOf = (res: Response): URL => {
  const header = res.headers.get("location");
  expect(header).toBeTruthy();
  return new URL(header as string);
};

const signIn = (id = "auth-uuid-1") =>
  mockGetUser.mockResolvedValue({ data: { user: { id, email: "p@example.com" } } });

const matcherBase = (pattern: string) =>
  pattern.replace(/:path\*$/, "").replace(/\/$/, "");

const matcherCovers = (pathname: string) =>
  config.matcher.some((pattern) => {
    const base = pattern.replace(/:path\*$/, ""); // "/bookings/"
    return pathname === matcherBase(pattern) || pathname.startsWith(base);
  });

describe("LR-MW anonymous access", () => {
  test("LR-MW-001: /admin → /auth/login?next=/admin", async () => {
    const url = locationOf(await run("/admin"));
    expect(url.pathname).toBe("/auth/login");
    expect(url.searchParams.get("next")).toBe("/admin");
  });

  test("LR-MW-002: /admin/bookings → login with next=/admin/bookings", async () => {
    const url = locationOf(await run("/admin/bookings"));
    expect(url.pathname).toBe("/auth/login");
    expect(url.searchParams.get("next")).toBe("/admin/bookings");
  });

  test("LR-MW-003: /bookings/TRC-001 → login with next kept", async () => {
    const url = locationOf(await run("/bookings/TRC-001"));
    expect(url.pathname).toBe("/auth/login");
    expect(url.searchParams.get("next")).toBe("/bookings/TRC-001");
  });

  test("LR-MW-004: bare /bookings PASSES THROUGH unprotected [BUG-ASSERT] — D-05", async () => {
    const res = await run("/bookings");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(mockGetUser).toHaveBeenCalled();
  });

  test("LR-MW-005: matcher does not cover /roster or /payments/history", () => {
    expect(matcherCovers("/roster")).toBe(false);
    expect(matcherCovers("/payments/history")).toBe(false);
    expect(matcherCovers("/bookings")).toBe(true);
    expect(matcherCovers("/admin")).toBe(true);
  });

  test("LR-MW-006: anonymous /auth/login passes through", async () => {
    const res = await run("/auth/login");
    expect(res.headers.get("location")).toBeNull();
  });

  test("LR-MW-007: anonymous /auth/callback passes through (not in authRoutes)", async () => {
    const res = await run("/auth/callback");
    expect(res.headers.get("location")).toBeNull();
  });

  test("LR-MW-008: matcher omits /api/* — no API auth anywhere [BUG-ASSERT] (B10)", () => {
    expect(matcherCovers("/api/trials")).toBe(false);
    expect(config.matcher).not.toEqual(expect.arrayContaining([expect.stringContaining("/api")]));
  });

  test("LR-MW-019: redirect next= carries pathname only — query lost [BUG-ASSERT]", async () => {
    const url = locationOf(await run("/bookings/TRC-001?classId=TRC-001"));
    expect(url.searchParams.get("next")).toBe("/bookings/TRC-001");
    expect(url.search).not.toContain("classId");

    // Bare /bookings with a query is equally unprotected today (D-05).
    const res = await run("/bookings?classId=TRC-001");
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("LR-MW authenticated access", () => {
  test("LR-MW-009: parent on /bookings/TRC-001 passes through", async () => {
    signIn();
    const res = await run("/bookings/TRC-001");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  test("LR-MW-010: authed user with no parents row on /admin → 307 to /", async () => {
    signIn();
    mockSingle.mockResolvedValue({ data: null, error: { message: "no row" } });
    const url = locationOf(await run("/admin"));
    expect(url.pathname).toBe("/");
    expect(mockFrom).toHaveBeenCalledWith("parents");
    expect(mockSelect).toHaveBeenCalledWith("role");
    expect(mockEq).toHaveBeenCalledWith("id", "auth-uuid-1");
    expect(mockSingle).toHaveBeenCalledTimes(1);
  });

  test("LR-MW-011: parents row with role=parent on /admin → /", async () => {
    signIn();
    mockSingle.mockResolvedValue({ data: { role: "parent" }, error: null });
    const url = locationOf(await run("/admin"));
    expect(url.pathname).toBe("/");
  });

  test("LR-MW-012: parents row with role=admin keyed by auth UUID → passes", async () => {
    signIn();
    mockSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
    const res = await run("/admin");
    expect(res.headers.get("location")).toBeNull();
  });

  test("LR-MW-013: seeded admin PAR-001 (id ≠ auth UUID) can never reach /admin [BUG-ASSERT] (B9/D-01)", async () => {
    signIn("00000000-0000-4000-8000-000000000000");
    // The seed row lives under parents.id = 'PAR-001', so the auth-UUID lookup
    // returns no row even though the account is role=admin in the seed.
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const url = locationOf(await run("/admin"));
    expect(url.pathname).toBe("/");
  });

  test("LR-MW-014: authed on /auth/login → 307 to /bookings", async () => {
    signIn();
    const url = locationOf(await run("/auth/login"));
    expect(url.pathname).toBe("/bookings");
  });

  test("LR-MW-015: authed on /auth/signup → 307 to /bookings", async () => {
    signIn();
    const url = locationOf(await run("/auth/signup"));
    expect(url.pathname).toBe("/bookings");
  });

  test("LR-MW-016: authed on /auth/callback passes through", async () => {
    signIn();
    const res = await run("/auth/callback");
    expect(res.headers.get("location")).toBeNull();
  });

  test("LR-MW-020: parents query error is swallowed → fail-closed redirect, no throw", async () => {
    signIn();
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(run("/admin")).resolves.toBeInstanceOf(Response);
    const url = locationOf(await run("/admin"));
    expect(url.pathname).toBe("/");
  });
});

describe("LR-MW session refresh / cookie handling (D-06)", () => {
  const refreshingUser = () =>
    mockGetUser.mockImplementation(async () => {
      capturedCookies.set("sb-test-auth-token", "refreshed", { path: "/" });
      return { data: { user: { id: "auth-uuid-1" } } };
    });

  test("LR-MW-018a: pass-through response carries the refreshed cookie", async () => {
    refreshingUser();
    const res = await run("/bookings/TRC-001");
    expect(res.headers.get("set-cookie")).toContain("sb-test-auth-token=refreshed");
  });

  test("LR-MW-018b: redirect branch DROPS the refreshed cookie [BUG-ASSERT] — D-06", async () => {
    refreshingUser();
    const res = await run("/auth/login");
    expect(res.headers.get("location")).toBeTruthy();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("LR-MW config shape", () => {
  test("LR-MW-017: matcher deep-equals the documented list (drift guard)", () => {
    expect(config.matcher).toEqual([
      "/admin/:path*",
      "/bookings/:path*",
      "/auth/:path*",
    ]);
  });
});

// Documented-only case: .single() cannot return >1 row (PK on parents.id).
test.todo("LR-MW-021: .single() multi-row — impossible with parents PK (document only)");

// Client-side gate in src/app/payments/history/page.tsx:33 pushes /auth/login
// without a next param, so the round trip lands on /bookings after login.
test.todo(
  "LR-MW-022: /payments/history client gate (router.push without next) — covered when that page is under test"
);
