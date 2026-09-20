import { Suspense } from "react"
import { notFound } from "next/navigation"
import { GuidedProjectCourse } from "@/components/learning/guided-project-course"
import { loadSpaceCourse } from "@/lib/project-lines/load-guided-course"
import { SPACE_IDS } from "@/lib/project-lines/space-models"

export default async function SpaceCoursePage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{edition?:string}>}) {
  const {projectId}=await params
  if(!(SPACE_IDS as readonly string[]).includes(projectId))notFound()
  const course=await loadSpaceCourse(projectId,(await searchParams).edition==='1')
  return <Suspense fallback={<p>正在载入课程…</p>}><GuidedProjectCourse course={course}/></Suspense>
}
