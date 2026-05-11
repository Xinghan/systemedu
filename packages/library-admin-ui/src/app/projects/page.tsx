"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type ProjectSummary } from "@/lib/library-admin-api";
import { cn, formatBytes, formatDate } from "@/lib/utils";

type StatusFilter = "all" | "draft" | "published";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listProjects({
        status: status === "all" ? undefined : status,
        search: search || undefined,
      });
      setProjects(data);
    } catch (err) {
      toast.error((err as Error).message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <>
      <TopBar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">项目库</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              管理已导入的项目内容包.
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/upload">
              <Plus className="size-4" />
              上传 tarball
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="按 slug / 标题搜索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load();
              }}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60">
            {(["all", "draft", "published"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  status === s
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "全部" : s === "draft" ? "草稿" : "已发布"}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="text-muted-foreground text-sm py-12 text-center">加载中...</div>
        )}

        {projects && projects.length === 0 && (
          <Card className="py-16 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              还没有项目, 先上传一个 tarball.
            </p>
          </Card>
        )}

        {projects && projects.length > 0 && (
          <Card className="overflow-hidden p-0 gap-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">slug</th>
                  <th className="px-4 py-2.5">标题</th>
                  <th className="px-4 py-2.5">状态</th>
                  <th className="px-4 py-2.5">版本</th>
                  <th className="px-4 py-2.5">规模</th>
                  <th className="px-4 py-2.5">大小</th>
                  <th className="px-4 py-2.5">更新</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.slug}
                    className="border-t border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link className="hover:text-primary" href={`/projects/${p.slug}`}>
                        {p.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link className="hover:text-primary" href={`/projects/${p.slug}`}>
                        {p.title_zh || p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.version}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.stage_count}S · {p.knode_count}K
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatBytes(p.total_size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(p.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return <Badge>已发布</Badge>;
  }
  return <Badge variant="secondary">草稿</Badge>;
}
