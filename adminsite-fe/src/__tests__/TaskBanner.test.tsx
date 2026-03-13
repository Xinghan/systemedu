import { render, screen, waitFor, act } from "@testing-library/react";
import TaskBanner from "@/components/TaskBanner";

jest.mock("@/lib/api", () => ({
  getActiveTasks: jest.fn(),
  getTaskStatus: jest.fn(),
}));

jest.mock("@/components/Toast", () => ({
  toast: jest.fn(),
}));

import { getActiveTasks, getTaskStatus } from "@/lib/api";
import { toast } from "@/components/Toast";

const mockGetActiveTasks = getActiveTasks as jest.MockedFunction<typeof getActiveTasks>;
const mockGetTaskStatus = getTaskStatus as jest.MockedFunction<typeof getTaskStatus>;
const mockToast = toast as jest.MockedFunction<typeof toast>;

const MOCK_ACTIVE_TASK = {
  task_id: "abc-123",
  status: "running" as const,
  project_id: 1,
  project_title: "Test Project",
  granularity: "medium",
  created_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:01Z",
};

describe("TaskBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders nothing when no active tasks", async () => {
    mockGetActiveTasks.mockResolvedValue([]);
    const { container } = render(
      <TaskBanner projectId={1} onTaskComplete={jest.fn()} />
    );
    await waitFor(() => {
      expect(mockGetActiveTasks).toHaveBeenCalledWith(1);
    });
    expect(container.innerHTML).toBe("");
  });

  test("renders banner for active task", async () => {
    mockGetActiveTasks.mockResolvedValue([MOCK_ACTIVE_TASK]);
    render(<TaskBanner projectId={1} onTaskComplete={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/AI is generating knowledge tree/)).toBeInTheDocument();
      expect(screen.getByText(/medium/)).toBeInTheDocument();
    });
  });

  test("shows Running badge for running task", async () => {
    mockGetActiveTasks.mockResolvedValue([MOCK_ACTIVE_TASK]);
    render(<TaskBanner projectId={1} onTaskComplete={jest.fn()} />);

    await waitFor(() => {
      const badge = screen.getByText("Running");
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain("bg-accent/20");
    });
  });

  test("shows Queued badge for pending task", async () => {
    mockGetActiveTasks.mockResolvedValue([
      { ...MOCK_ACTIVE_TASK, status: "pending" as const },
    ]);
    render(<TaskBanner projectId={1} onTaskComplete={jest.fn()} />);

    await waitFor(() => {
      const badge = screen.getByText("Queued");
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain("bg-yellow-500/20");
    });
  });

  test("calls onTaskComplete when task finishes", async () => {
    const onTaskComplete = jest.fn();

    // First call: task is active
    mockGetActiveTasks.mockResolvedValueOnce([MOCK_ACTIVE_TASK]);

    render(<TaskBanner projectId={1} onTaskComplete={onTaskComplete} />);
    await waitFor(() => {
      expect(screen.getByText(/AI is generating/)).toBeInTheDocument();
    });

    // Second call: task is gone (completed)
    mockGetActiveTasks.mockResolvedValueOnce([]);
    mockGetTaskStatus.mockResolvedValueOnce({
      task_id: "abc-123",
      status: "completed",
      created_at: "2026-01-01T00:00:00Z",
      started_at: "2026-01-01T00:00:01Z",
      completed_at: "2026-01-01T00:00:30Z",
      tree_data: { milestones: [] },
      milestones_created: 3,
      knodes_created: 10,
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(onTaskComplete).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        "Knowledge tree generated: 3 milestones, 10 nodes"
      );
    });
  });
});
