import type { Metadata } from "next"
import { MechanicalHandViewer } from "@/components/learning/mechanical-hand/viewer"

export const metadata: Metadata = { title: "五指机械手 · 结构与传动 | SystemEdu", description: "旋转原创 Blender 机械手，控制五指，观察关节、牵引绳与几何接触限位。" }
export default function MechanicalHandPage() { return <MechanicalHandViewer/> }
