/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import {
  RecentActivity,
  type Activity,
} from "@/components/RecentActivity";

const activities: Activity[] = [
  {
    id: "a1",
    type: "booking",
    message: "CHARLIE LEE booked MATH TRIAL",
    timestamp: "2026-10-01T02:00:00.000Z",
  },
  {
    id: "a2",
    type: "payment",
    message: "Payment received for BOOKING001",
    timestamp: "2026-10-01T03:00:00.000Z",
  },
  {
    id: "a3",
    type: "cancellation",
    message: "Booking cancelled",
    timestamp: "2026-10-01T04:00:00.000Z",
  },
];

describe("RecentActivity", () => {
  test("shows the empty state when there is nothing to show", () => {
    render(<RecentActivity activities={[]} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
    expect(document.querySelectorAll("li")).toHaveLength(0);
  });

  test("renders one row per activity with its message", () => {
    render(<RecentActivity activities={activities} />);
    expect(document.querySelectorAll("li")).toHaveLength(3);
    expect(
      screen.getByText("CHARLIE LEE booked MATH TRIAL")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Payment received for BOOKING001")
    ).toBeInTheDocument();
    expect(screen.getByText("Booking cancelled")).toBeInTheDocument();
  });

  test("picks an icon per activity type", () => {
    const { container } = render(<RecentActivity activities={activities} />);
    const icons = Array.from(
      container.querySelectorAll("li span.text-xl")
    ).map((s) => s.textContent);
    expect(icons).toEqual(["📋", "💰", "❌"]);
  });

  test("renders a local timestamp for each activity", () => {
    render(<RecentActivity activities={[activities[0]]} />);
    expect(
      screen.getByText(new Date(activities[0].timestamp).toLocaleString())
    ).toBeInTheDocument();
  });
});
