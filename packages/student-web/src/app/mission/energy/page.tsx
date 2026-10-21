import { Suspense } from "react"
import { EnergyJourney } from "@/components/mission/energy-journey"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata={title:"未来能源 · 能源工程任务 | SystemEdu",description:"沿八个实验室，从第一束光到实物能源站与可复查的功率预报。"}
export default function Page(){return <Suspense fallback={<LoadingSpinner label="正在打开能源工程实验室"/>}><EnergyJourney/></Suspense>}
