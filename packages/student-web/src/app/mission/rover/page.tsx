import type { Metadata } from "next"
import { RoverOpening } from "@/components/mission/rover-opening"

export const metadata: Metadata = {
  title: "晨光号 · 你的第一份火星任务 | SystemEdu",
  description: "坐进任务控制席，与工程师一起观察、规划，让探测车带回第一张岩层照片。",
  robots: { index: false, follow: false },
}
export default function RoverMissionPage() { return <RoverOpening /> }
