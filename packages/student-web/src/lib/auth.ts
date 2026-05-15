/** JWT token storage (与老 web 兼容: 同 key 名)。 */

const TOKEN_KEY = "systemedu_token"
const USERNAME_KEY = "sysedu-username"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(USERNAME_KEY)
}

export function setUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username)
}

export function clearUsername(): void {
  localStorage.removeItem(USERNAME_KEY)
}

export function isLoggedIn(): boolean {
  return getToken() !== null
}
