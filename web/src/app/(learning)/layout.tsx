"use client"

import { useGatewayStatus } from "@/lib/hooks/use-gateway-status"

export default function LearningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useGatewayStatus()

  return <div className="flex h-screen">{children}</div>
}
