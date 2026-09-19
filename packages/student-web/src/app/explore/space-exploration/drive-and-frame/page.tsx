import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "开车找到观察点 · SystemEdu",
  description: "选一个想看的地方，绕过岩石，带回你自己的地形照片。",
}

export default function ProjectExperiencePage() {
  return <iframe src="/project-lines/space-exploration/drive-and-frame/index.html" title="开车找到观察点" style={{ display: "block", width: "100%", height: "100svh", border: 0, background: "#101c27" }} />
}
