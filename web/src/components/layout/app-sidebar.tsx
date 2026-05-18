"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Brain,
  FolderKanban,
  LayoutDashboard,
  Sparkles,
  History,
  LogOut,
  Languages,
  HelpCircle,
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
import { useAppStore } from "@/lib/stores/app-store"
import { useT } from "@/lib/hooks/use-t"
import { auth } from "@/lib/api"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { locale, setLocale } = useAppStore()
  const t = useT()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    setUsername(auth.getCachedUsername())
  }, [pathname])

  async function handleLogout() {
    await auth.logout()
    setUsername(null)
    router.replace("/login")
  }

  const navItems = [
    { href: "/dashboard", label: "首页", icon: LayoutDashboard },
    { href: "/library", label: "项目库", icon: FolderKanban },
    { href: "/sessions", label: "对话", icon: History },
    { href: "/memory", label: "记忆", icon: Sparkles },
  ]

  return (
    <Sidebar className="border-r-0 shadow-[1px_0_0_0_var(--sidebar-border)]">
      <SidebarHeader className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.35)] transition-all duration-350 group-hover:shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.45)]">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-foreground">SystemEdu</span>
            <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground leading-none mt-0.5">
              AI 学习
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))
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

      <SidebarFooter className="px-4 py-4 space-y-3">
        {/* 当前用户 */}
        {username && (
          <div className="px-2 py-1.5 rounded-lg bg-sidebar-accent/40">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">当前账号</p>
            <p className="text-sm font-medium text-foreground truncate">{username}</p>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {locale === "en" ? "EN" : "ZH"}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
              className="flex items-center gap-1 h-7 px-2 rounded-lg hover:bg-sidebar-accent transition-colors text-xs font-[var(--font-manrope)] font-semibold"
              title="Toggle language"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === "en" ? "中" : "EN"}
            </button>
            <button
              className="h-7 w-7 rounded-lg hover:bg-sidebar-accent flex items-center justify-center transition-colors"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            {username ? (
              <button
                onClick={handleLogout}
                className="h-7 w-7 rounded-lg hover:bg-sidebar-accent flex items-center justify-center transition-colors"
                title="退出"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Link href="/login">
                <button
                  className="h-7 w-7 rounded-lg hover:bg-sidebar-accent flex items-center justify-center transition-colors"
                  title="登录"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </Link>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
