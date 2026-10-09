import { SpaceMicroMission } from "@/components/mission/space-journey-links"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "开车找到观察点 · SystemEdu",
  description: "选一个想看的地方，绕过岩石，带回你自己的地形照片。",
}

export default function ProjectExperiencePage() {
  return <SpaceMicroMission projectId="drive-and-frame" title="开车找到观察点" />
}
