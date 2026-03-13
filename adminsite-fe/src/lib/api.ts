import type {
  AdminProject,
  AdminProjectDetail,
  AuthTokens,
  LoginInput,
  ProjectFormData,
  TreeGraph,
  ImportResult,
  GenerateTreeInput,
  GenerateTreeResult,
} from "./types";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

class ApiError extends Error {
  status: number;
  data: Record<string, unknown> | null;

  constructor(status: number, message: string, data: Record<string, unknown> | null = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function fetchAPI<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type for non-FormData bodies
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Strip trailing slash — Next.js route handler adds it back for Django
  const cleanPath = path.replace(/\/+$/, "");

  let res = await fetch(`/api/admin${cleanPath}`, { ...options, headers });

  // Try refresh if 401
  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      res = await fetch(`/api/admin${cleanPath}`, { ...options, headers });
    } else {
      clearTokens();
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, `API error ${res.status}`, data);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch("/api/admin/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access, refresh);
    return true;
  } catch {
    return false;
  }
}

// ---- Auth ----

export async function login(input: LoginInput): Promise<AuthTokens> {
  const res = await fetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, data?.detail || "Login failed", data);
  }

  const tokens: AuthTokens = await res.json();
  setTokens(tokens.access, tokens.refresh);
  return tokens;
}

// ---- Projects ----

export async function getProjects(): Promise<AdminProject[]> {
  return fetchAPI<AdminProject[]>("/projects");
}

export async function getProject(id: number): Promise<AdminProjectDetail> {
  return fetchAPI<AdminProjectDetail>(`/projects/${id}`);
}

export async function createProject(data: ProjectFormData): Promise<AdminProjectDetail> {
  return fetchAPI<AdminProjectDetail>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: number, data: Partial<ProjectFormData>): Promise<AdminProjectDetail> {
  return fetchAPI<AdminProjectDetail>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: number): Promise<void> {
  return fetchAPI<void>(`/projects/${id}`, {
    method: "DELETE",
  });
}

// ---- Knowledge Tree ----

export async function importTree(
  projectId: number,
  treeData: unknown,
  replace: boolean = false,
): Promise<ImportResult> {
  return fetchAPI<ImportResult>(`/projects/${projectId}/import-tree`, {
    method: "POST",
    body: JSON.stringify({ tree_data: treeData, replace }),
  });
}

export async function importTreeFile(
  projectId: number,
  file: File,
  replace: boolean = false,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replace", String(replace));

  return fetchAPI<ImportResult>(`/projects/${projectId}/import-tree`, {
    method: "POST",
    body: formData,
  });
}

export async function exportTree(projectId: number): Promise<unknown> {
  return fetchAPI<unknown>(`/projects/${projectId}/export-tree`);
}

export async function getTreePreview(projectId: number): Promise<TreeGraph> {
  return fetchAPI<TreeGraph>(`/projects/${projectId}/tree-preview`);
}

// ---- AI Generate Tree ----

export async function generateTree(
  projectId: number,
  input: GenerateTreeInput,
): Promise<GenerateTreeResult> {
  return fetchAPI<GenerateTreeResult>(`/projects/${projectId}/generate-tree`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Clone ----

export async function cloneProject(projectId: number, newTitle?: string): Promise<AdminProjectDetail> {
  return fetchAPI<AdminProjectDetail>(`/projects/${projectId}/clone`, {
    method: "POST",
    body: JSON.stringify({ new_title: newTitle }),
  });
}

export { ApiError };
