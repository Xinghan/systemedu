import { Suspense } from "react"
import type { Metadata } from "next"
import { SpaceJourney } from "@/components/mission/space-journey"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata: Metadata = { title:"星际远航 · 从第一件作品到完整工程 | SystemEdu", description:"沿着任务地图，从3分钟观察体验，到制作方法、建造探测车、实地远征与行星研究。" }
export default function SpaceJourneyPage() {
  return <Suspense fallback={<div style={{minHeight:"100svh",display:"grid",placeItems:"center"}}><LoadingSpinner label="正在打开星际远航任务中心" /></div>}><SpaceJourney /></Suspense>
}
