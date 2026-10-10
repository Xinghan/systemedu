import { Suspense } from "react"
import { BiomedJourney } from "@/components/mission/biomed-journey"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata={title:"分子寻药 · 候选分子研究任务 | SystemEdu",description:"沿八个研究现场，从第一条分子观察到可复跑的候选研究档案。"}
export default function Page(){return <Suspense fallback={<LoadingSpinner label="正在打开分子发现基地"/>}><BiomedJourney/></Suspense>}
