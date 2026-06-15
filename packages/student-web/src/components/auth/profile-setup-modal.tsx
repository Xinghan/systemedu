"use client"

/**
 * ProfileSetupModal — 首次登录资料补全弹窗 (手机号短信登录后, profile_completed=false 时弹出)。
 *
 * 必填: display_name (1-32 字符) / student_age (3-25) / gender (male/female/other)。
 * 不可关闭跳过 — profile_completed 驱动它再次弹出, 必须填完才能用。
 * 提交成功后回调 onCompleted(displayName), 由父组件负责跳主页。
 */

import { useState } from "react"
import { User } from "lucide-react"

import { auth } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"

const GENDERS = ["male", "female", "other"] as const
type Gender = (typeof GENDERS)[number]

export function ProfileSetupModal({
  onCompleted,
}: {
  onCompleted: (displayName: string) => void
}) {
  const t = useT()
  const [displayName, setDisplayName] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState<Gender | "">("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ageNum = Number(age)
  const valid =
    displayName.trim().length >= 1 &&
    displayName.trim().length <= 32 &&
    Number.isInteger(ageNum) &&
    ageNum >= 3 &&
    ageNum <= 25 &&
    gender !== ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || loading) return
    setLoading(true)
    setError(null)
    try {
      await auth.updateProfile({
        display_name: displayName.trim(),
        student_age: ageNum,
        gender,
      })
      onCompleted(displayName.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.error_generic"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* 不可点遮罩关闭 — 必须填完 */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <User size={16} />
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("auth.profile.title")}
          </h2>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{t("auth.profile.subtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="display_name" className="text-sm font-medium text-foreground">
              {t("auth.profile.display_name")}
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("auth.profile.display_name.placeholder")}
              maxLength={32}
              required
              className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="student_age" className="text-sm font-medium text-foreground">
              {t("auth.profile.student_age")}
            </label>
            <input
              id="student_age"
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder={t("auth.profile.student_age.placeholder")}
              min={3}
              max={25}
              required
              className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              {t("auth.profile.gender")}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {GENDERS.map((g) => {
                const active = gender === g
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={
                      "rounded-md border px-3 py-2 text-sm font-medium transition " +
                      (active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 bg-background text-foreground hover:border-primary/50")
                    }
                  >
                    {t(`auth.profile.gender.${g}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={!valid || loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "..." : t("auth.profile.submit")}
          </button>
        </form>
      </div>
    </div>
  )
}
