"use client"

import { useGatewayStatus } from "@/lib/hooks/use-gateway-status"
import { useAuth } from "@/lib/hooks/use-auth"

export default function LearningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useAuth()
  useGatewayStatus()

  return <div className="flex h-screen">{children}</div>
}
