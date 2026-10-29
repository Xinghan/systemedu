import { Suspense } from "react"
import type { Metadata } from "next"
import { SpaceJourney } from "@/components/mission/space-journey"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata: Metadata = { title:"星际远航 · 探测车与凌星调查 | SystemEdu", description:"沿任务地图开展火星地形观察远征或真实光变数据调查，从观察、验证到可复查的工程与研究档案。" }
export default function SpaceJourneyPage() {
  return <Suspense fallback={<div style={{minHeight:"100svh",display:"grid",placeItems:"center"}}><LoadingSpinner label="正在打开星际远航任务中心" /></div>}><SpaceJourney /></Suspense>
}
