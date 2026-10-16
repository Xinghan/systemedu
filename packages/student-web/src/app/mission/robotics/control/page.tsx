import { Suspense } from "react"
import { RoboticsMissionControl } from "@/components/mission/robotics-mission-control"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
export const metadata={title:"机器人觉醒 · 任务中心 | SystemEdu"}
export default function Page(){return <Suspense fallback={<LoadingSpinner label="正在打开机器人实验室"/>}><RoboticsMissionControl/></Suspense>}
