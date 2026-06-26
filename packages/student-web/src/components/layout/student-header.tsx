"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Brain,
  ChevronDown,
  GitBranch,
  Home,
  Library as LibraryIcon,
  Lightbulb,
  LogOut,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { auth } from "@/lib/api"
import { useT } from "@/lib/i18n/use-t"
import { LangSwitch } from "@/components/layout/lang-switch"
import { ApplyProjectModal } from "@/components/layout/apply-project-modal"

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
  const [applyOpen, setApplyOpen] = useState(false)
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
        <span className="brand-mark" aria-label="SystemEdu">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
            <rect width="26" height="26" rx="6" fill="var(--ink)" />
            <path d="M18.5 9 C18.5 6.4 10.8 6 9 8.6 C7.2 11.2 10.8 12 13 12.9 C15.6 13.8 19 14.7 17.2 17.7 C15.4 20.4 8.6 20 8.2 16.9" fill="none" stroke="var(--violet)" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        </span>
        <span>SystemEdu</span>
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

      {loggedIn && (
        <button
          type="button"
          onClick={() => setApplyOpen(true)}
          className="btn btn-ghost btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Lightbulb size={14} strokeWidth={1.5} />
          {t("nav.apply_project")}
        </button>
      )}

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
          <Link href="/login" className="btn btn-violet btn-sm">
            {t("nav.register")}
          </Link>
        </div>
      )}

      <ApplyProjectModal open={applyOpen} onClose={() => setApplyOpen(false)} />
    </header>
  )
}
