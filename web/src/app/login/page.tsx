"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/api"

const FEATURES = [
  {
    title: "多 Agent 智能导师",
    desc: "苏格拉底提问、错因诊断、脚手架引导，按岗位经验档自适应教学。",
  },
  {
    title: "真实工业级项目",
    desc: "从零基础参与真实产线项目，在实战中沉淀岗位能力。",
  },
  {
    title: "动态知识树驱动",
    desc: "DAG 前置依赖编排学习路径，记忆系统跨会话追踪你的卡点。",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

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

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* 左栏: 深色品牌区, 小屏隐藏 */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white">
        {/* 渐变底 + 网格纹理 */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(155deg, oklch(0.42 0.13 262) 0%, oklch(0.30 0.10 268) 55%, oklch(0.22 0.06 270) 100%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0 / 0.6) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse 90% 70% at 30% 25%, black, transparent 75%)",
          }}
        />
        {/* 光晕 */}
        <div
          className="absolute -top-24 -left-24 h-96 w-96 rounded-full -z-10 blur-3xl opacity-40"
          style={{ background: "oklch(0.62 0.18 250)" }}
        />

        {/* 顶部 logo */}
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[17px] font-semibold tracking-tight">SystemEdu</span>
        </div>

        {/* 中部 slogan */}
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            AI 驱动的
            <br />
            岗位能力培训平台
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            面向企业在职员工，从零基础参与真实工业级项目，在多 Agent 智能导师的引导下逐步掌握岗位技能。
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                <div>
                  <div className="text-[14px] font-medium">{f.title}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-white/60">
                    {f.desc}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 底部版权 */}
        <div className="text-[12px] text-white/45">
          本地优先的 AI Agent Sandbox 企业培训平台
        </div>
      </aside>

      {/* 右栏: 登录表单 */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* 小屏顶部 logo (左栏隐藏时仍可见品牌) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark className="text-accent" />
            <span className="text-[17px] font-semibold tracking-tight text-fg">
              SystemEdu
            </span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">欢迎回来</h2>
            <p className="mt-1.5 text-[14px] text-muted">登录以继续你的培训</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
                required
              />
            </div>
            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>

          <p className="mt-6 text-[13px] text-muted text-center">
            还没有账号?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline">
              立即注册
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

/** 纯几何 SVG 品牌标识 (项目禁用 emoji)。三层叠放方块隐喻知识树 DAG。 */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="22" height="22" rx="6" fill="currentColor" opacity="0.14" />
      <path
        d="M13 6.5L18.5 9.75V16.25L13 19.5L7.5 16.25V9.75L13 6.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="13" r="2.1" fill="currentColor" />
    </svg>
  )
}
