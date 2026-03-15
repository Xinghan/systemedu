"use client"

import { create } from "zustand"
import type { ConfigResponse, StatusResponse } from "@/lib/types/api"

interface AppState {
  status: StatusResponse | null
  config: ConfigResponse | null
  sidebarOpen: boolean
  gatewayConnected: boolean
  setSidebarOpen: (open: boolean) => void
  setStatus: (status: StatusResponse | null) => void
  setConfig: (config: ConfigResponse | null) => void
  setGatewayConnected: (connected: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  status: null,
  config: null,
  sidebarOpen: true,
  gatewayConnected: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setStatus: (status) => set({ status }),
  setConfig: (config) => set({ config }),
  setGatewayConnected: (connected) => set({ gatewayConnected: connected }),
}))
