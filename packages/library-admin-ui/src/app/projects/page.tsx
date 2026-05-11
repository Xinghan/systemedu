"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { api, type ProjectSummary } from "@/lib/library-admin-api";
import { formatBytes, formatDate } from "@/lib/utils";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
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
          <h1 className="text-2xl font-semibold">项目库</h1>
          <Link
            href="/projects/upload"
            className="h-9 px-4 inline-flex items-center rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            上传 tarball
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <input
            type="text"
            placeholder="按 slug / 标题搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            className="h-9 px-3 rounded-md border border-border bg-background text-sm flex-1 max-w-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-9 px-3 rounded-md border border-border bg-background text-sm"
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </div>

        {loading && <div className="text-muted-foreground text-sm py-12 text-center">加载中...</div>}

        {projects && projects.length === 0 && (
          <div className="text-muted-foreground text-sm py-16 text-center border border-dashed border-border rounded-md">
            还没有项目, 先上传一个 tarball.
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">slug</th>
                  <th className="px-4 py-2.5 font-medium">标题</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">版本</th>
                  <th className="px-4 py-2.5 font-medium">规模</th>
                  <th className="px-4 py-2.5 font-medium">大小</th>
                  <th className="px-4 py-2.5 font-medium">更新</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.slug} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link className="hover:underline" href={`/projects/${p.slug}`}>
                        {p.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link className="hover:underline" href={`/projects/${p.slug}`}>
                        {p.title_zh || p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.version}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.stage_count} stages · {p.knode_count} knodes
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatBytes(p.total_size_bytes)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-primary/10 text-primary",
  };
  const label: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${map[status] ?? "bg-muted"}`}>
      {label[status] ?? status}
    </span>
  );
}
