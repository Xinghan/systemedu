"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Brain,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
  History,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { GatewayIndicator } from "./gateway-indicator"

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/chat", label: "聊天", icon: MessageSquare },
  { href: "/projects", label: "项目", icon: FolderKanban },
]

const manageItems = [
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/mcp", label: "MCP 服务", icon: Plug },
  { href: "/config", label: "配置", icon: Settings },
  { href: "/sessions", label: "会话历史", icon: History },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">SystemEdu</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-5">
            菜单
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={
                        active
                          ? "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "text-muted-foreground hover:text-foreground"
                      }
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-5">
            管理
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={
                        active
                          ? "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "text-muted-foreground hover:text-foreground"
                      }
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 flex flex-row items-center justify-between border-t">
        <GatewayIndicator />
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
