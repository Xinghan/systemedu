"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, getToken } from "@/lib/library-admin-api";

export default function PreviewPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = decodeURIComponent(params.slug);
  const path = search.get("path") || "";

  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const isText = ["md", "txt", "json", "html"].includes(ext);
  const isMd = ext === "md";
  const isHtml = ext === "html";
  const isImage = ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext);
  const isAudio = ["mp3", "m4a", "wav", "ogg"].includes(ext);
  const isVideo = ["mp4", "webm", "mov"].includes(ext);

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const fileUrl = path ? api.fileUrl(slug, path) : "";

  useEffect(() => {
    if (!path) return;
    if (!isText) {
      setText(null);
      return;
    }
    setLoading(true);
    api
      .fetchFileText(slug, path)
      .then(setText)
      .catch((err) => toast.error((err as Error).message || "加载失败"))
      .finally(() => setLoading(false));
  }, [slug, path, isText]);

  useEffect(() => {
    if (!path) return;
    if (!isHtml && !isImage && !isAudio && !isVideo) {
      setBlobUrl(null);
      return;
    }
    const token = getToken();
    let revoked = false;
    let current: string | null = null;
    fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (revoked) return;
        current = URL.createObjectURL(blob);
        setBlobUrl(current);
      })
      .catch((err) => toast.error((err as Error).message || "加载文件失败"));
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, isHtml, isImage, isAudio, isVideo, path]);

  if (!path) {
    return (
      <>
        <TopBar />
        <main className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted-foreground">
          未指定文件路径.
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href={`/projects/${slug}`}>
              <ArrowLeft className="size-4" />
              返回 {slug}
            </Link>
          </Button>
          <h1 className="text-base font-mono break-all">{path}</h1>
        </div>

        <Card className="overflow-hidden p-0">
          {loading && <div className="p-8 text-sm text-muted-foreground">加载中...</div>}

          {isMd && text != null && (
            <article className="prose prose-stone max-w-none p-6 [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </article>
          )}

          {(ext === "json" || ext === "txt") && text != null && (
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-[70vh]">
              {text}
            </pre>
          )}

          {isHtml && blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-[80vh] bg-white"
              sandbox="allow-scripts allow-same-origin"
              title={path}
            />
          )}

          {isImage && blobUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blobUrl} alt={path} className="max-w-full h-auto mx-auto block" />
          )}

          {isAudio && blobUrl && (
            <div className="p-6">
              <audio src={blobUrl} controls className="w-full" />
            </div>
          )}

          {isVideo && blobUrl && (
            <video src={blobUrl} controls className="w-full max-h-[80vh] bg-black" />
          )}

          {!isText && !isImage && !isAudio && !isVideo && !isHtml && (
            <div className="p-8 text-sm text-muted-foreground">
              不支持预览此类型 (.{ext}).{" "}
              <a className="text-primary hover:underline" href={fileUrl} target="_blank" rel="noreferrer">
                直接下载
              </a>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
