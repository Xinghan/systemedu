"use client"

/**
 * spec 036: knode 学习页 "标记完成" toggle 按钮.
 *
 * - 初次挂载从 /api/my/knodes/{slug}/complete-status 读状态
 * - click → toggle (POST /api/my/knodes/{slug}/{knodeId}/complete action=toggle)
 * - 视觉: 已完成 = coral primary 实心 + 勾, 未完成 = paper-2 边框 + 空心
 */

import { useEffect, useState } from "react"
import { Check, Circle } from "lucide-react"
import { toast } from "sonner"

import { myKnodes } from "@/lib/api"

interface Props {
  slug: string
  knodeId: string
  /** 初始状态 (避免请求, 可选) */
  initialCompleted?: boolean
  onChange?: (completed: boolean) => void
}

export function KnodeCompleteButton({ slug, knodeId, initialCompleted, onChange }: Props) {
  const [completed, setCompleted] = useState<boolean | null>(
    initialCompleted ?? null,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initialCompleted !== undefined) return
    let cancelled = false
    myKnodes
      .getCompleteStatus(slug)
      .then((r) => {
        if (cancelled) return
        setCompleted(r.completed_knode_ids.includes(knodeId))
      })
      .catch(() => {
        if (cancelled) return
        setCompleted(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, knodeId, initialCompleted])

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await myKnodes.toggleComplete(slug, knodeId, "toggle")
      setCompleted(r.completed)
      onChange?.(r.completed)
      toast.success(r.completed ? "已标记完成" : "已撤销完成")
    } catch (e) {
      toast.error("操作失败, 请重试")
    } finally {
      setBusy(false)
    }
  }

  if (completed === null) {
    // 加载中, 显示占位
    return (
      <div className="inline-flex h-9 w-32 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--paper-2)] text-xs text-[var(--sub)]">
        ...
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        completed
          ? "border-[var(--primary-ink)] bg-[var(--primary)] text-white hover:bg-[var(--primary-ink)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:border-[var(--primary)]"
      } ${busy ? "opacity-60 cursor-wait" : ""}`}
    >
      {completed ? (
        <>
          <Check size={16} strokeWidth={2.5} />
          <span>已完成</span>
        </>
      ) : (
        <>
          <Circle size={16} strokeWidth={2} />
          <span>标记完成</span>
        </>
      )}
    </button>
  )
}
