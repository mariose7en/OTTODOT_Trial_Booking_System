/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/Card";

describe("Card component", () => {
  it("should render title", () => {
    render(<Card title="Test Title">Content</Card>);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("should render children", () => {
    render(<Card title="Title">Card content here</Card>);
    expect(screen.getByText("Card content here")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    render(
      <Card title="Title" className="custom-class">
        Content
      </Card>
    );
    const card = screen.getByText("Title").closest("div");
    expect(card).toHaveClass("custom-class");
  });
});
