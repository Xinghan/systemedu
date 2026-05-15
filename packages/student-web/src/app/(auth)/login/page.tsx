"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { auth } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function LoginPage() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next") || "/home"
  const { setAuth, hydrate, loggedIn } = useAuthStore()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  // 已登录就跳走
  useEffect(() => {
    hydrate()
  }, [hydrate])
  useEffect(() => {
    if (loggedIn) router.replace(next)
  }, [loggedIn, next, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await auth.login(username, password)
      setAuth(res.token, res.username)
      toast.success(t("auth.login.submit") + " ✓")
      router.replace(next)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("auth.error_generic"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">{t("auth.login.title")}</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="username" className="text-sm font-medium text-foreground">
            {t("auth.username")}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "..." : t("auth.login.submit")}
        </button>
        <p className="pt-2 text-center text-sm text-muted-foreground">
          <Link href="/register" className="text-primary hover:underline">
            {t("auth.to_register")}
          </Link>
        </p>
      </form>
    </div>
  )
}
