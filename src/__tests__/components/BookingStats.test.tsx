/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { BookingStats } from "@/components/BookingStats";

describe("BookingStats", () => {
  test("renders all four tiles with their values", () => {
    render(<BookingStats total={12} confirmed={7} pending={3} failed={2} />);

    expect(screen.getByText("Total Bookings")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Pending Payment")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("renders zeros without placeholder text", () => {
    render(<BookingStats total={0} confirmed={0} pending={0} failed={0} />);
    expect(screen.getAllByText("0")).toHaveLength(4);
    expect(screen.queryByText(/no data/i)).not.toBeInTheDocument();
  });

  test("tiles are laid out as a 2-column grid with brand colour classes", () => {
    const { container } = render(
      <BookingStats total={1} confirmed={1} pending={0} failed={0} />
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("grid");
    expect(grid.querySelectorAll(":scope > div")).toHaveLength(4);
    expect(grid.innerHTML).toContain("bg-ottodot-blue/10");
    expect(grid.innerHTML).toContain("bg-ottodot-green/10");
  });
});
