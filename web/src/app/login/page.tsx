"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { auth } from "@/lib/api"

/**
 * 登录页 — Industrial Atelier 设计语言 (main_design/UI/styles.css)
 * 暖米白纸面 + Claude 珊瑚橙 + Inter。色值内联, 不依赖整站 token
 * (生产 web/ 当前是紫色主题), 保证登录页独立呈现设计稿风格。
 */

// 设计稿权威调色板
const C = {
  paper: "#FAF9F5",
  paper2: "#F1EDDF",
  card: "#FFFFFF",
  ink: "#191814",
  ink2: "#2B2924",
  sub: "#6B6557",
  sub2: "#9D978A",
  border: "#EBE5D6",
  border2: "#D9D1BD",
  primary: "#D97757",
  primaryInk: "#9A4A2E",
  primarySoft: "#F8EDE5",
  primaryLine: "#ECCFB8",
  shadowSm: "0 1px 2px 0 rgba(25,24,20,.04)",
  shadow: "0 1px 3px 0 rgba(25,24,20,.06), 0 1px 2px -1px rgba(25,24,20,.04)",
  shadowMd: "0 4px 8px -2px rgba(25,24,20,.06), 0 2px 4px -2px rgba(25,24,20,.04)",
}

const SANS =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace'

const HIGHLIGHTS = [
  "多 Agent 智能导师",
  "真实工业级项目",
  "动态知识树驱动",
]

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await auth.login(username, password)
      toast.success("登录成功")
      router.replace("/dashboard")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (id: string): React.CSSProperties => ({
    width: "100%",
    height: 40,
    padding: "0 12px",
    fontSize: 14,
    fontFamily: SANS,
    color: C.ink,
    background: C.card,
    border: `1px solid ${focus === id ? C.primary : C.border2}`,
    borderRadius: 8,
    outline: "none",
    boxShadow: focus === id ? `0 0 0 3px ${C.primarySoft}` : "none",
    transition: "border-color 120ms, box-shadow 120ms",
  })

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: C.paper,
        fontFamily: SANS,
        color: C.ink,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── 顶部导航 ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "14px 32px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(250,249,245,.85)",
          backdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 60,
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 14.5, color: C.ink }}
        >
          <BrandMark />
          <span style={{ letterSpacing: "-0.01em" }}>SystemEdu</span>
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: C.sub }}>
          还没有账号?{" "}
          <Link href="/register" style={{ color: C.primary, fontWeight: 500 }}>
            注册
          </Link>
        </span>
      </header>

      {/* ── 主体: 居中表单卡片 ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: C.sub,
              marginBottom: 14,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.primary }} />
            岗位能力培训平台
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.028em", lineHeight: 1.15, margin: 0 }}>
            欢迎回来
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: C.sub, margin: "8px 0 0" }}>
            登录以继续你的岗位实战培训
          </p>

          {/* 卡片 */}
          <div
            style={{
              marginTop: 24,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: C.shadowMd,
              padding: 24,
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="username" style={{ fontSize: 13, fontWeight: 500, color: C.ink2 }}>
                  用户名
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocus("username")}
                  onBlur={() => setFocus(null)}
                  autoComplete="username"
                  placeholder="请输入用户名"
                  required
                  style={inputStyle("username")}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: C.ink2 }}>
                  密码
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocus("password")}
                  onBlur={() => setFocus(null)}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  required
                  style={inputStyle("password")}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: 44,
                  marginTop: 4,
                  border: 0,
                  borderRadius: 8,
                  background: C.primary,
                  color: "#fff",
                  fontSize: 14.5,
                  fontWeight: 500,
                  fontFamily: SANS,
                  boxShadow: C.shadowSm,
                  opacity: loading ? 0.6 : 1,
                  transition: "background 120ms, box-shadow 120ms",
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = C.primaryInk
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.primary
                }}
              >
                {loading ? "登录中..." : "登录"}
              </button>
            </form>
          </div>

          {/* 特性要点 (mono tag 风格) */}
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {HIGHLIGHTS.map((h) => (
              <span
                key={h}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  fontFamily: MONO,
                  letterSpacing: "0.02em",
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: `1px solid ${C.primaryLine}`,
                  background: C.primarySoft,
                  color: C.primaryInk,
                }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * 品牌标识 — 复刻设计稿 .brand-mark:
 * 墨黑圆角方块 + 珊瑚橙对角线纹理 + 字母 S。
 */
function BrandMark() {
  return (
    <span
      style={{
        position: "relative",
        width: 26,
        height: 26,
        borderRadius: 6,
        background: "#191814",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, transparent 40%, #D97757 40% 60%, transparent 60%)",
          opacity: 0.85,
        }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 2,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontWeight: 600,
          fontSize: 11,
          color: "#fff",
          mixBlendMode: "difference",
        }}
      >
        S
      </span>
    </span>
  )
}
