import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RenewableWorkspace } from '../../student-web/src/components/learning/renewable-workspace'
import { EnergyWorkspace } from '../../student-web/src/components/learning/energy-workspace'
import { BionicsCourseWorkspace } from '../../student-web/src/components/learning/bionics-workspace'
import { EarthCourseWorkspace } from '../../student-web/src/components/learning/earth-workspace'
import { BiomedProjectWorkspace } from '../../student-web/src/components/learning/biomed-project-workspace'
import { BiomedMicroProject } from '../../student-web/src/components/learning/biomed-micro-project'
import { SpaceProjectWorkspace } from '../../student-web/src/components/learning/space-project-workspace'
import { RoverSystemWorkspace } from '../../student-web/src/components/learning/rover-system-workspace'
import { ExpeditionSystemWorkspace } from '../../student-web/src/components/learning/expedition-system-workspace'
import { TransformerModelExplorer } from '../../student-web/src/app/standalone/transformer-lab/model-explorer'
import { TechnicalVisual } from '../../student-web/src/components/learning/technical-visual'
import { AlgorithmLab } from '../../student-web/src/app/standalone/post-training/algorithm-lab'
import './phone.css'

function PostTrainingExperiment() {
 const algorithm = new URLSearchParams(location.search).get('algorithm') ?? 'lora'
 const key = `ios:post-training:${algorithm}`
 const [state, setState] = useState(() => JSON.parse(localStorage.getItem(key) ?? '{"values":{},"step":0}'))
 return <AlgorithmLab id={algorithm} state={state} update={next => { setState(next); localStorage.setItem(key, JSON.stringify(next)) }}/>
}
const params = new URLSearchParams(location.search)
const id = params.get('project') ?? '', family = params.get('family'), node = { module_id: params.get('node') ?? 'M01' } as any
const course = { id: id.replace('-legacy-v1', ''), version: params.get('version') ?? '1.0', modules: [], title: id } as any
const micro = params.get('micro') === '1'
const element = family === 'technical' ? <TechnicalVisual visual={JSON.parse(params.get('visual') ?? '{}')}/> : family === 'transformer' ? <TransformerModelExplorer/> : family === 'post-training' ? <PostTrainingExperiment/> :
 family === 'renewable' ? <RenewableWorkspace id={id} node={node.module_id} micro={micro}/> :
 family === 'energy' ? <EnergyWorkspace id={id} node={node.module_id} micro={micro}/> :
 family === 'bionics' ? <BionicsCourseWorkspace course={course} node={node}/> :
 family === 'earth' ? <EarthCourseWorkspace course={course} node={node}/> :
 family === 'biomed' ? micro ? <BiomedMicroProject id={id as any}/> : <BiomedProjectWorkspace course={course} node={node}/> :
 id === 'assemble-a-rover' ? <RoverSystemWorkspace course={course} node={node}/> :
 id === 'run-an-expedition' ? <ExpeditionSystemWorkspace course={course} node={node}/> : <SpaceProjectWorkspace course={course} node={node}/>
createRoot(document.getElementById('root')!).render(element)
