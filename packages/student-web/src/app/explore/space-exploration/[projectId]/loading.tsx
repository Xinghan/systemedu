import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function CourseLoading() {
  return <div style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
    <LoadingSpinner size="lg" label="正在进入任务课程…" />
  </div>
}
