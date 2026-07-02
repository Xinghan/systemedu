import { LoadingSpinner } from "./loading-spinner"

interface PageLoadingProps {
  label?: string
}

/** 整页级 loading — 路由/首次加载时撑满视口居中展示。 */
export function PageLoading({ label }: PageLoadingProps) {
  return (
    <div
      className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]"
      style={{ animation: "loading-fade-in 0.3s ease-out" }}
    >
      <LoadingSpinner size="lg" label={label} />
      <style jsx>{`
        @keyframes loading-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/** 局部区块 loading — 卡片网格/弹窗/侧栏等非整页场景, 只做内容区居中替换。 */
export function InlineLoading({ label, padding = 56 }: PageLoadingProps & { padding?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ padding, animation: "loading-fade-in 0.25s ease-out" }}
    >
      <LoadingSpinner size="md" label={label} />
      <style jsx>{`
        @keyframes loading-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
