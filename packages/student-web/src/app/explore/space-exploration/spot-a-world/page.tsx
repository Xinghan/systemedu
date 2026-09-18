import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "我的第一张星球照片 · SystemEdu",
  description: "移动虚拟望远镜，选择月球或火星，拍下并保存自己的第一张星球照片。",
}

export default function SpotAWorldPage() {
  return (
    <iframe
      src="/project-lines/space-exploration/spot-a-world/index.html"
      title="我的第一张星球照片：可操作的虚拟望远镜"
      style={{ display: "block", width: "100%", height: "100svh", border: 0, background: "#101b27" }}
    />
  )
}
