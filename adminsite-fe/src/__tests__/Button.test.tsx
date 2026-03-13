import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "@/components/Button";

describe("Button", () => {
  test("renders with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  test("calls onClick handler", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("is disabled when loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  test("is disabled when disabled prop is true", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  test("shows spinner when loading", () => {
    render(<Button loading>Save</Button>);
    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  test("applies variant styles", () => {
    const { rerender } = render(<Button variant="primary">Btn</Button>);
    expect(screen.getByRole("button").className).toContain("bg-accent");

    rerender(<Button variant="danger">Btn</Button>);
    expect(screen.getByRole("button").className).toContain("bg-danger");

    rerender(<Button variant="secondary">Btn</Button>);
    expect(screen.getByRole("button").className).toContain("bg-bg-elevated");

    rerender(<Button variant="ghost">Btn</Button>);
    expect(screen.getByRole("button").className).toContain("text-text-secondary");
  });
});
