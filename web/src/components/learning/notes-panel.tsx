"use client"

import { useEffect, useState, useCallback } from "react"
import { Highlighter, MessageSquare, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { gateway } from "@/lib/api"
import type { HighlightInfo } from "@/lib/types/api"

const TAB_LABELS: Record<string, string> = {
  concept: "概念",
  examples: "示例",
  code_samples: "代码",
  practice: "练习",
  key_takeaways: "总结",
}

interface NotesPanelProps {
  projectName: string
  nodeId: number | null
}

export function NotesPanel({ projectName, nodeId }: NotesPanelProps) {
  const [highlights, setHighlights] = useState<HighlightInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (nodeId == null) {
      setHighlights([])
      return
    }
    setLoading(true)
    gateway
      .getHighlights(projectName, nodeId)
      .then(setHighlights)
      .catch(() => setHighlights([]))
      .finally(() => setLoading(false))
  }, [projectName, nodeId])

  const handleDelete = useCallback(
    (id: number) => {
      if (nodeId == null) return
      gateway.deleteHighlight(projectName, nodeId, id).then(() => {
        setHighlights((prev) => prev.filter((h) => h.id !== id))
      }).catch(() => {})
    },
    [projectName, nodeId],
  )

  if (nodeId == null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6">
        <Highlighter className="h-12 w-12 opacity-30" />
        <p className="text-sm">选择知识节点查看笔记</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
        <p className="text-sm">加载中...</p>
      </div>
    )
  }

  if (highlights.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6">
        <Highlighter className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">暂无笔记</p>
          <p className="text-xs mt-1">在学习页面选中文字，点击"高亮"或"批注"</p>
        </div>
      </div>
    )
  }

  // Group by tab
  const grouped = new Map<string, HighlightInfo[]>()
  for (const h of highlights) {
    const list = grouped.get(h.tab) ?? []
    list.push(h)
    grouped.set(h.tab, list)
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {highlights.length} 条笔记
          </span>
        </div>

        {Array.from(grouped.entries()).map(([tab, items]) => (
          <div key={tab}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {TAB_LABELS[tab] ?? tab}
            </h4>
            <div className="space-y-2">
              {items.map((h) => (
                <div
                  key={h.id}
                  className="group rounded-lg border bg-card p-2.5 text-sm space-y-1.5"
                >
                  {/* Highlighted text */}
                  <div className="flex items-start gap-2">
                    <Highlighter className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                    <span className="bg-yellow-200/60 dark:bg-yellow-500/30 rounded px-1 py-0.5 text-xs leading-relaxed line-clamp-3">
                      {h.text}
                    </span>
                  </div>

                  {/* Note / comment */}
                  {h.note && (
                    <div className="flex items-start gap-2 pl-5">
                      <MessageSquare className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {h.note}
                      </span>
                    </div>
                  )}

                  {/* Meta + actions */}
                  <div className="flex items-center justify-between pl-5">
                    <span className="text-[10px] text-muted-foreground/60">
                      第 {h.page_index + 1} 页
                    </span>
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
