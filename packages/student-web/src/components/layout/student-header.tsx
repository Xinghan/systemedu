"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
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

const TABS = [
  { id: "home",     label: "Home",         icon: Home,       href: "/home" },
  { id: "library",  label: "Library",      icon: LibraryIcon, href: "/library" },
  { id: "projects", label: "My Projects",  icon: GitBranch,  href: "/home" }, // 暂复用 /home
]

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
    if (href === "/home") return pathname.startsWith("/home")
    if (href === "/library") return pathname.startsWith("/library")
    return pathname === href
  }

  return (
    <header className="topnav">
      <Link className="brand" href={loggedIn ? "/home" : "/"}>
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
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.id}
              href={t.href}
              className={"nav-tab " + (isActive(t.href) ? "active" : "")}
            >
              <Icon size={15} strokeWidth={1.5} />
              {t.label}
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
        aria-label="搜索"
      >
        <Search size={15} strokeWidth={1.5} />
        <span>Search projects, modules, concepts…</span>
        <span className="kbd">
          <Command size={10} strokeWidth={1.5} style={{ verticalAlign: -1 }} /> K
        </span>
      </button>

      <button type="button" className="btn btn-ghost btn-sm" style={{ height: 32 }}>
        <Sparkles size={14} strokeWidth={1.5} /> Assistant
      </button>

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
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: 0,
                  background: "transparent",
                  color: "var(--ink-2)",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <LogOut size={14} strokeWidth={1.5} />
                退出登录
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login" className="btn btn-ghost btn-sm">
            登录
          </Link>
          <Link href="/register" className="btn btn-violet btn-sm">
            注册
          </Link>
        </div>
      )}
    </header>
  )
}
