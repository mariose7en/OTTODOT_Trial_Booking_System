/**
 * @jest-environment jsdom
 */
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import {
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  BookingCardSkeleton,
  ClassCardSkeleton,
  StatsCardSkeleton,
  RosterSkeleton,
  FormSkeleton,
} from "@/components/Skeleton";

describe("Skeleton primitives", () => {
  test("is hidden from assistive tech and pulses", () => {
    const { container } = render(<Skeleton />);
    const node = container.firstElementChild as HTMLElement;
    expect(node).toHaveAttribute("aria-hidden", "true");
    expect(node.className).toContain("animate-pulse");
    expect(node.className).toContain("bg-gray-200");
  });

  test("applies width, height and rounded variants via inline style / class", () => {
    const { container } = render(
      <Skeleton width="100px" height={40} rounded="full" className="mt-2" />
    );
    const node = container.firstElementChild as HTMLElement;
    expect(node.style.width).toBe("100px");
    expect(node.style.height).toBe("40px");
    expect(node.className).toContain("rounded-full");
    expect(node.className).toContain("mt-2");
  });

  test("default rounding is rounded-md", () => {
    const { container } = render(<Skeleton />);
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "rounded-md"
    );
  });
});

describe("composed skeletons", () => {
  const cases: Array<[string, ReactElement]> = [
    ["CardSkeleton", <CardSkeleton key="c" />],
    ["BookingCardSkeleton", <BookingCardSkeleton key="b" />],
    ["ClassCardSkeleton", <ClassCardSkeleton key="k" />],
    ["StatsCardSkeleton", <StatsCardSkeleton key="s" />],
    ["RosterSkeleton", <RosterSkeleton key="r" />],
    ["FormSkeleton", <FormSkeleton key="f" />],
  ];

  test.each(cases)("%s renders a non-empty block of placeholders", (_name, node) => {
    const { container } = render(node);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  test("TableSkeleton renders the requested number of placeholder rows", () => {
    const { container } = render(<TableSkeleton rows={3} />);
    // div-based rows (not a real <table>) + one header placeholder
    expect(container.querySelectorAll(".divide-y > div")).toHaveLength(3);

    const { container: defaulted } = render(<TableSkeleton />);
    expect(defaulted.querySelectorAll(".divide-y > div")).toHaveLength(5);
  });

  test("RosterSkeleton renders a table with 4 placeholder rows", () => {
    const { container } = render(<RosterSkeleton />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
  });
});
