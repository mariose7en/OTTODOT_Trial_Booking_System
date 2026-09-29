/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/Footer";

describe("Footer", () => {
  test("renders the brand, tagline and sub-tagline", () => {
    render(<Footer />);
    expect(
      screen.getByText("Trial Booking System for Live Online Science & Math Classes")
    ).toBeInTheDocument();
    expect(screen.getByText("Game-based learning for Primary 1-6")).toBeInTheDocument();
  });

  test("renders a copyright line with the current year", () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved\.?/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(String(new Date().getFullYear())))
    ).toBeInTheDocument();
  });

  test("renders a logo image", () => {
    render(<Footer />);
    const img = screen.getByAltText(/ottodot/i);
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toContain("logo");
  });

  test("[BUG-ASSERT duplicate] the brand text is hard-coded in the footer instead of coming from Logo", () => {
    const { container } = render(<Footer />);
    const brandSpan = container.querySelector("span.font-heading");
    expect(brandSpan?.textContent).toBe("OTTODOT");
    // the same word also lives in Logo.tsx — two sources of truth (fix_plan §4.4)
    expect(
      screen.queryAllByText("OTTODOT").length
    ).toBeGreaterThanOrEqual(1);
  });

  test.todo(
    "Target: a single brand-text source shared by Footer and Logo (fix_plan §4.4 / F6)"
  );
});
