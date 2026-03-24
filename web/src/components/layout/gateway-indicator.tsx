"use client"

import { useAppStore } from "@/lib/stores/app-store"
import { useT } from "@/lib/hooks/use-t"

export function GatewayIndicator() {
  const connected = useAppStore((s) => s.gatewayConnected)
  const t = useT()

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
      {connected ? t("gateway.connected") : t("gateway.disconnected")}
    </div>
  )
}
