/**
 * L3 — OAuth/magic-link callback route (src/app/auth/callback/route.ts).
 * Test cases: LR-CB-001 … LR-CB-015 (automatable subset)
 * @jest-environment node
 */
import { GET } from "@/app/auth/callback/route";
import { createServerSupabaseClient } from "@/lib/auth/server";

jest.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

const ORIGIN = "http://localhost:3000";
const mockExchange = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (createServerSupabaseClient as unknown as jest.Mock).mockReturnValue({
    auth: { exchangeCodeForSession: mockExchange },
  });
  mockExchange.mockResolvedValue({ error: null });
});

const req = (query = "") => new Request(`${ORIGIN}/auth/callback${query}`);

const location = (res: Response): URL => {
  const header = res.headers.get("location");
  expect(header).toBeTruthy();
  return new URL(header as string);
};

describe("LR-CB failure redirects", () => {
  test("LR-CB-001: missing code → 307 to /auth/login?error=Could not authenticate", async () => {
    const res = await GET(req());
    expect(res.status).toBe(307);
    const url = location(res);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/auth/login");
    expect(url.searchParams.get("error")).toBe("Could not authenticate");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  test("LR-CB-013: empty code string is falsy → same failure redirect", async () => {
    const res = await GET(req("?code="));
    expect(res.status).toBe(307);
    expect(location(res).pathname).toBe("/auth/login");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  test("LR-CB-002: exchange resolving with error → failure redirect", async () => {
    mockExchange.mockResolvedValue({ error: { message: "bad code" } });
    const res = await GET(req("?code=bad"));
    expect(res.status).toBe(307);
    const url = location(res);
    expect(url.pathname).toBe("/auth/login");
    expect(url.searchParams.get("error")).toBe("Could not authenticate");
    expect(mockExchange).toHaveBeenCalledWith("bad");
  });

  test("LR-CB-015: unexpected throw from exchange is UNHANDLED (no try/catch) — pins defect", async () => {
    mockExchange.mockRejectedValue(new Error("exchange blew up"));
    await expect(GET(req("?code=ok"))).rejects.toThrow("exchange blew up");
  });
});

describe("LR-CB success redirects", () => {
  test("LR-CB-003: success without next → origin root", async () => {
    const res = await GET(req("?code=ok"));
    expect(res.status).toBe(307);
    const url = location(res);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/");
    expect(mockExchange).toHaveBeenCalledWith("ok");
  });

  test("LR-CB-004: relative next → same-origin path", async () => {
    const url = location(await GET(req("?code=ok&next=/bookings")));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/bookings");
  });

  test("LR-CB-005: nested relative next → same-origin path", async () => {
    const url = location(await GET(req("?code=ok&next=/admin/bookings")));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/admin/bookings");
  });
});

describe("LR-CB open-redirect vectors (L13 / D-02, D-03)", () => {
  test("LR-CB-006: next=@evil.com redirects OFF-SITE [BUG-ASSERT] — file D-02", async () => {
    const res = await GET(req("?code=ok&next=@evil.com"));
    const url = location(res);
    expect(url.origin).not.toBe(ORIGIN);
    expect(url.host).toBe("evil.com");
  });

  test("LR-CB-007: next=https://evil.com throws Invalid URL → unhandled 500 [BUG-ASSERT] — file D-03", async () => {
    await expect(GET(req("?code=ok&next=https://evil.com"))).rejects.toThrow(
      /URL is malformed|Invalid URL/
    );
  });

  test("LR-CB-008: protocol-relative next=//evil.com stays same-origin", async () => {
    const url = location(await GET(req("?code=ok&next=//evil.com")));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("//evil.com");
  });

  test("LR-CB-009: backslash variant next=/\\evil.com stays same-origin", async () => {
    const url = location(await GET(req("?code=ok&next=/\\evil.com")));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("//evil.com");
  });

  test("LR-CB-010: encoded variant next=%2f%2fevil.com stays same-origin", async () => {
    const url = location(await GET(req("?code=ok&next=%2f%2fevil.com")));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("//evil.com");
  });

  test("LR-CB-011: empty next= → falls back to origin root ('??' only guards null)", async () => {
    const url = location(await GET(req("?code=ok&next=")));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/");
  });

  test("LR-CB-012: 10k-char next does not crash and stays same-origin", async () => {
    const huge = `/${"x".repeat(10000)}`;
    const url = location(await GET(req(`?code=ok&next=${huge}`)));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toHaveLength(10001);
  });
});

// Session cookie is written by the @supabase/ssr adapter via next/headers
// (not by the route handler), so it is only observable end-to-end.
test.todo("LR-CB-014: Set-Cookie for the session is present on a real success round trip (L5 E2E)");
