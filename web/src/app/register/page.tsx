"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/api"

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("两次输入的密码不一致")
      return
    }
    if (password.length < 6) {
      toast.error("密码至少 6 位")
      return
    }
    if (username.length < 3 || username.length > 32) {
      toast.error("用户名长度 3-32")
      return
    }
    setLoading(true)
    try {
      await auth.register(username, password)
      toast.success("注册成功")
      router.replace("/dashboard")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "注册失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">注册 SystemEdu</CardTitle>
          <CardDescription>创建你的账号开始学习</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="字母/数字/_-., 3-32 位"
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
                autoComplete="new-password"
                placeholder="至少 6 位"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">确认密码</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "注册中..." : "注册"}
            </Button>
            <p className="text-sm text-muted-foreground text-center pt-2">
              已有账号? <Link href="/login" className="text-primary hover:underline">直接登录</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
