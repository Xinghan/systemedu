"use client";

/**
 * library-admin-api — 浏览器侧调 library-app /admin/* API.
 *
 * 设计:
 * - Token 存 localStorage (key: library-admin-token)
 * - LIBRARY_BASE_URL 通过 NEXT_PUBLIC_LIBRARY_BASE_URL 环境变量配置; 默认 ""
 *   表示相对路径 (nginx 同源代理)
 * - 401/403 → 清 token + 跳 /login
 */

const TOKEN_KEY = "library-admin-token";
const USERNAME_KEY = "library-admin-username";

export function getBase(): string {
  // 通过环境变量配置, 默认相对 (生产 nginx 同源转发)
  return process.env.NEXT_PUBLIC_LIBRARY_BASE_URL ?? "";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, username?: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  if (username) window.localStorage.setItem(USERNAME_KEY, username);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USERNAME_KEY);
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USERNAME_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${getBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
    throw new ApiError("未登录或登录过期", res.status);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(detail || `HTTP ${res.status}`, res.status);
  }
  // 文件流不走 JSON
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

// ---------------------------------------------------------------------------
// 类型 (跟 library /admin 返回字段对齐, 不依赖外部 schema)
// ---------------------------------------------------------------------------

export interface ProjectSummary {
  slug: string;
  title: string;
  title_zh?: string | null;
  description?: string;
  version: string;
  status: "draft" | "published" | string;
  knode_count: number;
  stage_count: number;
  duration_weeks?: number | null;
  domain?: string | null;
  age_band?: string | null;
  difficulty?: number | null;
  tags: string[];
  languages: string[];
  total_size_bytes?: number | null;
  cover_image_path?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  manifest: Record<string, unknown> | null;
  knowledge_tree: Record<string, unknown> | null;
}

export interface KnodeEntry {
  module_id: string;
  title: string;
  week?: number | null;
  stage?: string | null;
  duration_minutes?: number | null;
  knode_dir: string;
}

export interface FileEntry {
  path: string;
  sha256: string;
  size: number;
}

export interface Stats {
  total_projects: number;
  published_projects: number;
  draft_projects: number;
  total_lessons: number;
}

// ---------------------------------------------------------------------------
// API 方法
// ---------------------------------------------------------------------------

export const api = {
  async login(username: string, password: string): Promise<{ token: string; username: string; role: string }> {
    const res = await fetch(`${getBase()}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(detail || "登录失败", res.status);
    }
    return await res.json();
  },

  async me(): Promise<{ id: string; username: string; role: string }> {
    return request("/admin/auth/me");
  },

  async listProjects(params?: {
    status?: string;
    search?: string;
  }): Promise<ProjectSummary[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const tail = qs.toString();
    return request(`/admin/projects${tail ? `?${tail}` : ""}`);
  },

  async getProject(slug: string): Promise<ProjectDetail> {
    return request(`/admin/projects/${encodeURIComponent(slug)}`);
  },

  async patchProject(
    slug: string,
    patch: Partial<Pick<ProjectSummary, "title" | "title_zh" | "description" | "tags">>,
  ): Promise<ProjectSummary> {
    return request(`/admin/projects/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async publishProject(slug: string): Promise<ProjectSummary> {
    return request(`/admin/projects/${encodeURIComponent(slug)}/publish`, {
      method: "POST",
    });
  },

  async unpublishProject(slug: string): Promise<ProjectSummary> {
    return request(`/admin/projects/${encodeURIComponent(slug)}/unpublish`, {
      method: "POST",
    });
  },

  async deleteProject(slug: string): Promise<{ deleted: boolean; slug: string }> {
    return request(`/admin/projects/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
  },

  async uploadTarball(file: File, overwrite = true): Promise<{
    imported: boolean;
    slug: string;
    title: string;
    version: string;
    knode_count: number;
  }> {
    const form = new FormData();
    form.append("file", file);
    return request(
      `/admin/projects/import?overwrite=${overwrite ? "true" : "false"}`,
      { method: "POST", body: form },
    );
  },

  async stats(): Promise<Stats> {
    return request("/admin/stats");
  },

  fileUrl(slug: string, path: string): string {
    return `${getBase()}/admin/projects/${encodeURIComponent(slug)}/files/${path}`;
  },

  async fetchFileText(slug: string, path: string): Promise<string> {
    const url = api.fileUrl(slug, path);
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new ApiError(`fetch file failed: HTTP ${res.status}`, res.status);
    }
    return await res.text();
  },
};
