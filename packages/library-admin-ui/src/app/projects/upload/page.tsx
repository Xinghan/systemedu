"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { api, getBase, getToken } from "@/lib/library-admin-api";
import { formatBytes } from "@/lib/utils";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.name.endsWith(".tar.gz") && !f.name.endsWith(".tgz")) {
      toast.error("文件必须是 .tar.gz 或 .tgz");
      return;
    }
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      pickFile(e.dataTransfer.files[0]);
    }
  }

  async function uploadWithProgress(): Promise<{ slug: string; imported: boolean; knode_count: number }> {
    if (!file) throw new Error("no file");
    // XMLHttpRequest 用于真实进度 (fetch 还没标准化 upload progress)
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      const url = `${getBase()}/admin/projects/import?overwrite=${overwrite ? "true" : "false"}`;
      xhr.open("POST", url);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("网络错误"));
      xhr.send(form);
    });
  }

  async function onSubmit() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadWithProgress();
      toast.success(`上传成功: ${res.slug} (${res.knode_count} knodes)`);
      router.push(`/projects/${res.slug}`);
    } catch (err) {
      toast.error((err as Error).message || "上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">上传项目 tarball</h1>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".tar.gz,.tgz,application/gzip"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {file ? (
            <div className="space-y-1">
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
            </div>
          ) : (
            <div className="space-y-2 text-muted-foreground">
              <div className="text-sm">拖入 .tar.gz 文件, 或点击选择</div>
              <div className="text-xs">期望: content-pipeline export 出的项目包</div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm mt-5">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          <span>已存在同 slug 时覆盖</span>
        </label>

        {progress !== null && (
          <div className="mt-5">
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">{progress}%</div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            onClick={onSubmit}
            disabled={!file || uploading}
            className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "上传中..." : "上传"}
          </button>
          <button
            onClick={() => {
              setFile(null);
              setProgress(null);
            }}
            disabled={uploading}
            className="h-10 px-5 rounded-md border border-border hover:bg-muted text-sm"
          >
            重置
          </button>
        </div>
      </main>
    </>
  );
}
