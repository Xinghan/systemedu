"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InteractiveLabViewProps {
  html: string
}

const IFRAME_HEIGHT = 600

export function InteractiveLabView({ html }: InteractiveLabViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!html || html.trim().length === 0) {
      setBlobUrl(null)
      return
    }

    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    setLoadError(false)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [html, key])

  if (!html || html.trim().length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-3 opacity-50" />
        <p className="text-sm">暂无交互实验内容</p>
        <p className="text-xs mt-1 opacity-70">重新生成课程内容以获取实验</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">互动游戏</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            动手操作，边玩边学
          </p>
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
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg">
          <AlertTriangle className="h-6 w-6 mb-2 text-yellow-500" />
          <p className="text-sm">实验加载失败</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setLoadError(false)
              setKey((k) => k + 1)
            }}
          >
            重试
          </Button>
        </div>
      ) : blobUrl ? (
        <div className="border rounded-lg overflow-hidden bg-white">
          <iframe
            ref={iframeRef}
            key={key}
            src={blobUrl}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ height: `${IFRAME_HEIGHT}px` }}
            title="互动游戏"
            onError={() => setLoadError(true)}
          />
        </div>
      ) : null}
    </div>
  )
}
