/** Auth zustand store — 跟 localStorage 同步, 用于 client component reactive. */

import { create } from "zustand"
import { getToken, clearToken, getUsername, setUsername, clearUsername } from "@/lib/auth"

interface AuthState {
  token: string | null
  username: string | null
  loggedIn: boolean
  hydrate: () => void
  setAuth: (token: string, displayName?: string | null) => void
  setDisplayName: (displayName: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  username: null,
  loggedIn: false,
  hydrate: () => {
    if (typeof window === "undefined") return
    const token = getToken()
    const username = getUsername()
    set({ token, username, loggedIn: !!token })
  },
  setAuth: (token, displayName = null) => {
    if (displayName) setUsername(displayName)
    set({ token, username: displayName, loggedIn: true })
  },
  setDisplayName: (displayName) => {
    if (displayName) setUsername(displayName)
    else clearUsername()
    set({ username: displayName })
  },
  logout: () => {
    clearToken()
    clearUsername()
    set({ token: null, username: null, loggedIn: false })
  },
}))
