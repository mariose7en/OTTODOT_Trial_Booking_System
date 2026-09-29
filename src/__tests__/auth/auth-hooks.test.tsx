/**
 * L1 — auth hooks & helpers (src/lib/auth/client.ts, src/lib/auth/server.ts).
 * Test cases: LR-UT-001 … LR-UT-012
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@supabase/ssr", () => {
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
    signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
  };
  return {
    createBrowserClient: jest.fn(() => ({ auth })),
    createServerClient: jest.fn((_url: string, _key: string, opts: unknown) => ({ auth, opts })),
  };
});

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { useAuth, useSupabase } from "@/lib/auth/client";
import { createServerSupabaseClient } from "@/lib/auth/server";

type AuthMock = {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  signInWithOtp: jest.Mock;
  signOut: jest.Mock;
};

const authMock = (): AuthMock =>
  (createBrowserClient as jest.Mock)().auth as AuthMock;

const srcFile = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), "src", rel), "utf8");

const allSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : allSourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

beforeEach(() => {
  jest.clearAllMocks();
  (createBrowserClient as jest.Mock).mockClear();
  authMock(); // instantiate the shared mock auth client
});

describe("LR-UT useAuth() contract", () => {
  test("LR-UT-001: exposes the documented return shape", async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toEqual(
      expect.objectContaining({
        user: null,
        session: null,
        signInWithEmail: expect.any(Function),
        signUpWithEmail: expect.any(Function),
        signInWithMagicLink: expect.any(Function),
        signOut: expect.any(Function),
      })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test("LR-UT-002: loading starts true and flips false after getSession resolves", async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(authMock().getSession).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  test("LR-UT-003: subscribes to onAuthStateChange and unsubscribes on unmount", async () => {
    const { result, unmount } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(authMock().onAuthStateChange).toHaveBeenCalledTimes(1);
    const unsubscribe =
      authMock().onAuthStateChange.mock.results[0].value.data.subscription
        .unsubscribe;
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test("LR-UT-007: signInWithEmail delegates to signInWithPassword with exact args", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signInWithEmail("a@example.com", "secret123");
    });
    expect(authMock().signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "secret123",
    });
  });

  test("LR-UT-005: signUpWithEmail sends ONLY { email, password } — no options, no metadata", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signUpWithEmail("new@example.com", "secret123");
    });
    expect(authMock().signUp).toHaveBeenCalledTimes(1);
    expect(authMock().signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "secret123",
    });
    expect(Object.keys(authMock().signUp.mock.calls[0][0])).toEqual([
      "email",
      "password",
    ]);
  });

  test("LR-UT-006: signInWithMagicLink uses OTP with emailRedirectTo → /auth/callback", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signInWithMagicLink("magic@example.com");
    });
    expect(authMock().signInWithOtp).toHaveBeenCalledWith({
      email: "magic@example.com",
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  test("LR-UT-008: signOut delegates to supabase.auth.signOut and returns { error }", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let out: unknown;
    await act(async () => {
      out = await result.current.signOut();
    });
    expect(authMock().signOut).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ error: null });
  });

  test("LR-UT-004: a session returned by getSession populates user", async () => {
    const user = { id: "auth-uuid-1", email: "a@example.com" };
    authMock().getSession.mockResolvedValueOnce({
      data: { session: { user } },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(user);
    expect(result.current.session).toEqual({ user });
  });

  test("useSupabase returns a client instance", () => {
    const { result } = renderHook(() => useSupabase());
    expect(result.current).toBeTruthy();
    expect(result.current.auth).toBeDefined();
  });
});

describe("LR-UT server helpers (lib/auth/server.ts)", () => {
  test("LR-UT-009: createServerSupabaseClient wires cookie get/set/remove adapters", async () => {
    await createServerSupabaseClient();
    expect(createServerClient).toHaveBeenCalledTimes(1);
    const [, , options] = (createServerClient as jest.Mock).mock.calls[0];
    expect(typeof options.cookies.get).toBe("function");
    expect(typeof options.cookies.set).toBe("function");
    expect(typeof options.cookies.remove).toBe("function");
  });

  test("LR-UT-010: cookie set failures are swallowed (no throw in RSC context)", async () => {
    (cookies as unknown as jest.Mock).mockReturnValue({
      get: jest.fn(),
      set: jest.fn(() => {
        throw new Error("Cookies can only be modified in a Server Action");
      }),
    });
    await createServerSupabaseClient();
    const [, , options] = (createServerClient as jest.Mock).mock.calls[0];
    expect(() =>
      options.cookies.set("sb-test", "value", { path: "/" })
    ).not.toThrow();
    expect(() =>
      options.cookies.remove("sb-test", { path: "/" })
    ).not.toThrow();
  });
});

describe("LR-UT source-level wiring", () => {
  test("LR-UT-011: getSession/getUser/signOut from lib/auth/server are NOT imported anywhere (dead exports)", () => {
    const files = allSourceFiles(path.join(process.cwd(), "src"));
    const importers = files.filter((file) => {
      if (file.endsWith(path.join("lib", "auth", "server.ts"))) return false;
      const content = fs.readFileSync(file, "utf8");
      return (
        /from\s+["']@\/lib\/auth\/server["']/.test(content) &&
        /\b(getSession|getUser|signOut)\b/.test(
          content.replace(/import\s*\{[^}]*\}\s*from\s*["']@\/lib\/auth\/server["'];?/g, (m) =>
            /getSession|getUser|signOut/.test(m) ? m : ""
          )
        )
      );
    });
    // Known importer: auth/callback/route.ts uses createServerSupabaseClient only.
    expect(importers).toEqual([]);
  });

  test("LR-UT-012: all three Supabase clients read the same two public env vars", () => {
    const files = [
      "lib/supabase.ts",
      "lib/auth/client.ts",
      "lib/auth/server.ts",
      "middleware.ts",
    ];
    for (const rel of files) {
      const content = srcFile(rel);
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });
});
