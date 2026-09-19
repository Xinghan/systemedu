import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "写出我的第一段驾驶规则 · SystemEdu",
  description: "先看车在哪里卡住，再改一条规则。换一条路，检验你的想法。",
}

export default function ProjectExperiencePage() {
  return <iframe src="/project-lines/space-exploration/write-driving-rules/index.html" title="写出我的第一段驾驶规则" style={{ display: "block", width: "100%", height: "100svh", border: 0, background: "#101c27" }} />
}
