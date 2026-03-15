"use client"

import { useAppStore } from "@/lib/stores/app-store"

export function GatewayIndicator() {
  const connected = useAppStore((s) => s.gatewayConnected)

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {connected ? "Gateway 已连接" : "Gateway 未连接"}
    </div>
  )
}
