"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { api, type ProjectDetail } from "@/lib/library-admin-api";
import { formatBytes, formatDate } from "@/lib/utils";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = decodeURIComponent(params.slug);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // 编辑表单
  const [titleZh, setTitleZh] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.getProject(slug);
      setProject(data);
      setTitleZh(data.title_zh ?? "");
      setDescription(data.description ?? "");
      setTagsInput((data.tags ?? []).join(", "));
    } catch (err) {
      toast.error((err as Error).message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function onSavePatch() {
    setBusy(true);
    try {
      await api.patchProject(slug, {
        title_zh: titleZh || null,
        description: description || "",
        tags: tagsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success("已保存");
      setEditing(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message || "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePublish() {
    if (!project) return;
    setBusy(true);
    try {
      if (project.status === "published") {
        await api.unpublishProject(slug);
        toast.success("已下线");
      } else {
        await api.publishProject(slug);
        toast.success("已发布");
      }
      await load();
    } catch (err) {
      toast.error((err as Error).message || "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm(`确定删除项目 "${slug}"? 此操作不可撤销, 媒体文件也会被删除.`)) return;
    setBusy(true);
    try {
      await api.deleteProject(slug);
      toast.success("已删除");
      router.replace("/projects");
    } catch (err) {
      toast.error((err as Error).message || "删除失败");
      setBusy(false);
    }
  }

  const filesByKnode = useMemo(() => {
    if (!project?.manifest) return null;
    const manifest = project.manifest as Record<string, unknown>;
    const files = (manifest.files as Array<{ path: string; size: number }>) ?? [];
    const knodes = (manifest.knodes as Array<{ module_id: string; knode_dir: string; title: string }>) ?? [];
    const grouped: Record<string, { module_id: string; title: string; files: { path: string; size: number }[] }> = {};
    for (const k of knodes) {
      grouped[k.knode_dir] = { module_id: k.module_id, title: k.title, files: [] };
    }
    grouped["__shared__"] = { module_id: "shared", title: "(项目共享)", files: [] };
    for (const f of files) {
      let matched = false;
      for (const k of knodes) {
        if (f.path.startsWith(k.knode_dir + "/")) {
          grouped[k.knode_dir].files.push(f);
          matched = true;
          break;
        }
      }
      if (!matched) grouped["__shared__"].files.push(f);
    }
    return grouped;
  }, [project]);

  if (loading) {
    return (
      <>
        <TopBar />
        <main className="max-w-6xl mx-auto px-6 py-12 text-muted-foreground text-sm">加载中...</main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <TopBar />
        <main className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-muted-foreground">项目不存在.</div>
          <Link href="/projects" className="text-primary hover:underline text-sm">
            ← 返回列表
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">
              ← 返回列表
            </Link>
            <h1 className="text-2xl font-semibold mt-1.5">{project.title_zh || project.title}</h1>
            <div className="text-sm text-muted-foreground mt-1 font-mono">{project.slug}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePublish}
              disabled={busy}
              className={`h-9 px-4 rounded-md text-sm font-medium ${
                project.status === "published"
                  ? "border border-border hover:bg-muted"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              } disabled:opacity-50`}
            >
              {project.status === "published" ? "下线" : "发布"}
            </button>
            <button
              onClick={onDelete}
              disabled={busy}
              className="h-9 px-4 rounded-md border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground text-sm disabled:opacity-50"
            >
              删除
            </button>
          </div>
        </div>

        {/* Summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="状态" value={project.status === "published" ? "已发布" : "草稿"} />
          <SummaryCard label="版本" value={project.version} mono />
          <SummaryCard label="规模" value={`${project.stage_count}S · ${project.knode_count}K`} />
          <SummaryCard label="包大小" value={formatBytes(project.total_size_bytes)} />
          <SummaryCard label="时长 (周)" value={project.duration_weeks != null ? String(project.duration_weeks) : "-"} />
          <SummaryCard label="领域" value={project.domain || "-"} />
          <SummaryCard label="年龄" value={project.age_band || "-"} />
          <SummaryCard label="难度" value={project.difficulty != null ? String(project.difficulty) : "-"} />
          <SummaryCard label="发布时间" value={formatDate(project.published_at)} />
          <SummaryCard label="更新时间" value={formatDate(project.updated_at)} />
        </section>

        {/* Metadata 编辑 */}
        <section className="border border-border rounded-md bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">元数据</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-primary hover:underline"
              >
                编辑
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">中文标题</span>
                <input
                  type="text"
                  value={titleZh}
                  onChange={(e) => setTitleZh(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">描述</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">标签 (逗号分隔)</span>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={onSavePatch}
                  disabled={busy}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setTitleZh(project.title_zh ?? "");
                    setDescription(project.description ?? "");
                    setTagsInput((project.tags ?? []).join(", "));
                  }}
                  disabled={busy}
                  className="h-9 px-4 rounded-md border border-border text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <dl className="text-sm space-y-2">
              <Row label="英文标题" value={project.title} />
              <Row label="中文标题" value={project.title_zh || "-"} />
              <Row label="描述" value={project.description || "-"} />
              <Row label="标签" value={(project.tags ?? []).join(", ") || "-"} />
            </dl>
          )}
        </section>

        {/* 文件树 */}
        <section className="border border-border rounded-md bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">文件清单</h2>
            <span className="text-xs text-muted-foreground">
              {(((project.manifest as Record<string, unknown>)?.files as unknown[]) ?? []).length} 个文件
            </span>
          </div>
          {filesByKnode ? (
            <div className="space-y-3">
              {Object.entries(filesByKnode).map(([dir, info]) => (
                <details key={dir} className="border border-border rounded-md" open={info.files.length > 0 && info.files.length < 10}>
                  <summary className="px-3 py-2 text-sm font-medium cursor-pointer flex items-center justify-between">
                    <span>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{info.module_id}</span>
                      {info.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {info.files.length} 个 · {formatBytes(info.files.reduce((a, b) => a + b.size, 0))}
                    </span>
                  </summary>
                  <ul className="border-t border-border divide-y divide-border">
                    {info.files.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-muted-foreground">(空)</li>
                    ) : (
                      info.files.map((f) => (
                        <li key={f.path} className="px-3 py-1.5 text-xs flex items-center justify-between hover:bg-muted/30">
                          <Link
                            href={`/projects/${slug}/preview?path=${encodeURIComponent(f.path)}`}
                            className="font-mono truncate flex-1 hover:underline"
                          >
                            {f.path}
                          </Link>
                          <span className="text-muted-foreground ml-3 shrink-0">{formatBytes(f.size)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </details>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">manifest 缺失.</div>
          )}
        </section>
      </main>
    </>
  );
}

function SummaryCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-border rounded-md bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm mt-1 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
      <dd className="flex-1 break-words">{value}</dd>
    </div>
  );
}
