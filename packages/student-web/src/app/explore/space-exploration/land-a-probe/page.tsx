import { SpaceMicroMission } from "@/components/mission/space-journey-links"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "把探测器稳稳送下去 · SystemEdu",
  description: "先试着落地。再改变制动时机，看看这次有什么不同。",
}

export default function ProjectExperiencePage() {
  return <SpaceMicroMission projectId="land-a-probe" title="把探测器稳稳送下去" />
}
