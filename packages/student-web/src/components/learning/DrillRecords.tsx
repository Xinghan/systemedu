"use client"

/**
 * 本节钻取记录回访列表 (spec 2026-06-09)。
 * 进 knode 拉 knowledgeDrill.list; 无记录返回 null;
 * 否则折叠区 "本节钻取记录 (N)", 点某条 → DrillModal record 模式展示。
 */

import { useEffect, useState } from "react"
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react"

import { knowledgeDrill, type DrillRecord } from "@/lib/api"
import { DrillModal } from "./DrillModal"

interface Props {
  librarySlug: string
  moduleId: string
}

export function DrillRecords({ librarySlug, moduleId }: Props) {
  const [records, setRecords] = useState<DrillRecord[]>([])
  const [expanded, setExpanded] = useState(false)
  const [active, setActive] = useState<DrillRecord | null>(null)

  useEffect(() => {
    if (!librarySlug || !moduleId) return
    let cancelled = false
    knowledgeDrill
      .list(librarySlug, moduleId)
      .then((r) => { if (!cancelled) setRecords(r.drills ?? []) })
      .catch(() => { if (!cancelled) setRecords([]) })
    return () => { cancelled = true }
  }, [librarySlug, moduleId])

  if (records.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--ink)]"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <BookOpen size={15} className="text-[var(--primary)]" />
        本节钻取记录 ({records.length})
      </button>
      {expanded && (
        <ul className="border-t border-[var(--border)] px-2 py-2">
          {records.map((rec) => (
            <li key={rec.id}>
              <button
                type="button"
                onClick={() => setActive(rec)}
                className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-[var(--sub)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              >
                {rec.highlight_text}
              </button>
            </li>
          ))}
        </ul>
      )}

      <DrillModal
        open={!!active}
        onClose={() => setActive(null)}
        librarySlug={librarySlug}
        moduleId={moduleId}
        record={active ?? undefined}
      />
    </div>
  )
}
