"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useGatewayStatus } from "@/lib/hooks/use-gateway-status"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useGatewayStatus()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
