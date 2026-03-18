import { LoadingSpinner } from "./loading-spinner"

interface PageLoadingProps {
  label?: string
}

export function PageLoading({ label = "加载中" }: PageLoadingProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}
