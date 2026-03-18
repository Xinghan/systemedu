import { LoadingSpinner } from "./loading-spinner"

interface PageLoadingProps {
  label?: string
}

export function PageLoading({ label = "加载中" }: PageLoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] animate-[loading-fade-in_0.3s_ease-out]">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}
