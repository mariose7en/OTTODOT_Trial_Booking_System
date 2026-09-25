/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { RosterTable } from "@/components/RosterTable";
import { RosterResponse } from "@/types/booking";

const mockRosterWithStudents: RosterResponse = {
  class_id: "SC-S-20261002T1400-4",
  class_name: "SCIENCE TRIAL",
  subject: "SCIENCE",
  start_time: "2026-10-02T14:00:00Z",
  confirmed_students: [
    {
      student_id: "CH-RES789-20260925",
      first_name: "CHARLIE",
      last_name: "LEE",
      email: "alice@example.com",
    },
    {
      student_id: "DA-RES321-20260925",
      first_name: "DAISY",
      last_name: "LEE",
      email: "alice@example.com",
    },
  ],
  seats_remaining: 2,
  max_seats: 4,
};

const mockRosterEmpty: RosterResponse = {
  class_id: "MT-M-20261001T1000-4",
  class_name: "MATH TRIAL",
  subject: "MATH",
  start_time: "2026-10-01T10:00:00Z",
  confirmed_students: [],
  seats_remaining: 4,
  max_seats: 4,
};

describe("RosterTable component", () => {
  it("should render class name", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("SCIENCE TRIAL")).toBeInTheDocument();
  });

  it("should render subject badge", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("SCIENCE")).toBeInTheDocument();
  });

  it("should render seats remaining", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("of 4 seats remaining")).toBeInTheDocument();
  });

  it("should render student names", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("CHARLIE LEE")).toBeInTheDocument();
    expect(screen.getByText("DAISY LEE")).toBeInTheDocument();
  });

  it("should render student IDs", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("CH-RES789-20260925")).toBeInTheDocument();
    expect(screen.getByText("DA-RES321-20260925")).toBeInTheDocument();
  });

  it("should render student emails", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    const emails = screen.getAllByText("alice@example.com");
    expect(emails.length).toBe(2);
  });

  it("should render row numbers", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("should show empty message when no students", () => {
    render(<RosterTable roster={mockRosterEmpty} />);
    expect(screen.getByText("No confirmed students yet.")).toBeInTheDocument();
  });

  it("should render table headers", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("Student Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("should render formatted date", () => {
    render(<RosterTable roster={mockRosterWithStudents} />);
    expect(screen.getByText(/October/)).toBeInTheDocument();
  });
});
