"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { GraduationCap, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    setUsername(auth.getCachedUsername())
    setAuthReady(true)
  }, [])

  async function handleLogout() {
    await auth.logout()
    setUsername(null)
    router.replace("/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/library" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="size-5 text-primary" />
            <span>SystemEdu</span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/library"
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-colors",
                  pathname === "/library"
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                项目库
              </Link>
              {authReady && username && (
                <Link
                  href="/library?view=mine"
                  className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  我的课程
                </Link>
              )}
            </nav>
            <div className="h-6 w-px bg-border" />
            {authReady ? (
              username ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground hidden sm:inline">{username}</span>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="size-4" />
                    退出
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/login">登录</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/register">注册</Link>
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
