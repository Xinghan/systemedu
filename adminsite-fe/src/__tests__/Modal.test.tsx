import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "@/components/Modal";

describe("Modal", () => {
  test("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  test("renders title and children when open", () => {
    render(
      <Modal open={true} onClose={() => {}} title="Confirm">
        <p>Are you sure?</p>
      </Modal>
    );
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  test("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>
    );
    // Click the backdrop (first child of the fixed overlay)
    const backdrop = document.querySelector(".absolute.inset-0.bg-black\\/60");
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
