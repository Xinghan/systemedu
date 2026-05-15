"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { auth } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import { GraduationCap, LogOut, ChevronDown, User2 } from "lucide-react"

export function StudentHeader() {
  const t = useT()
  const router = useRouter()
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link
          href={loggedIn ? "/home" : "/"}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap size={18} />
          </span>
          <span>SystemEdu</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 text-sm">
          <Link
            href="/library"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {t("nav.library")}
          </Link>
          {loggedIn && (
            <Link
              href="/home"
              className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {t("nav.my_projects")}
            </Link>
          )}
        </nav>

        {loggedIn ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <User2 size={16} />
              <span>{username ?? "User"}</span>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg"
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <LogOut size={14} />
                  {t("nav.logout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 font-medium hover:bg-accent"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("nav.register")}
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
