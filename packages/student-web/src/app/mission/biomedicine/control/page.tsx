import { Suspense } from "react"
import { BiomedMissionControl } from "@/components/mission/biomed-mission-control"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata={title:"分子寻药 · 任务中心 | SystemEdu"}
export default function Page(){return <Suspense fallback={<LoadingSpinner label="正在打开研究任务中心"/>}><BiomedMissionControl/></Suspense>}
