import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TreeGenerator from "@/components/TreeGenerator";

jest.mock("@/lib/api", () => ({
  generateTree: jest.fn(),
  importTree: jest.fn(),
}));

jest.mock("@/components/Toast", () => ({
  toast: jest.fn(),
}));

import { generateTree, importTree } from "@/lib/api";
import { toast } from "@/components/Toast";

const mockGenerateTree = generateTree as jest.MockedFunction<typeof generateTree>;
const mockImportTree = importTree as jest.MockedFunction<typeof importTree>;
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

  test("generates tree with default medium granularity", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockGenerateTree).toHaveBeenCalledWith(1, {
        granularity: "medium",
        instructions: "",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Generated JSON Preview")).toBeInTheDocument();
    });
    expect(mockToast).toHaveBeenCalledWith("Knowledge tree generated successfully");
  });

  test("generates tree with coarse granularity", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });

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
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });

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

  test("shows error on generation failure", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockRejectedValueOnce(new Error("AI generation failed"));

    render(<TreeGenerator {...defaultProps} />);
    await user.click(screen.getByText("Generate with AI"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("AI generation failed", "error");
    });
  });

  test("imports generated tree", async () => {
    const user = userEvent.setup();
    const onImported = jest.fn();
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });
    mockImportTree.mockResolvedValueOnce({
      project_id: 1,
      milestones_created: 1,
      knodes_created: 1,
    });

    render(<TreeGenerator {...defaultProps} onImported={onImported} />);

    await user.click(screen.getByText("Generate with AI"));
    await waitFor(() => {
      expect(screen.getByText("Generated JSON Preview")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Import Generated Tree"));
    await waitFor(() => {
      expect(mockImportTree).toHaveBeenCalledWith(1, MOCK_TREE_DATA, false);
      expect(onImported).toHaveBeenCalled();
    });
  });

  test("discard clears generated JSON", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });

    render(<TreeGenerator {...defaultProps} />);

    await user.click(screen.getByText("Generate with AI"));
    await waitFor(() => {
      expect(screen.getByText("Generated JSON Preview")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Discard"));
    expect(screen.queryByText("Generated JSON Preview")).not.toBeInTheDocument();
  });

  test("custom instructions are passed to API", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });

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

  test("passes replace=true when hasExistingTree", async () => {
    const user = userEvent.setup();
    mockGenerateTree.mockResolvedValueOnce({ tree_data: MOCK_TREE_DATA });
    mockImportTree.mockResolvedValueOnce({
      project_id: 1,
      milestones_created: 1,
      knodes_created: 1,
    });

    render(<TreeGenerator {...defaultProps} hasExistingTree={true} />);

    await user.click(screen.getByText("Generate with AI"));
    await waitFor(() => {
      expect(screen.getByText("Generated JSON Preview")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Import Generated Tree"));
    await waitFor(() => {
      expect(mockImportTree).toHaveBeenCalledWith(1, MOCK_TREE_DATA, true);
    });
  });
});
