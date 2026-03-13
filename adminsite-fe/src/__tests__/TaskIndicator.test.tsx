import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskIndicator from "@/components/TaskIndicator";

jest.mock("@/lib/api", () => ({
  getActiveTasks: jest.fn(),
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; onClick?: () => void }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

import { getActiveTasks } from "@/lib/api";

const mockGetActiveTasks = getActiveTasks as jest.MockedFunction<typeof getActiveTasks>;

const MOCK_TASKS = [
  {
    task_id: "abc-123",
    status: "running" as const,
    project_id: 1,
    project_title: "ML Project",
    granularity: "medium",
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:01Z",
  },
  {
    task_id: "def-456",
    status: "pending" as const,
    project_id: 2,
    project_title: "Rocket Project",
    granularity: "fine",
    created_at: "2026-01-01T00:00:05Z",
    started_at: null,
  },
];

describe("TaskIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders nothing when no active tasks", async () => {
    mockGetActiveTasks.mockResolvedValue([]);
    const { container } = render(<TaskIndicator />);
    await waitFor(() => {
      expect(mockGetActiveTasks).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe("");
  });

  test("renders task count badge", async () => {
    mockGetActiveTasks.mockResolvedValue(MOCK_TASKS);
    render(<TaskIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Tasks (2)")).toBeInTheDocument();
    });
  });

  test("opens dropdown on click showing task details", async () => {
    const user = userEvent.setup();
    mockGetActiveTasks.mockResolvedValue(MOCK_TASKS);
    render(<TaskIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Tasks (2)")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Tasks (2)"));
    expect(screen.getByText("ML Project")).toBeInTheDocument();
    expect(screen.getByText("Rocket Project")).toBeInTheDocument();
  });

  test("links point to project pages", async () => {
    const user = userEvent.setup();
    mockGetActiveTasks.mockResolvedValue([MOCK_TASKS[0]]);
    render(<TaskIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Tasks (1)")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Tasks (1)"));
    const link = screen.getByText("ML Project").closest("a");
    expect(link).toHaveAttribute("href", "/projects/1");
  });
});
