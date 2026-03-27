"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface IframeStepViewProps {
  html: string
  onComplete?: () => void
  title?: string
  subtitle?: string
}

export function IframeStepView({
  html,
  onComplete,
  title = "互动内容",
  subtitle = "在当前视图中播放或交互",
}: IframeStepViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loadError, setLoadError] = useState(false)
  const [key, setKey] = useState(0)

  // Listen for STEP_COMPLETE message from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "STEP_COMPLETE") {
        onComplete?.()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [onComplete])

  if (!html || html.trim().length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-3 opacity-50" />
        <p className="text-sm">暂无互动内容</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setKey((k) => k + 1)}
          className="gap-1 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          重置
        </Button>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border rounded-lg">
          <AlertTriangle className="h-6 w-6 mb-2 opacity-50" />
          <p className="text-sm">加载失败</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKey((k) => k + 1)}
            className="mt-2 text-xs"
          >
            重试
          </Button>
        </div>
      ) : html.trim().length > 0 ? (
        <iframe
          key={key}
          ref={iframeRef}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          className="w-full rounded-lg border border-border bg-white"
          style={{ height: 520 }}
          onError={() => setLoadError(true)}
          title={title}
        />
      ) : null}
    </div>
  )
}
