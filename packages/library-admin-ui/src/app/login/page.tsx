"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, setToken } from "@/lib/library-admin-api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    try {
      const res = await api.login(username, password);
      setToken(res.token, res.username);
      toast.success("登录成功");
      router.replace("/projects");
    } catch (err) {
      toast.error((err as Error).message || "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-md p-8 space-y-5 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold">SystemEdu Library Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">内容库管理后台</p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">用户名</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}
