import {Suspense} from 'react'
import {notFound} from 'next/navigation'
import {EARTH_COURSES} from '@/lib/project-lines/catalog'
import {loadProjectCourse} from '@/lib/project-lines/load-guided-course'
import {GuidedProjectCourse} from '@/components/learning/guided-project-course'
import {EarthMicroProject} from '@/components/learning/earth-workspace'
import type {EarthId} from '@/lib/project-lines/earth-model'
export default async function EarthPage({params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params, project=EARTH_COURSES.find(p=>p.id===projectId)
  if(!project)notFound()
  if(project.kind==='micro')return <EarthMicroProject id={projectId as EarthId} title={project.title.zh}/>
  const course=await loadProjectCourse('earth-discovery',projectId)
  return <Suspense fallback={<p>正在打开观察课程…</p>}><GuidedProjectCourse course={course}/></Suspense>
}
