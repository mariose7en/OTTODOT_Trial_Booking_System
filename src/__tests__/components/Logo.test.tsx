/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/Logo";

describe("Logo component", () => {
  it("should render logo image", () => {
    render(<Logo />);
    const img = screen.getByAltText("Ottodot Logo");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/logo.webp");
  });

  it("should show text by default", () => {
    render(<Logo />);
    expect(screen.getByText("OTTODOT")).toBeInTheDocument();
  });

  it("should hide text when showText is false", () => {
    render(<Logo showText={false} />);
    expect(screen.queryByText("OTTODOT")).not.toBeInTheDocument();
  });

  it("should apply correct size classes", () => {
    const { rerender } = render(<Logo size="sm" />);
    const img = screen.getByAltText("Ottodot Logo");
    expect(img).toHaveClass("h-8");

    rerender(<Logo size="lg" />);
    expect(img).toHaveClass("h-16");
  });
});
