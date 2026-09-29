/**
 * L2/L4 — chrome-level auth affordances (Header/Footer/Layout).
 * Test cases: LR-CH-001 … LR-CH-004 (automatable subset)
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
  useRouter: jest.fn(() => ({ push: jest.fn(), refresh: jest.fn() })),
}));

jest.mock("next/link", () => {
  function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  }
  return MockLink;
});

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const authSourceFiles = (): string[] => {
  const layoutFiles = [
    "src/app/layout.tsx",
    "src/app/bookings/layout.tsx",
    "src/app/admin/layout.tsx",
  ].filter((f) => fs.existsSync(path.join(process.cwd(), f)));
  return [...layoutFiles, "src/components/Header.tsx", "src/components/Footer.tsx"];
};

describe("LR-CH chrome", () => {
  test("LR-CH-001: no Login/Signup entry point exists in Header, Footer or layouts", () => {
    const { container } = render(
      <>
        <Header />
        <Footer />
      </>
    );
    const links = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(links).not.toContain("/auth/login");
    expect(links).not.toContain("/auth/signup");
    for (const file of authSourceFiles()) {
      const source = read(file);
      expect(source).not.toMatch(/href=["']\/auth\/login["']/);
      expect(source).not.toMatch(/href=["']\/auth\/signup["']/);
    }
  });

  test("LR-CH-002: no Sign out control exists and signOut() is never invoked [BUG-ASSERT] (D-07)", () => {
    const { container } = render(<Header />);
    expect(
      screen.queryByRole("button", { name: /sign out|log ?out/i })
    ).toBeNull();
    expect(container.textContent).not.toMatch(/sign out|log ?out/i);
    // Dead-export proof: no component ever calls signOut().
    const componentDir = path.join(process.cwd(), "src", "components");
    const offenders = fs
      .readdirSync(componentDir)
      .filter((f) => /\.tsx$/.test(f))
      .filter((f) =>
        /\bsignOut\b/.test(fs.readFileSync(path.join(componentDir, f), "utf8"))
      );
    expect(offenders).toEqual([]);
  });

  test("LR-CH-003: nav is identical for authed vs anonymous (no auth state in chrome)", () => {
    const anon = render(<Header />);
    const anonLinks = Array.from(
      anon.container.querySelectorAll("nav a")
    ).map((a) => a.getAttribute("href"));
    anon.unmount();

    const authed = render(<Header />);
    const authedLinks = Array.from(
      authed.container.querySelectorAll("nav a")
    ).map((a) => a.getAttribute("href"));

    expect(authedLinks).toEqual(anonLinks);
    expect(anonLinks).toEqual(["/", "/bookings", "/roster", "/admin"]);
    // Header never consults auth state.
    const source = read("src/components/Header.tsx");
    expect(source).not.toMatch(/useAuth|supabase|session|user\b/);
  });

  test("LR-CH-004: Admin link is shown to anonymous users", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });
});

// Logout/session-expiry flows are L5 (E2E) — see plan §11.
test.todo("LR-CH-005: E2E logout clears the session cookie and /admin redirects to login");
test.todo("LR-CH-006: E2E session expiry → protected nav redirects to login with next");
test.todo("LR-CH-007: /payments/history anon → client redirect to /auth/login (no next)");
test.todo("LR-CH-008: ?next= round trip after fix (currently lands on /bookings)");
