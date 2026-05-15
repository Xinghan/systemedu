/** Auth zustand store — 跟 localStorage 同步, 用于 client component reactive. */

import { create } from "zustand"
import { getToken, clearToken, getUsername, clearUsername } from "@/lib/auth"

interface AuthState {
  token: string | null
  username: string | null
  loggedIn: boolean
  hydrate: () => void
  setAuth: (token: string, username: string) => void
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
  setAuth: (token, username) => {
    set({ token, username, loggedIn: true })
  },
  logout: () => {
    clearToken()
    clearUsername()
    set({ token: null, username: null, loggedIn: false })
  },
}))
