"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Package, Pencil } from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/topbar";
import { Card } from "@/components/ui/card";
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
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">统计</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            内容库当前状态.
          </p>
        </div>
        {!stats ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Package className="size-5 text-primary" />}
              label="项目总数"
              value={stats.total_projects}
            />
            <StatCard
              icon={<CheckCircle2 className="size-5 text-primary" />}
              label="已发布"
              value={stats.published_projects}
            />
            <StatCard
              icon={<Pencil className="size-5 text-primary" />}
              label="草稿"
              value={stats.draft_projects}
            />
            <StatCard
              icon={<FileText className="size-5 text-primary" />}
              label="lesson 总数"
              value={stats.total_lessons}
            />
          </div>
        )}
      </main>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="px-5 py-4 gap-2">
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-semibold">{value}</div>
    </Card>
  );
}
