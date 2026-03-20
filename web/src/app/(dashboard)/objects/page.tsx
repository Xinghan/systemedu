"use client"

import { useEffect, useState } from "react"
import { gateway } from "@/lib/api"
import type { ObjectRegistryItem, ObjectStagingItem } from "@/lib/types/api"

const STATUS_LABEL: Record<string, string> = {
  pending: "等待中",
  in_progress: "创建中",
  done: "已完成",
  failed: "失败",
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const FAMILY_LABELS: Record<string, string> = {
  rocket: "火箭",
  cell: "细胞",
  atom: "原子",
  plant: "植物",
  human_body: "人体",
  earth: "地球",
  aircraft: "飞机",
  submarine: "潜水艇",
  robot: "机器人",
}

function RegistryCard({ item }: { item: ObjectRegistryItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded">
            {item.object_key}
          </span>
          <span className="text-sm text-muted-foreground">
            {FAMILY_LABELS[item.family] ?? item.family} / {item.variant}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium">
          已注册
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/20 text-sm space-y-2">
          <div>
            <span className="text-xs text-muted-foreground font-medium">视图：</span>
            <span className="ml-1">{item.views.join(", ") || "-"}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">必要部件：</span>
            <span className="ml-1 font-mono text-xs">{item.must_have.join(", ") || "-"}</span>
          </div>
          {item.optional.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">可选部件：</span>
              <span className="ml-1 font-mono text-xs">{item.optional.join(", ")}</span>
            </div>
          )}
          {item.labelable.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">可标注：</span>
              <span className="ml-1 font-mono text-xs">{item.labelable.join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StagingCard({ item }: { item: ObjectStagingItem }) {
  return (
    <div className="border rounded-lg bg-card px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded shrink-0">
          {item.object_key}
        </span>
        {item.project_name && (
          <span className="text-xs text-muted-foreground truncate">
            {item.project_name}
          </span>
        )}
        {item.error && (
          <span className="text-xs text-red-500 truncate" title={item.error}>
            {item.error}
          </span>
        )}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${STATUS_COLOR[item.status] ?? ""}`}>
        {STATUS_LABEL[item.status] ?? item.status}
      </span>
    </div>
  )
}

export default function ObjectsPage() {
  const [registry, setRegistry] = useState<ObjectRegistryItem[]>([])
  const [staging, setStaging] = useState<ObjectStagingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    gateway.objectRegistry().then((data) => {
      setRegistry(data.registry)
      setStaging(data.staging)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const lc = filter.toLowerCase()
  const filteredRegistry = registry.filter(
    (i) => !lc || i.object_key.includes(lc) || (FAMILY_LABELS[i.family] ?? "").includes(lc)
  )
  const filteredStaging = staging.filter(
    (i) => !lc || i.object_key.includes(lc)
  )

  // Group registry by family
  const families: Record<string, ObjectRegistryItem[]> = {}
  for (const item of filteredRegistry) {
    if (!families[item.family]) families[item.family] = []
    families[item.family].push(item)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Object 库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            已注册 {registry.length} 个 object，队列中 {staging.length} 个
          </p>
        </div>
        <input
          type="text"
          placeholder="搜索..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background w-48 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">加载中...</p>
      )}

      {/* Registry section */}
      {!loading && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            已注册 ({filteredRegistry.length})
          </h2>
          {Object.keys(families).length === 0 && (
            <p className="text-sm text-muted-foreground">无匹配结果</p>
          )}
          {Object.entries(families).map(([family, items]) => (
            <div key={family} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground px-1">
                {FAMILY_LABELS[family] ?? family}（{items.length}）
              </h3>
              {items.map((item) => (
                <RegistryCard key={item.object_key} item={item} />
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Staging / factory queue section */}
      {!loading && filteredStaging.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            创建队列 ({filteredStaging.length})
          </h2>
          {filteredStaging.map((item) => (
            <StagingCard key={`${item.object_key}-${item.created_at}`} item={item} />
          ))}
        </section>
      )}
    </div>
  )
}
