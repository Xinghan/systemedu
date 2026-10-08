"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, CheckCircle2, LockKeyhole, Phone } from "lucide-react"
import { inviteApplications } from "@/lib/api"
import { useLocale } from "@/lib/i18n/use-t"

const PHONE_RE = /^1[3-9]\d{9}$/

const COPY = {
  zh: {
    eyebrow: "SystemEdu 内测",
    title: "申请你的邀请码",
    body: "把手机号留在这里。审核通过后，管理员会用它联系你并发放邀请码。",
    label: "手机号",
    placeholder: "请输入 11 位手机号",
    submit: "提交邀请码申请",
    submitting: "正在提交…",
    privacy: "手机号只用于处理邀请码申请；不会自动创建账号或发送验证码。",
    invalid: "请输入正确的 11 位手机号",
    successTitle: "申请已收到",
    successBody: "我们已经记录了你的申请，请留意管理员后续的联系。",
    loginHint: "已经拿到邀请码？",
    login: "去登录",
    back: "先浏览项目",
  },
  en: {
    eyebrow: "SystemEdu beta",
    title: "Request your invite",
    body: "Leave your phone number here. Once approved, an administrator will use it to contact you with an invite.",
    label: "Phone number",
    placeholder: "Enter an 11-digit mobile number",
    submit: "Request an invite",
    submitting: "Submitting…",
    privacy: "Your phone number is only used to process this invite request. It will not create an account or send a verification code.",
    invalid: "Enter a valid 11-digit mobile number",
    successTitle: "Request received",
    successBody: "Your request has been recorded. Please wait for the administrator to contact you.",
    loginHint: "Already have an invite?",
    login: "Sign in",
    back: "Browse projects first",
  },
} as const

export default function ApplyInvitePage() {
  const lang = useLocale()
  const t = COPY[lang]
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!PHONE_RE.test(phone)) {
      setError(t.invalid)
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await inviteApplications.submit(phone)
      setSubmitted(true)
      setPhone("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: "calc(100vh - 58px)", display: "grid", placeItems: "center", padding: "48px 24px 72px", position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,119,87,.16), transparent 67%)", top: 18, right: "8%" }} />
      <div aria-hidden="true" style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(111,86,173,.13), transparent 68%)", bottom: 20, left: "5%" }} />

      <section style={{ width: "100%", maxWidth: 610, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 14 }}><span className="dot" /> {t.eyebrow}</div>
          <h1 className="display" style={{ fontSize: 46, lineHeight: 1.04, letterSpacing: "-.04em" }}>{t.title}</h1>
          <p style={{ margin: "14px auto 0", maxWidth: 470, color: "var(--sub)", lineHeight: 1.7, fontSize: 15.5 }}>{t.body}</p>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "34px 36px", boxShadow: "var(--shadow-md)" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "14px 4px 4px" }}>
              <CheckCircle2 size={46} strokeWidth={1.45} style={{ color: "var(--climate)", marginBottom: 16 }} />
              <h2 style={{ fontSize: 25, letterSpacing: "-.025em" }}>{t.successTitle}</h2>
              <p style={{ margin: "12px auto 26px", color: "var(--sub)", lineHeight: 1.65, maxWidth: 400 }}>{t.successBody}</p>
              <Link href="/library" className="btn btn-violet btn-lg">{t.back}<ArrowRight size={16} strokeWidth={1.6} /></Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="invite-phone" style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 9 }}>{t.label}</label>
              <div style={{ position: "relative" }}>
                <Phone size={18} strokeWidth={1.6} aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--sub)" }} />
                <input
                  id="invite-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder={t.placeholder}
                  aria-invalid={Boolean(error)}
                  aria-describedby="invite-privacy invite-error"
                  style={{ width: "100%", height: 52, padding: "0 14px 0 44px", borderRadius: 11, border: `1px solid ${error ? "#c7624c" : "var(--border)"}`, background: "var(--paper)", color: "var(--ink)", fontSize: 16, boxSizing: "border-box", outline: "none" }}
                />
              </div>
              <p id="invite-error" role="alert" style={{ minHeight: 22, color: "#b8503a", fontSize: 13, margin: "8px 0 0" }}>{error}</p>
              <button type="submit" className="btn btn-violet btn-lg" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
                {submitting ? t.submitting : t.submit}<ArrowRight size={16} strokeWidth={1.6} />
              </button>
              <p id="invite-privacy" style={{ display: "flex", gap: 7, alignItems: "flex-start", margin: "18px 0 0", color: "var(--sub-2)", fontSize: 12.5, lineHeight: 1.55 }}><LockKeyhole size={14} strokeWidth={1.5} style={{ flex: "0 0 auto", marginTop: 2 }} />{t.privacy}</p>
            </form>
          )}
        </div>

        {!submitted && <p style={{ textAlign: "center", marginTop: 22, color: "var(--sub)", fontSize: 13.5 }}>{t.loginHint} <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>{t.login}</Link></p>}
      </section>
    </main>
  )
}
