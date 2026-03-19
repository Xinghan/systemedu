"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-xl font-semibold">应用出错了</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {error.message || "发生了未知错误，请刷新页面重试"}
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  )
}
