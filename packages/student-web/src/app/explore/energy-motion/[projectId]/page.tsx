import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { notFound } from 'next/navigation'
import legacyEnergyCourses from '@/lib/project-lines/energy-courses.json'
import { EnergyMicroProject } from '@/components/learning/energy-workspace'
import { ENERGY_COURSES } from '@/lib/project-lines/catalog'
import { loadProjectCourse } from '@/lib/project-lines/load-guided-course'
import { GuidedProjectCourse } from '@/components/learning/guided-project-course'
import { RenewableMicroProject } from '@/components/learning/renewable-workspace'

export default async function EnergyPage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,project=ENERGY_COURSES.find(p=>p.id===projectId)||legacyEnergyCourses.find(p=>p.id===projectId)
  if(!project)notFound()
  if(project.kind==='micro')return <Suspense fallback={<LoadingSpinner label="正在打开能源实验"/>}>{legacyEnergyCourses.some(p=>p.id===projectId)?<EnergyMicroProject id={projectId} title={project.title.zh}/>:<RenewableMicroProject id={projectId} title={project.title.zh}/>}</Suspense>
  const course=await loadProjectCourse('energy-motion',projectId)
  return <Suspense fallback={<LoadingSpinner label="正在打开课程"/>}><GuidedProjectCourse course={course}/></Suspense>
}
