import type {
  Project,
  ProjectDetail,
  User,
  AuthTokens,
  LoginInput,
  RegisterInput,
} from "./types";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020";

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
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Try refresh if 401
  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      clearTokens();
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
    const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
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

// Server-side fetch (no auth, no token refresh)
export async function fetchServer<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error ${res.status}`);
  }
  return res.json();
}

// ---- Public API functions ----

export async function getProjects(): Promise<Project[]> {
  return fetchAPI<Project[]>("/api/projects/");
}

export async function getProject(id: number): Promise<ProjectDetail> {
  return fetchAPI<ProjectDetail>(`/api/projects/${id}/`);
}

export async function login(input: LoginInput): Promise<AuthTokens> {
  const tokens = await fetchAPI<AuthTokens>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setTokens(tokens.access, tokens.refresh);
  return tokens;
}

export async function register(input: RegisterInput): Promise<User> {
  return fetchAPI<User>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getProfile(): Promise<User> {
  return fetchAPI<User>("/api/auth/profile/");
}

export { ApiError };
