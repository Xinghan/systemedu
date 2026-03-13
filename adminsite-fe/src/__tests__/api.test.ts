import { login, getProjects, getProject, createProject, updateProject, deleteProject, exportTree, getTreePreview, cloneProject, importTree, ApiError } from "@/lib/api";
import * as auth from "@/lib/auth";

// Mock auth module
jest.mock("@/lib/auth", () => ({
  getAccessToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  (auth.getAccessToken as jest.Mock).mockReturnValue(null);
  (auth.getRefreshToken as jest.Mock).mockReturnValue(null);
});

describe("login", () => {
  test("sends credentials and stores tokens on success", async () => {
    const tokens = { access: "acc", refresh: "ref" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tokens,
    });

    const result = await login({ username: "demo", password: "demo1234" });

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo", password: "demo1234" }),
    });
    expect(auth.setTokens).toHaveBeenCalledWith("acc", "ref");
    expect(result).toEqual(tokens);
  });

  test("throws ApiError on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Invalid credentials" }),
    });

    await expect(login({ username: "bad", password: "bad" })).rejects.toThrow(ApiError);
  });

  test("throws ApiError with detail message from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: "Admin access required." }),
    });

    try {
      await login({ username: "user", password: "pass" });
      fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe("Admin access required.");
    }
  });
});

describe("getProjects", () => {
  test("fetches project list with auth header", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("mytoken");
    const projects = [{ id: 1, title: "Test" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => projects,
    });

    const result = await getProjects();

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer mytoken",
        "Content-Type": "application/json",
      }),
    }));
    expect(result).toEqual(projects);
  });
});

describe("getProject", () => {
  test("fetches single project", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    const project = { id: 1, title: "Test", milestones: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => project,
    });

    const result = await getProject(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1", expect.anything());
    expect(result).toEqual(project);
  });
});

describe("createProject", () => {
  test("POSTs project data", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    const formData = {
      title: "New", subtitle: "", description: "Desc",
      cover_image: "", category: "ai", min_age: 6, max_age: 18,
      estimated_hours: 10, is_published: false, is_template: false,
    };
    const created = { id: 1, ...formData };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => created,
    });

    const result = await createProject(formData);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(formData),
    }));
    expect(result).toEqual(created);
  });
});

describe("updateProject", () => {
  test("PATCHes project data", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, title: "Updated" }),
    });

    await updateProject(1, { title: "Updated" });
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1", expect.objectContaining({
      method: "PATCH",
    }));
  });
});

describe("deleteProject", () => {
  test("DELETEs project", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    await deleteProject(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1", expect.objectContaining({
      method: "DELETE",
    }));
  });
});

describe("importTree", () => {
  test("POSTs tree JSON data", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    const treeData = { milestones: [{ title: "M1", order: 0, knodes: [{ title: "K1" }] }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ project_id: 1, milestones_created: 1, knodes_created: 1 }),
    });

    const result = await importTree(1, treeData, false);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1/import-tree", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ tree_data: treeData, replace: false }),
    }));
    expect(result.milestones_created).toBe(1);
  });
});

describe("exportTree", () => {
  test("GETs tree data", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    const tree = { milestones: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => tree,
    });

    const result = await exportTree(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1/export-tree", expect.anything());
    expect(result).toEqual(tree);
  });
});

describe("getTreePreview", () => {
  test("GETs tree graph", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    const graph = { nodes: [], edges: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => graph,
    });

    const result = await getTreePreview(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1/tree-preview", expect.anything());
    expect(result).toEqual(graph);
  });
});

describe("cloneProject", () => {
  test("POSTs clone with optional title", async () => {
    (auth.getAccessToken as jest.Mock).mockReturnValue("tok");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 2, title: "Copy" }),
    });

    const result = await cloneProject(1, "Copy");
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/projects/1/clone", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ new_title: "Copy" }),
    }));
    expect(result.id).toBe(2);
  });
});

describe("token refresh on 401", () => {
  test("retries with new token after refresh", async () => {
    (auth.getAccessToken as jest.Mock)
      .mockReturnValueOnce("expired")
      .mockReturnValueOnce("newtoken");
    (auth.getRefreshToken as jest.Mock).mockReturnValue("refresh");

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    // Refresh call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: "newtoken" }),
    });
    // Retry call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 1 }],
    });

    const result = await getProjects();
    expect(auth.setTokens).toHaveBeenCalledWith("newtoken", "refresh");
    expect(result).toEqual([{ id: 1 }]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
