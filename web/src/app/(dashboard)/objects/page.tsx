"use client"

import { useEffect, useState } from "react"
import { gateway } from "@/lib/api"
import type { ObjectRegistryItem, ObjectStagingItem } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

function RegistryCard({ item }: { item: ObjectRegistryItem }) {
  const [open, setOpen] = useState(false)
  const t = useT()
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
            {(t as (key: string) => string)(`objects.family.${item.family}`) || item.family} / {item.variant}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium">
          {t("objects.registered_badge")}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/20 text-sm space-y-2">
          <div>
            <span className="text-xs text-muted-foreground font-medium">{t("objects.views")}</span>
            <span className="ml-1">{item.views.join(", ") || "-"}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">{t("objects.must_have")}</span>
            <span className="ml-1 font-mono text-xs">{item.must_have.join(", ") || "-"}</span>
          </div>
          {item.optional.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t("objects.optional")}</span>
              <span className="ml-1 font-mono text-xs">{item.optional.join(", ")}</span>
            </div>
          )}
          {item.labelable.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">{t("objects.labelable")}</span>
              <span className="ml-1 font-mono text-xs">{item.labelable.join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StagingCard({ item }: { item: ObjectStagingItem }) {
  const t = useT()
  const statusKeyMap: Record<string, string> = {
    pending: t("objects.pending"),
    in_progress: t("objects.in_progress"),
    done: t("objects.done"),
    failed: t("objects.failed"),
  }
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
        {statusKeyMap[item.status] ?? item.status}
      </span>
    </div>
  )
}

export default function ObjectsPage() {
  const [registry, setRegistry] = useState<ObjectRegistryItem[]>([])
  const [staging, setStaging] = useState<ObjectStagingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const t = useT()

  useEffect(() => {
    gateway.objectRegistry().then((data) => {
      setRegistry(data.registry)
      setStaging(data.staging)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const lc = filter.toLowerCase()
  const filteredRegistry = registry.filter(
    (i) => !lc || i.object_key.includes(lc) || ((t as (key: string) => string)(`objects.family.${i.family}`) ?? "").includes(lc)
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("objects.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("objects.registered_count", { n: registry.length, q: staging.length })}
        </p>
      </div>
      <input
        type="text"
        placeholder={t("objects.search")}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />

      {loading && (
        <p className="text-muted-foreground text-sm">{t("objects.loading")}</p>
      )}

      {/* Registry section */}
      {!loading && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("objects.registered")} ({filteredRegistry.length})
          </h2>
          {Object.keys(families).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("objects.no_results")}</p>
          )}
          {Object.entries(families).map(([family, items]) => (
            <div key={family} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground px-1">
                {(t as (key: string) => string)(`objects.family.${family}`) || family}({items.length})
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
            {t("objects.queue")} ({filteredStaging.length})
          </h2>
          {filteredStaging.map((item) => (
            <StagingCard key={`${item.object_key}-${item.created_at}`} item={item} />
          ))}
        </section>
      )}
    </div>
  )
}
