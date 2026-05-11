"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    if (!confirm(`确定删除项目 "${slug}"? 此操作不可撤销, 媒体文件也会被删除.`))
      return;
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
    const knodes =
      (manifest.knodes as Array<{
        module_id: string;
        knode_dir: string;
        title: string;
      }>) ?? [];
    const grouped: Record<
      string,
      { module_id: string; title: string; files: { path: string; size: number }[] }
    > = {};
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
        <main className="max-w-6xl mx-auto px-6 py-12 text-muted-foreground text-sm">
          加载中...
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <TopBar />
        <main className="max-w-6xl mx-auto px-6 py-12 space-y-3">
          <div className="text-muted-foreground">项目不存在.</div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="size-4" />
              返回列表
            </Link>
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/projects">
              <ArrowLeft className="size-4" />
              返回列表
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold">{project.title_zh || project.title}</h1>
              <div className="text-sm text-muted-foreground mt-1 font-mono">
                {project.slug}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={project.status === "published" ? "outline" : "default"}
                size="sm"
                onClick={onTogglePublish}
                disabled={busy}
              >
                {project.status === "published" ? "下线" : "发布"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={busy}
              >
                <Trash2 className="size-4" />
                删除
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard
            label="状态"
            value={
              <Badge variant={project.status === "published" ? "default" : "secondary"}>
                {project.status === "published" ? "已发布" : "草稿"}
              </Badge>
            }
          />
          <SummaryCard label="版本" value={<span className="font-mono">{project.version}</span>} />
          <SummaryCard
            label="规模"
            value={`${project.stage_count}S · ${project.knode_count}K`}
          />
          <SummaryCard label="包大小" value={formatBytes(project.total_size_bytes)} />
          <SummaryCard
            label="时长 (周)"
            value={project.duration_weeks != null ? String(project.duration_weeks) : "-"}
          />
          <SummaryCard label="领域" value={project.domain || "-"} />
          <SummaryCard label="年龄" value={project.age_band || "-"} />
          <SummaryCard
            label="难度"
            value={project.difficulty != null ? String(project.difficulty) : "-"}
          />
          <SummaryCard label="发布时间" value={formatDate(project.published_at)} />
          <SummaryCard label="更新时间" value={formatDate(project.updated_at)} />
        </div>

        {/* Metadata */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">元数据</CardTitle>
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Edit3 className="size-4" />
                编辑
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="titleZh">中文标题</Label>
                  <Input
                    id="titleZh"
                    value={titleZh}
                    onChange={(e) => setTitleZh(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">描述</Label>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tags">标签 (逗号分隔)</Label>
                  <Input
                    id="tags"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={onSavePatch} disabled={busy} size="sm">
                    保存
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setTitleZh(project.title_zh ?? "");
                      setDescription(project.description ?? "");
                      setTagsInput((project.tags ?? []).join(", "));
                    }}
                    disabled={busy}
                  >
                    取消
                  </Button>
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
          </CardContent>
        </Card>

        {/* 文件清单 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">文件清单</CardTitle>
            <span className="text-xs text-muted-foreground">
              {(((project.manifest as Record<string, unknown>)?.files as unknown[]) ?? []).length}{" "}
              个文件
            </span>
          </CardHeader>
          <CardContent>
            {filesByKnode ? (
              <div className="space-y-2">
                {Object.entries(filesByKnode).map(([dir, info]) => (
                  <details
                    key={dir}
                    className="border border-border rounded-xl overflow-hidden group"
                    open={info.files.length > 0 && info.files.length < 10}
                  >
                    <summary className="px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="font-mono text-xs text-muted-foreground">
                          {info.module_id}
                        </span>
                        <span>{info.title}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {info.files.length} 个 ·{" "}
                        {formatBytes(info.files.reduce((a, b) => a + b.size, 0))}
                      </span>
                    </summary>
                    <ul className="border-t border-border divide-y divide-border">
                      {info.files.length === 0 ? (
                        <li className="px-4 py-2 text-xs text-muted-foreground">(空)</li>
                      ) : (
                        info.files.map((f) => (
                          <li
                            key={f.path}
                            className="px-4 py-1.5 text-xs flex items-center justify-between hover:bg-muted/30 transition-colors"
                          >
                            <Link
                              href={`/projects/${slug}/preview?path=${encodeURIComponent(f.path)}`}
                              className="font-mono truncate flex-1 hover:text-primary"
                            >
                              {f.path}
                            </Link>
                            <span className="text-muted-foreground ml-3 shrink-0">
                              {formatBytes(f.size)}
                            </span>
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
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card size="sm" className="px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm mt-1">{value}</div>
    </Card>
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
