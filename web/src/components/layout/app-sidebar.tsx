"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Box,
  Brain,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
  History,
  Plus,
  HelpCircle,
  LogOut,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { GatewayIndicator } from "./gateway-indicator"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Library", icon: FolderKanban },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/objects", label: "Objects", icon: Box },
]

const manageItems = [
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/mcp", label: "MCP", icon: Plug },
  { href: "/config", label: "Settings", icon: Settings },
  { href: "/sessions", label: "History", icon: History },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r-0 shadow-[1px_0_0_0_var(--sidebar-border)]">
      {/* Logo */}
      <SidebarHeader className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.35)] transition-all duration-350 group-hover:shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.45)]">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-foreground">SystemEdu</span>
            <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground leading-none mt-0.5">
              AI Learning Hub
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={`
                        relative h-10 rounded-lg px-3 text-sm font-medium
                        transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]
                        ${active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                        }
                      `}
                      render={<Link href={item.href} />}
                    >
                      {/* 4px left accent bar */}
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separator label */}
        <div className="px-3 pt-4 pb-1">
          <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground/60">
            Manage
          </span>
        </div>

        {/* Manage nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {manageItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={`
                        relative h-10 rounded-lg px-3 text-sm font-medium
                        transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]
                        ${active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                        }
                      `}
                      render={<Link href={item.href} />}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: New Project CTA + status */}
      <SidebarFooter className="px-4 py-4 space-y-3">
        <Link href="/projects/new" className="block">
          <button className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_2px_16px_0_oklch(0.488_0.258_302_/_0.30)] transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] hover:shadow-[0_4px_24px_0_oklch(0.488_0.258_302_/_0.40)]">
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </Link>

        <div className="flex items-center justify-between px-1">
          <GatewayIndicator />
          <div className="flex items-center gap-2 text-muted-foreground">
            <button className="h-7 w-7 rounded-lg hover:bg-sidebar-accent flex items-center justify-center transition-colors">
              <HelpCircle className="h-4 w-4" />
            </button>
            <Link href="/login">
              <button className="h-7 w-7 rounded-lg hover:bg-sidebar-accent flex items-center justify-center transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
