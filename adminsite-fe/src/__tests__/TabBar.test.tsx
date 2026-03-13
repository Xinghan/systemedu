import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabBar from "@/components/TabBar";

describe("TabBar", () => {
  const tabs = ["Info", "Knowledge Tree"];

  test("renders all tabs", () => {
    render(<TabBar tabs={tabs} active="Info" onChange={() => {}} />);
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Tree")).toBeInTheDocument();
  });

  test("highlights active tab", () => {
    render(<TabBar tabs={tabs} active="Info" onChange={() => {}} />);
    expect(screen.getByText("Info").className).toContain("text-accent");
    expect(screen.getByText("Knowledge Tree").className).not.toContain("text-accent");
  });

  test("calls onChange with tab name on click", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<TabBar tabs={tabs} active="Info" onChange={onChange} />);
    await user.click(screen.getByText("Knowledge Tree"));
    expect(onChange).toHaveBeenCalledWith("Knowledge Tree");
  });
});
