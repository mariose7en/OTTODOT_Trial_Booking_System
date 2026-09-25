/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/Header";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn().mockReturnValue("/"),
}));

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe("Header component", () => {
  it("should render Ottodot logo", () => {
    render(<Header />);
    const logo = screen.getByAltText("Ottodot Logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/logo.webp");
  });

  it("should render OTTODOT text", () => {
    render(<Header />);
    expect(screen.getByText("OTTODOT")).toBeInTheDocument();
  });

  it("should render navigation links", () => {
    render(<Header />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Book a Class")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("should render mobile menu button", () => {
    render(<Header />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("should link to correct pages", () => {
    render(<Header />);
    
    const homeLink = screen.getByText("Home").closest("a");
    const bookingsLink = screen.getByText("Book a Class").closest("a");
    const rosterLink = screen.getByText("Roster").closest("a");
    const adminLink = screen.getByText("Admin").closest("a");

    expect(homeLink).toHaveAttribute("href", "/");
    expect(bookingsLink).toHaveAttribute("href", "/bookings");
    expect(rosterLink).toHaveAttribute("href", "/roster");
    expect(adminLink).toHaveAttribute("href", "/admin");
  });
});
