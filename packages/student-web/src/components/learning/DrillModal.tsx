"use client"

/**
 * 知识钻取弹窗 (spec 2026-06-09)。
 * 两种用法:
 *  - 新钻取: 传 {librarySlug, moduleId, highlightText} → POST 生成/复用 → 展示。
 *  - 回访: 传 {record} → 直接展示已存 content (不请求)。
 * 纯展示 + 关闭 (MVP A1)。
 */

import { useEffect, useState } from "react"
import { X, Sparkles } from "lucide-react"

import { knowledgeDrill, type DrillContent, type DrillRecord } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  librarySlug: string
  moduleId: string
  highlightText?: string   // 新钻取时传
  record?: DrillRecord     // 回访时传 (优先)
}

export function DrillModal({ open, onClose, librarySlug, moduleId, highlightText, record }: Props) {
  const [content, setContent] = useState<DrillContent | null>(record?.content ?? null)
  const [title, setTitle] = useState<string>(record?.highlight_text ?? highlightText ?? "")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!open) return
    if (record) { setContent(record.content); setTitle(record.highlight_text); return }
    if (!highlightText) return
    let cancelled = false
    setLoading(true); setErr(false); setContent(null); setTitle(highlightText)
    knowledgeDrill.create(librarySlug, moduleId, highlightText)
      .then((r) => { if (!cancelled) { setContent(r.content); setTitle(r.highlight_text) } })
      .catch(() => { if (!cancelled) setErr(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, record, highlightText, librarySlug, moduleId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
            <Sparkles size={18} className="text-[var(--primary)]" /> 知识钻取
          </h3>
          <button type="button" onClick={onClose} className="text-[var(--sub)] hover:text-[var(--ink)]">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 rounded-lg bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--sub)]">
          "{title}"
        </p>

        {loading && <p className="py-8 text-center text-sm text-[var(--sub)]">正在为你钻取这个知识点...</p>}
        {err && <p className="py-8 text-center text-sm text-red-500">钻取失败, 请重试</p>}
        {content && (
          <div className="space-y-5 text-[var(--ink)]">
            <Section label="这是什么">{content.simple_explanation}</Section>
            <Section label="为什么重要">{content.why_matters}</Section>
            <Section label="打个比方">{content.analogy}</Section>
            {content.key_points?.length > 0 && (
              <div>
                <div className="mb-1.5 text-sm font-semibold text-[var(--primary)]">关键点</div>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {content.key_points.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}
            <Section label="想更深一点">{content.go_deeper}</Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold text-[var(--primary)]">{label}</div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  )
}
