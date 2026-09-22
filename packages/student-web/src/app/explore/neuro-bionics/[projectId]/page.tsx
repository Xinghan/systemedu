import {Suspense} from 'react'
import {notFound} from 'next/navigation'
import {BIONICS_COURSES} from '@/lib/project-lines/catalog'
import {loadProjectCourse} from '@/lib/project-lines/load-guided-course'
import {GuidedProjectCourse} from '@/components/learning/guided-project-course'
import {BionicsMicroProject} from '@/components/learning/bionics-workspace'
export default async function BionicsPage({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params,project=BIONICS_COURSES.find(p=>p.id===projectId);if(!project)notFound();if(project.kind==='micro')return <BionicsMicroProject id={projectId} title={project.title.zh}/>;const course=await loadProjectCourse('neuro-bionics',projectId);return <Suspense fallback={<p>正在打开课程…</p>}><GuidedProjectCourse course={course}/></Suspense>}
