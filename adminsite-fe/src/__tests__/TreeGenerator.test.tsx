import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TreeGenerator from "@/components/TreeGenerator";

jest.mock("@/lib/api", () => ({
  generateTree: jest.fn(),
  pollTaskUntilDone: jest.fn(),
}));

jest.mock("@/components/Toast", () => ({
  toast: jest.fn(),
}));

import { generateTree, pollTaskUntilDone } from "@/lib/api";
import { toast } from "@/components/Toast";

const mockGenerateTree = generateTree as jest.MockedFunction<typeof generateTree>;
const mockPollTask = pollTaskUntilDone as jest.MockedFunction<typeof pollTaskUntilDone>;
const mockToast = toast as jest.MockedFunction<typeof toast>;

const MOCK_TREE_DATA = {
  milestones: [
    {
      title: "Intro",
      order: 0,
      knodes: [
        {
          title: "Node 1",
          difficulty_level: 1,
          content_type: "text",
          acceptance_type: "quiz",
          estimated_minutes: 15,
          xp_reward: 20,
          order: 0,
          prerequisite_indices: [],
        },
      ],
    },
  ],
};

const MOCK_KICKOFF = { task_id: "abc-123", status: "pending" };
const MOCK_COMPLETED = {
  task_id: "abc-123",
  status: "completed" as const,
  created_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:01Z",
  completed_at: "2026-01-01T00:00:30Z",
  tree_data: MOCK_TREE_DATA,
  milestones_created: 1,
  knodes_created: 1,
};
const MOCK_FAILED = {
  task_id: "abc-123",
  status: "failed" as const,
  created_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:01Z",
  completed_at: "2026-01-01T00:00:10Z",
  error: "AI generation failed",
};

describe("TreeGenerator", () => {
  const defaultProps = {
    projectId: 1,
    hasExistingTree: false,
    onImported: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders heading and granularity options", () => {
    render(<TreeGenerator {...defaultProps} />);
    expect(screen.getByText("AI Generate Knowledge Tree")).toBeInTheDocument();
    expect(screen.getByText("Coarse")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Fine")).toBeInTheDocument();
    expect(screen.getByText("Generate with AI")).toBeInTheDocument();
  });

  test("generates tree and auto-saves, calls onImported", async () => {
    const user = userEvent.setup();
    const onImported = jest.fn();
    mockGenerateTree.mockResolvedValueOnce(MOCK_KICKOFF);
    mockPollTask.mockResolvedValueOnce(MOCK_COMPLETED);

    render(<TreeGenerator {...defaultProps} onImported={onImported} />);
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockGenerateTree).toHaveBeenCalledWith(1, {
        granularity: "medium",
        instructions: "",
      });
    });

    await waitFor(() => {
      expect(mockPollTask).toHaveBeenCalledWith("abc-123");
    });

    // Shows success summary
    await waitFor(() => {
      expect(screen.getByText("Generated and saved 1 milestones, 1 nodes")).toBeInTheDocument();
    });

    // Calls onImported automatically (no manual import step)
    expect(onImported).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("Generated and saved 1 milestones, 1 nodes");
  });

  test("shows collapsible JSON preview after generation", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce(MOCK_KICKOFF);
    mockPollTask.mockResolvedValueOnce(MOCK_COMPLETED);

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(screen.getByText("Show generated JSON")).toBeInTheDocument();
    });
    expect(screen.getByText("Download JSON")).toBeInTheDocument();
  });

  test("generates tree with coarse granularity", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce(MOCK_KICKOFF);
    mockPollTask.mockResolvedValueOnce(MOCK_COMPLETED);

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Coarse"));
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockGenerateTree).toHaveBeenCalledWith(1, {
        granularity: "coarse",
        instructions: "",
      });
    });
  });

  test("generates tree with fine granularity", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce(MOCK_KICKOFF);
    mockPollTask.mockResolvedValueOnce(MOCK_COMPLETED);

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Fine"));
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockGenerateTree).toHaveBeenCalledWith(1, {
        granularity: "fine",
        instructions: "",
      });
    });
  });

  test("shows error on generation failure from polling", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce(MOCK_KICKOFF);
    mockPollTask.mockResolvedValueOnce(MOCK_FAILED);

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("AI generation failed", "error");
    });
  });

  test("shows error on kickoff failure", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockRejectedValueOnce(new Error("Network error"));

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Network error", "error");
    });
  });

  test("custom instructions are passed to API", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce(MOCK_KICKOFF);
    mockPollTask.mockResolvedValueOnce(MOCK_COMPLETED);

    render(<TreeGenerator {...defaultProps} />);

    const instructionsInput = screen.getByPlaceholderText(/zero CS background/);
    await user.type(instructionsInput, "Include coding exercises");

    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockGenerateTree).toHaveBeenCalledWith(1, {
        granularity: "medium",
        instructions: "Include coding exercises",
      });
    });
  });
});
