/** student-app API client. */

import { clearToken, getToken } from "@/lib/auth"
import { MOLECULE_NUMBERING_VERSION } from "@/lib/course-numbering"
import { STUDENT_API_URL } from "./origin"

export class ApiError extends Error {
  code?: string
  status?: number
  constructor(message: string, opts: { code?: string; status?: number } = {}) {
    super(message)
    this.code = opts.code
    this.status = opts.status
  }
}

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
    "X-Course-Numbering": MOLECULE_NUMBERING_VERSION,
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(`${STUDENT_API_URL}${path}`, {
    ...init,
    headers,
  })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      const resumeMission = ["space", "biomedicine", "energy", "robotics", "earth", "computing", "brain"].includes(new URLSearchParams(window.location.search).get("mission") || "")
      const next = window.location.pathname + window.location.search + window.location.hash
      window.location.replace(resumeMission ? `/login?next=${encodeURIComponent(next)}` : "/login")
    }
    throw new ApiError("Unauthorized", { status: 401 })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.message || body.error || `API error ${res.status}`, {
      code: body.error,
      status: res.status,
    })
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => fetchAPI<T>(path),
  post: <T>(path: string, body: unknown = {}) =>
    fetchAPI<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown = {}) =>
    fetchAPI<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown = {}) =>
    fetchAPI<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => fetchAPI<T>(path, { method: "DELETE" }),
}

export { STUDENT_API_URL }
