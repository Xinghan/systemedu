import type { Metadata } from "next"
import { MarsLandingViewer } from "@/components/learning/mars-landing/viewer"

export const metadata: Metadata = {
  title: "火星着陆 · 从空中到六轮着地 | SystemEdu",
  description: "旋转、暂停和回看原创三维模型，理解毅力号降落伞减速、动力下降、缆绳放车和触地飞离的过程。",
}
export default function MarsLandingPage() { return <MarsLandingViewer/> }
