"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { gateway } from "@/lib/api"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

interface NotePanelProps {
  projectName: string
  nodeId: number
}

export function NotePanel({ projectName, nodeId }: NotePanelProps) {
  const [content, setContent] = useState<string>("")
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  useEffect(() => {
    initialLoad.current = true
    setLoading(true)
    gateway
      .getNote(projectName, nodeId)
      .then((note) => {
        setContent(note.content)
      })
      .catch(() => {
        setContent("")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [projectName, nodeId])

  const handleChange = (val: string | undefined) => {
    const newContent = val ?? ""
    setContent(newContent)

    if (initialLoad.current) {
      initialLoad.current = false
      return
    }

    setStatus("saving")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      gateway
        .upsertNote(projectName, nodeId, newContent)
        .then(() => setStatus("saved"))
        .catch(() => setStatus("idle"))
    }, 1500)
  }

  const colorMode =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 h-full" data-color-mode={colorMode}>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          支持 Markdown 格式，自动保存
        </span>
        {status === "saving" && (
          <span className="text-xs text-muted-foreground">保存中...</span>
        )}
        {status === "saved" && (
          <span className="text-xs text-green-600 dark:text-green-400">已保存</span>
        )}
      </div>
      <MDEditor
        value={content}
        onChange={handleChange}
        height={360}
        preview="edit"
      />
    </div>
  )
}
