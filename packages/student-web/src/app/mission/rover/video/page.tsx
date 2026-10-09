import type { Metadata } from "next"
import { RoverVideoSample } from "@/components/mission/rover-video-sample"

export const metadata: Metadata = {
  title: "林岚 · 开场视频样片 | SystemEdu",
  robots: { index: false, follow: false },
}

export default function RoverVideoPage() { return <RoverVideoSample /> }
