import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { GuidedProjectCourse } from '@/components/learning/guided-project-course'
import { BiomedMicroProject } from '@/components/learning/biomed-micro-project'
import { BIOMED_COURSES } from '@/lib/project-lines/catalog'
import { loadProjectCourse } from '@/lib/project-lines/load-guided-course'

export default async function BiomedProjectPage({params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params
  if(!BIOMED_COURSES.some(p=>p.id===projectId))notFound()
  if(projectId==='turn-a-molecule'||projectId==='sort-molecule-cards')return <BiomedMicroProject id={projectId}/>
  const course=await loadProjectCourse('biomedicine',projectId)
  return <Suspense fallback={<p>正在打开课程…</p>}><GuidedProjectCourse course={course}/></Suspense>
}
