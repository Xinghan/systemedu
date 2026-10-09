import { SpaceMicroMission } from "@/components/mission/space-journey-links"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "我的第一张星球照片 · SystemEdu",
  description: "移动虚拟望远镜，选择月球或火星，拍下并保存自己的第一张星球照片。",
}

export default function ProjectExperiencePage() {
  return <SpaceMicroMission projectId="spot-a-world" title="我的第一张星球照片：可操作的虚拟望远镜" />
}
