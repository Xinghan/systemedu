"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ConfigResponse, StatusResponse } from "@/lib/types/api"
import type { Locale } from "@/lib/i18n"

interface AppState {
  status: StatusResponse | null
  config: ConfigResponse | null
  sidebarOpen: boolean
  gatewayConnected: boolean
  locale: Locale
  setSidebarOpen: (open: boolean) => void
  setStatus: (status: StatusResponse | null) => void
  setConfig: (config: ConfigResponse | null) => void
  setGatewayConnected: (connected: boolean) => void
  setLocale: (locale: Locale) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      status: null,
      config: null,
      sidebarOpen: true,
      gatewayConnected: false,
      locale: "en",
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setStatus: (status) => set({ status }),
      setConfig: (config) => set({ config }),
      setGatewayConnected: (connected) => set({ gatewayConnected: connected }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "systemedu-app",
      partialState: (state) => ({ locale: state.locale }),
    } as Parameters<typeof persist>[1]
  )
)
