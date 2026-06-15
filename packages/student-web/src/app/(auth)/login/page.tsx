"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { auth } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import { useAuthStore } from "@/lib/stores/auth-store"
import { ProfileSetupModal } from "@/components/auth/profile-setup-modal"

const PHONE_RE = /^1[3-9]\d{9}$/

// useSearchParams 需要 Suspense 边界 (Next.js 静态预渲染要求)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next") || "/home"
  const { setAuth, setDisplayName, hydrate, loggedIn } = useAuthStore()

  const [mode, setMode] = useState<"register" | "login">("register")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 已登录就跳走 (除非正在补全资料)
  useEffect(() => {
    hydrate()
  }, [hydrate])
  useEffect(() => {
    if (loggedIn && !showProfile) router.replace(next)
  }, [loggedIn, next, router, showProfile])

  // 倒计时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown(sec: number) {
    setCooldown(sec)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function handleSendCode() {
    if (!PHONE_RE.test(phone)) {
      toast.error(t("auth.phone_invalid"))
      return
    }
    setSending(true)
    try {
      const res = await auth.sendCode(phone)
      toast.success(t("auth.code_sent"))
      startCooldown(res.cooldown_sec || 60)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("auth.error_generic"))
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!PHONE_RE.test(phone)) {
      toast.error(t("auth.phone_invalid"))
      return
    }
    setLoading(true)
    try {
      const res = await auth.verify(phone, code)
      if (res.profile_completed) {
        setAuth(res.token)
        // 拉 display_name 填充顶栏头像 (失败不阻塞登录)
        try {
          const me = await auth.me()
          if (me.display_name) setDisplayName(me.display_name)
        } catch {
          // ignore
        }
        router.replace(next)
      } else {
        // token 已由 auth.verify 存入 localStorage; 弹资料补全
        setShowProfile(true)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("auth.error_generic"))
    } finally {
      setLoading(false)
    }
  }

  const codeSent = cooldown > 0

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
      {/* 注册 / 登录 tab 切换 — 两 tab 后端逻辑完全相同, 仅文案区分 */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background p-1">
        {(["register", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`auth.tab.${m}`)}
          </button>
        ))}
      </div>

      <h1 className="text-xl font-semibold tracking-tight">{t(`auth.${mode}.title`)}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{t(`auth.${mode}.subtitle`)}</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            {t("auth.phone")}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder={t("auth.phone.placeholder")}
            autoComplete="tel"
            maxLength={11}
            required
            className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            {t("auth.code")}
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("auth.code.placeholder")}
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={codeSent || sending || !PHONE_RE.test(phone)}
              className="shrink-0 whitespace-nowrap rounded-md border border-primary/60 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {codeSent ? t("auth.resend_in", { sec: cooldown }) : t("auth.send_code")}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "..." : t(`auth.${mode}.submit`)}
        </button>
      </form>

      {showProfile && (
        <ProfileSetupModal
          onCompleted={(displayName) => {
            // verify 时 token 已存入 localStorage; hydrate 拉进 store, 再写 display name
            hydrate()
            setDisplayName(displayName)
            setShowProfile(false)
            router.replace(next)
          }}
        />
      )}
    </div>
  )
}
