import { Suspense } from "react"
import type { Metadata } from "next"
import { SpaceJourney } from "@/components/mission/space-journey"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata: Metadata = { title:"星际远航 · 我的火星探测任务 | SystemEdu", description:"沿着八个任务站，从3分钟观察到设计、打印、训练视觉与实地远征，让同一辆探测车持续升级。" }
export default function SpaceJourneyPage() {
  return <Suspense fallback={<div style={{minHeight:"100svh",display:"grid",placeItems:"center"}}><LoadingSpinner label="正在打开星际远航任务中心" /></div>}><SpaceJourney /></Suspense>
}
