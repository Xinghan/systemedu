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
import { useT } from "@/lib/i18n/use-t"

interface Props {
  slug: string
  knodeId: string
  /** 初始状态 (避免请求, 可选) */
  initialCompleted?: boolean
  onChange?: (completed: boolean) => void
}

export function KnodeCompleteButton({ slug, knodeId, initialCompleted, onChange }: Props) {
  const t = useT()
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
      toast.success(r.completed ? t("knode.mark_completed") : t("knode.mark_uncompleted"))
    } catch (e) {
      toast.error(t("knode.action_failed"))
    } finally {
      setBusy(false)
    }
  }

  if (completed === null) {
    // 加载中, 占位与 .btn-sm 同尺寸, 保持头部控件对齐
    return (
      <span className="btn btn-ghost btn-sm" style={{ opacity: 0.6 }}>
        ...
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      // 复用 .btn .btn-sm 体系, 与同排 Tree / 翻页按钮同高同圆角;
      // completed 用 coral 实心, 未完成用 ghost (与 Tree 一致)。
      className={`btn btn-sm ${completed ? "" : "btn-ghost"} ${
        busy ? "cursor-wait" : ""
      }`}
      style={{
        ...(completed
          ? {
              background: "var(--primary)",
              color: "#fff",
              borderColor: "var(--primary-ink)",
            }
          : {}),
        ...(busy ? { opacity: 0.6 } : {}),
      }}
    >
      {completed ? (
        <>
          <Check size={14} strokeWidth={2.5} />
          <span>{t("knode.completed")}</span>
        </>
      ) : (
        <>
          <Circle size={14} strokeWidth={2} />
          <span>{t("knode.mark_complete")}</span>
        </>
      )}
    </button>
  )
}
