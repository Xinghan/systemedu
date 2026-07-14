"use client";

/**
 * 邀请码管理视图 (spec 047) — 码-账户对应、批次筛选、复制未用码。
 * 数据来自 student-app GET /api/admin/invite-codes (鉴权复用 library admin JWT,
 * student-app 反查 library /admin/auth/me)。生产 nginx 同源 /api/*; 本地 dev
 * 用 NEXT_PUBLIC_STUDENT_BASE_URL (默认 http://127.0.0.1:18820)。
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, TicketCheck, TicketSlash } from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getToken, clearToken } from "@/lib/library-admin-api";

interface InviteUser {
  user_id: string;
  phone: string | null;
  display_name: string | null;
}

interface InviteCode {
  code: string;
  batch: string | null;
  created_at: string | null;
  used_at: string | null;
  user: InviteUser | null;
}

interface InviteResp {
  stats: { total: number; used: number; unused: number };
  codes: InviteCode[];
}

function studentBase(): string {
  if (process.env.NEXT_PUBLIC_STUDENT_BASE_URL) return process.env.NEXT_PUBLIC_STUDENT_BASE_URL;
  // 生产同源 (nginx /api/* -> student-app); 本地 dev 直连
  if (typeof window !== "undefined" && window.location.port === "3001") {
    return "http://127.0.0.1:18820";
  }
  return "";
}

export default function InvitesPage() {
  const router = useRouter();
  const [data, setData] = useState<InviteResp | null>(null);
  const [batch, setBatch] = useState<string>("all");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(`${studentBase()}/api/admin/invite-codes`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (r) => {
        if (r.status === 401) {
          clearToken();
          router.replace("/login");
          throw new Error("登录已过期");
        }
        if (!r.ok) throw new Error(`加载失败 (${r.status})`);
        return r.json() as Promise<InviteResp>;
      })
      .then(setData)
      .catch((err) => toast.error((err as Error).message));
  }, [router]);

  const batches = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.codes.map((c) => c.batch || "-"))].sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (batch === "all") return data.codes;
    return data.codes.filter((c) => (c.batch || "-") === batch);
  }, [data, batch]);

  const filteredUnused = filtered.filter((c) => !c.user);

  function copyUnused() {
    const text = filteredUnused.map((c) => c.code).join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success(`已复制 ${filteredUnused.length} 个未用邀请码`),
      () => toast.error("复制失败"),
    );
  }

  return (
    <>
      <TopBar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">邀请码</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              注册邀请码与账户对应关系 (spec 046/047).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="all">全部批次</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={copyUnused} disabled={!filteredUnused.length}>
              <Copy className="size-4" />
              复制未用码 ({filteredUnused.length})
            </Button>
          </div>
        </div>

        {!data ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard icon={<KeyRound className="size-5 text-primary" />} label="总数" value={data.stats.total} />
              <StatCard icon={<TicketCheck className="size-5 text-primary" />} label="已使用" value={data.stats.used} />
              <StatCard icon={<TicketSlash className="size-5 text-primary" />} label="未使用" value={data.stats.unused} />
            </div>

            <Card className="overflow-hidden py-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">邀请码</th>
                      <th className="px-4 py-2.5 font-medium">批次</th>
                      <th className="px-4 py-2.5 font-medium">状态</th>
                      <th className="px-4 py-2.5 font-medium">手机号</th>
                      <th className="px-4 py-2.5 font-medium">昵称</th>
                      <th className="px-4 py-2.5 font-medium">使用时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.code} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 font-mono tracking-wider">{c.code}</td>
                        <td className="px-4 py-2 text-muted-foreground">{c.batch || "-"}</td>
                        <td className="px-4 py-2">
                          {c.user ? (
                            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">已使用</span>
                          ) : (
                            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">未使用</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono">{c.user?.phone || "-"}</td>
                        <td className="px-4 py-2">{c.user?.display_name || "-"}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {c.used_at ? new Date(c.used_at + "Z").toLocaleString("zh-CN", { hour12: false }) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}
