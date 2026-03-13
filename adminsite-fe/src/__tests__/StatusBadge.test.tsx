import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/StatusBadge";

describe("StatusBadge", () => {
  test("shows Draft when not published", () => {
    render(<StatusBadge published={false} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  test("shows Published when published", () => {
    render(<StatusBadge published={true} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  test("shows Template when template is true", () => {
    render(<StatusBadge published={false} template={true} />);
    expect(screen.getByText("Template")).toBeInTheDocument();
  });

  test("Template takes priority over Published", () => {
    render(<StatusBadge published={true} template={true} />);
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
  });
});
