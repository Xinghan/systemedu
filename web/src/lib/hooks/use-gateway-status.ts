"use client"

import { useCallback, useEffect } from "react"
import { gateway } from "@/lib/api"
import { useAppStore } from "@/lib/stores/app-store"

export function useGatewayStatus(pollInterval = 10000) {
  const { setStatus, setConfig, setGatewayConnected } = useAppStore()

  const refresh = useCallback(async () => {
    try {
      const [status, config] = await Promise.all([
        gateway.status(),
        gateway.config(),
      ])
      setStatus(status)
      setConfig(config)
      setGatewayConnected(true)
    } catch {
      setGatewayConnected(false)
      setStatus(null)
      setConfig(null)
    }
  }, [setStatus, setConfig, setGatewayConnected])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, pollInterval)
    return () => clearInterval(id)
  }, [refresh, pollInterval])

  return { refresh }
}
