import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "把探测器稳稳送下去 · SystemEdu",
  description: "先试着落地。再改变制动时机，看看这次有什么不同。",
}

export default function ProjectExperiencePage() {
  return <iframe src="/project-lines/space-exploration/land-a-probe/index.html" title="把探测器稳稳送下去" style={{ display: "block", width: "100%", height: "100svh", border: 0, background: "#101c27" }} />
}
