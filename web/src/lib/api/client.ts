/** Gateway API client. */

import { clearToken, getToken } from "@/lib/auth"

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18820"

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers,
  })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined") {
      window.location.replace("/login")
    }
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => fetchAPI<T>(path),
  post: <T>(path: string, body: unknown) =>
    fetchAPI<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    fetchAPI<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    fetchAPI<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => fetchAPI<T>(path, { method: "DELETE" }),
}

export { GATEWAY_URL }
