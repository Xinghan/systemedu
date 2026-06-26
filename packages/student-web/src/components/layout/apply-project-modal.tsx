"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { projectRequest } from "@/lib/api"
import { useT } from "@/lib/i18n/use-t"

interface Props {
  open: boolean
  onClose: () => void
}

/** spec 038: 申请项目弹窗 — 单个多行文本框, 提交即走。 */
export function ApplyProjectModal({ open, onClose }: Props) {
  const t = useT()
  const [idea, setIdea] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 打开时自动聚焦 + Esc 关闭
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => textareaRef.current?.focus(), 50)
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, submitting, onClose])

  // 关闭后清空, 下次打开是空白
  useEffect(() => {
    if (!open) setIdea("")
  }, [open])

  if (!open) return null

  async function handleSubmit() {
    const text = idea.trim()
    if (!text) {
      toast.error(t("apply.empty"))
      return
    }
    setSubmitting(true)
    try {
      await projectRequest.submit(text)
      toast.success(t("apply.success"))
      onClose()
    } catch {
      toast.error(t("apply.error"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(25, 24, 20, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "var(--shadow-lg)",
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          {t("apply.title")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--sub)", margin: "8px 0 16px" }}>
          {t("apply.desc")}
        </p>
        <textarea
          ref={textareaRef}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={t("apply.placeholder")}
          rows={6}
          maxLength={5000}
          disabled={submitting}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "12px 14px",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--ink)",
            background: "var(--paper)",
            border: "1px solid var(--border-2)",
            borderRadius: 10,
            boxSizing: "border-box",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn btn-ghost btn-sm"
          >
            {t("apply.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-violet btn-sm"
          >
            {submitting ? t("apply.submitting") : t("apply.submit")}
          </button>
        </div>
      </div>
    </div>
  )
}
