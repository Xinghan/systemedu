import { Suspense } from "react"
import type { Metadata } from "next"
import { SpaceMissionControl } from "@/components/mission/space-mission-control"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata: Metadata = { title:"星际远航 · 任务中心 | SystemEdu", description:"管理远征子任务、工程证据、实际工作时间与阶段计划，从第一份观察到探测车交付。" }
export default function MissionControlPage() {
  return <Suspense fallback={<div style={{minHeight:"100svh",display:"grid",placeItems:"center"}}><LoadingSpinner label="正在打开任务中心"/></div>}><SpaceMissionControl/></Suspense>
}
