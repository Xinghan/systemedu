/** student-app API client. */

import { clearToken, getToken } from "@/lib/auth"

export class ApiError extends Error {
  code?: string
  status?: number
  constructor(message: string, opts: { code?: string; status?: number } = {}) {
    super(message)
    this.code = opts.code
    this.status = opts.status
  }
}

const STUDENT_API_URL =
  process.env.NEXT_PUBLIC_STUDENT_API_URL || "http://localhost:18820"

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
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
      window.location.replace("/login")
    }
    throw new ApiError("Unauthorized", { status: 401 })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error || body.message || `API error ${res.status}`, {
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
