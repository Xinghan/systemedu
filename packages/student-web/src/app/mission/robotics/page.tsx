import { Suspense } from "react"
import { RoboticsJourney } from "@/components/mission/robotics-journey"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata={title:"机器人觉醒 · 双臂工程任务 | SystemEdu"}
export default function Page(){return <Suspense fallback={<LoadingSpinner label="正在打开机器人实验室"/>}><RoboticsJourney/></Suspense>}
