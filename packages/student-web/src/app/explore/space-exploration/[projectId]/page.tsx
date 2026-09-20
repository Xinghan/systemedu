import { Suspense } from "react"
import { notFound } from "next/navigation"
import { GuidedProjectCourse } from "@/components/learning/guided-project-course"
import { loadSpaceCourse } from "@/lib/project-lines/load-guided-course"
import { SPACE_IDS } from "@/lib/project-lines/space-models"

export default async function SpaceCoursePage({params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params
  if(!(SPACE_IDS as readonly string[]).includes(projectId))notFound()
  const course=await loadSpaceCourse(projectId)
  return <Suspense fallback={<p>正在载入课程…</p>}><GuidedProjectCourse course={course}/></Suspense>
}
