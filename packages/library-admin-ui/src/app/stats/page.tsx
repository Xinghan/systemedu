"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { api, type Stats } from "@/lib/library-admin-api";

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((err) => toast.error((err as Error).message || "加载失败"));
  }, []);

  return (
    <>
      <TopBar />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">统计</h1>
        {!stats ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="项目总数" value={stats.total_projects} />
            <Card label="已发布" value={stats.published_projects} />
            <Card label="草稿" value={stats.draft_projects} />
            <Card label="lesson 总数" value={stats.total_lessons} />
          </div>
        )}
      </main>
    </>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-md bg-card px-5 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
