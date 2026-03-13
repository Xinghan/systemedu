import { render, screen } from "@testing-library/react";
import StatsCard from "@/components/StatsCard";

describe("StatsCard", () => {
  test("renders label and value", () => {
    render(
      <StatsCard label="Total Projects" value={42} icon={<span>icon</span>} />
    );
    expect(screen.getByText("Total Projects")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("renders string value", () => {
    render(
      <StatsCard label="Status" value="..." icon={<span>i</span>} />
    );
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  test("renders icon", () => {
    render(
      <StatsCard label="L" value={0} icon={<span data-testid="icon">X</span>} />
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});
