import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ENERGY_COURSES } from '@/lib/project-lines/catalog'
import { loadProjectCourse } from '@/lib/project-lines/load-guided-course'
import { GuidedProjectCourse } from '@/components/learning/guided-project-course'
import { RenewableMicroProject } from '@/components/learning/renewable-workspace'

export default async function EnergyPage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,project=ENERGY_COURSES.find(p=>p.id===projectId)
  if(!project)notFound()
  if(project.kind==='micro')return <RenewableMicroProject id={projectId} title={project.title.zh}/>
  const course=await loadProjectCourse('energy-motion',projectId)
  return <Suspense fallback={<p>正在打开课程…</p>}><GuidedProjectCourse course={course}/></Suspense>
}
