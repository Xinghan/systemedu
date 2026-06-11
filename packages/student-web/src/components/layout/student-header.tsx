"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Brain,
  ChevronDown,
  Command,
  GitBranch,
  Home,
  Library as LibraryIcon,
  LogOut,
  Search,
  Sparkles,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { auth } from "@/lib/api"
import { useT } from "@/lib/i18n/use-t"
import { LangSwitch } from "@/components/layout/lang-switch"

const TABS = [
  { id: "home",     labelKey: "nav.home",        icon: Home,        href: "/home" },
  { id: "library",  labelKey: "nav.library",     icon: LibraryIcon, href: "/library" },
  { id: "projects", labelKey: "nav.my_projects", icon: GitBranch,   href: "/my-projects" },
]

const menuItemStyle: React.CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--ink-2)",
  fontSize: 13,
  textAlign: "left",
  textDecoration: "none",
}

function initials(name?: string | null): string {
  if (!name) return "?"
  const trimmed = name.trim()
  if (trimmed.length === 0) return "?"
  const parts = trimmed.split(/[\s_\-.]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

export function StudentHeader() {
  const router = useRouter()
  const pathname = usePathname() || "/"
  const { loggedIn, username, hydrate, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useT()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  async function handleLogout() {
    await auth.logout()
    logout()
    setMenuOpen(false)
    router.replace("/login")
  }

  function isActive(href: string): boolean {
    if (href === "/home") return pathname === "/home"
    if (href === "/library") return pathname.startsWith("/library")
    if (href === "/my-projects") return pathname.startsWith("/my-projects")
    if (href === "/sessions") return pathname.startsWith("/sessions")
    if (href === "/memory") return pathname.startsWith("/memory")
    return pathname === href
  }

  return (
    <header className="topnav">
      {/* brand 永远跳整站首页 / */}
      <Link className="brand" href="/">
        <span className="brand-mark"><span>SE</span></span>
        <span>SystemEdu</span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            padding: "2px 6px",
            background: "var(--paper-2)",
            borderRadius: 4,
            color: "var(--sub)",
            marginLeft: 2,
            border: "1px solid var(--border)",
          }}
        >
          v2.4
        </span>
      </Link>

      <nav className="nav-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={"nav-tab " + (isActive(tab.href) ? "active" : "")}
            >
              <Icon size={15} strokeWidth={1.5} />
              {t(tab.labelKey)}
            </Link>
          )
        })}
      </nav>

      <div className="nav-spacer" />

      <button
        type="button"
        className="kbar"
        onClick={() => {
          // TODO spec 030: 全局搜索
        }}
        aria-label={t("nav.search")}
      >
        <Search size={15} strokeWidth={1.5} />
        <span>{t("nav.search")}</span>
        <span className="kbd">
          <Command size={10} strokeWidth={1.5} style={{ verticalAlign: -1 }} /> K
        </span>
      </button>

      <button type="button" className="btn btn-ghost btn-sm" style={{ height: 32 }}>
        <Sparkles size={14} strokeWidth={1.5} /> {t("nav.assistant")}
      </button>

      <LangSwitch />

      {loggedIn ? (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="user-chip"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="avatar">{initials(username)}</span>
            {username}
            <ChevronDown size={13} strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                minWidth: 160,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "var(--shadow-md)",
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <Link
                href="/brain"
                onClick={() => setMenuOpen(false)}
                style={menuItemStyle}
              >
                <Brain size={14} strokeWidth={1.5} />
                {t("nav.brain")}
              </Link>
              <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
              <button
                type="button"
                onClick={handleLogout}
                style={{ ...menuItemStyle, border: 0, background: "transparent", width: "100%", cursor: "pointer" }}
              >
                <LogOut size={14} strokeWidth={1.5} />
                {t("nav.logout")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login" className="btn btn-ghost btn-sm">
            {t("nav.login")}
          </Link>
          <Link href="/register" className="btn btn-violet btn-sm">
            {t("nav.register")}
          </Link>
        </div>
      )}
    </header>
  )
}
