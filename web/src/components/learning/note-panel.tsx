"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { gateway } from "@/lib/api"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })
const MDPreview = dynamic(() => import("@uiw/react-md-editor").then((m) => m.default.Markdown), { ssr: false })

export type NotePreviewMode = "edit" | "preview"

interface NotePanelProps {
  projectName: string
  nodeId: number
  previewMode?: NotePreviewMode
  onStatusChange?: (status: "idle" | "saving" | "saved") => void
}

export function NotePanel({ projectName, nodeId, previewMode = "edit", onStatusChange }: NotePanelProps) {
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  useEffect(() => {
    initialLoad.current = true
    setLoading(true)
    onStatusChange?.("idle")
    gateway
      .getNote(projectName, nodeId)
      .then((note) => setContent(note.content))
      .catch(() => setContent(""))
      .finally(() => setLoading(false))
  }, [projectName, nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (val: string | undefined) => {
    const newContent = val ?? ""
    setContent(newContent)

    if (initialLoad.current) {
      initialLoad.current = false
      return
    }

    onStatusChange?.("saving")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      gateway
        .upsertNote(projectName, nodeId, newContent)
        .then(() => onStatusChange?.("saved"))
        .catch(() => onStatusChange?.("idle"))
    }, 1500)
  }

  const colorMode =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (previewMode === "preview") {
    return (
      <div className="h-full overflow-y-auto px-4 py-3" data-color-mode={colorMode}>
        {content.trim() ? (
          <MDPreview source={content} />
        ) : (
          <p className="text-xs text-muted-foreground">暂无笔记内容</p>
        )}
      </div>
    )
  }

  return (
    <div className="h-full" data-color-mode={colorMode}>
      <MDEditor
        value={content}
        onChange={handleChange}
        height="100%"
        preview="edit"
        hideToolbar={false}
      />
    </div>
  )
}
