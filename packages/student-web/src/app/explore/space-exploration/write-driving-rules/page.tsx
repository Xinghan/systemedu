import type { Metadata } from "next"
import { Suspense } from "react"
import { GuidedProjectCourse } from "@/components/learning/guided-project-course"
import { loadDrivingCourse } from "@/lib/project-lines/load-guided-course"

export const metadata: Metadata = {
  title: "写出我的第一段驾驶规则 · SystemEdu",
  description: "四个学习节点：认识地形与动作、条件规则、对照测试、未知处理。配套学习正文、参考资料、视频与驾驶实验。",
}

export default async function GuidedCoursePage() {
  const course = await loadDrivingCourse()
  return <Suspense fallback={<p>正在载入课程…</p>}><GuidedProjectCourse course={course} /></Suspense>
}
