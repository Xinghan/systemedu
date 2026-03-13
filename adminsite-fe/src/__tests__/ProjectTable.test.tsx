import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectTable from "@/components/ProjectTable";
import type { AdminProject } from "@/lib/types";

// Mock next/link
jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const mockProject: AdminProject = {
  id: 1,
  title: "Neural Network Project",
  subtitle: "Build from scratch",
  description: "Learn ML",
  cover_image: "",
  category: "ai",
  min_age: 10,
  max_age: 16,
  estimated_hours: 20,
  is_published: true,
  is_template: false,
  milestone_count: 3,
  created_at: "2026-01-01T00:00:00Z",
};

describe("ProjectTable", () => {
  test("shows empty state when no projects", () => {
    render(<ProjectTable projects={[]} onClone={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    expect(screen.getByText("Create your first project")).toBeInTheDocument();
  });

  test("renders project row", () => {
    render(<ProjectTable projects={[mockProject]} onClone={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Neural Network Project")).toBeInTheDocument();
    expect(screen.getByText("AI & Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("10-16")).toBeInTheDocument();
    expect(screen.getByText("20h")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  test("calls onDelete when delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(<ProjectTable projects={[mockProject]} onClone={() => {}} onDelete={onDelete} />);
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(mockProject);
  });

  test("calls onClone when clone is clicked", async () => {
    const user = userEvent.setup();
    const onClone = jest.fn();
    render(<ProjectTable projects={[mockProject]} onClone={onClone} onDelete={() => {}} />);
    await user.click(screen.getByText("Clone"));
    expect(onClone).toHaveBeenCalledWith(mockProject);
  });

  test("renders edit link to project detail", () => {
    render(<ProjectTable projects={[mockProject]} onClone={() => {}} onDelete={() => {}} />);
    const editLink = screen.getByText("Edit");
    expect(editLink.closest("a")).toHaveAttribute("href", "/projects/1");
  });
});
