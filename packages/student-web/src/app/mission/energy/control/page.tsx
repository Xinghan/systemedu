import { Suspense } from "react"
import { EnergyMissionControl } from "@/components/mission/energy-mission-control"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata={title:"未来能源 · 任务中心 | SystemEdu"}
export default function Page(){return <Suspense fallback={<LoadingSpinner label="正在打开能源任务中心"/>}><EnergyMissionControl/></Suspense>}
