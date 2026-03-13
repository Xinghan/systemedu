import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormInput from "@/components/FormInput";

describe("FormInput", () => {
  test("renders label and input", () => {
    render(<FormInput label="Username" />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  test("shows error message", () => {
    render(<FormInput label="Email" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  test("applies error styling", () => {
    render(<FormInput label="Email" error="Required" />);
    expect(screen.getByLabelText("Email").className).toContain("border-danger");
  });

  test("accepts user input", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FormInput label="Name" onChange={onChange} />);
    await user.type(screen.getByLabelText("Name"), "hello");
    expect(onChange).toHaveBeenCalled();
  });

  test("passes placeholder", () => {
    render(<FormInput label="Name" placeholder="Enter name" />);
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });
});
