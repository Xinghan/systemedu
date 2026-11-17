import { lightkurveArtifactMessage, lightkurveValidationMessage, lightkurveValidationState } from '../../student-web/src/lib/lightkurve-preview'
import { pvlibArtifactMessage, pvlibArtifactReady } from '../../student-web/src/lib/pvlib-preview'
import { teachopencaddArtifactMessage } from '../../student-web/src/lib/teachopencadd-preview'

/** Reuse the website's payload validation; the caller checks the exact source window. */
export async function receiveCourseArtifact(data: unknown, moduleId: string, ideaId: string, storage: Record<string,string>, persist: (value: Record<string,string>) => Promise<void>, reply: (value: unknown) => void) {
  const key='ios:lightkurve:validation'
  const validation=lightkurveValidationMessage(data,moduleId)
  if(validation) {
    try {
      let saved=lightkurveValidationState(JSON.parse(storage[key] ?? 'null'))
      if(validation.type==='systemedu-lightkurve-checkpoint') {
        if(saved?.freeze && JSON.stringify(saved.freeze)!==JSON.stringify(validation.state.freeze)) {
          reply({type:'systemedu-lightkurve-state',moduleId,state:saved});return true
        }
        saved=saved?.firstResult ? saved : validation.state
        // Acknowledge only after the parent host has committed the SQLite transaction.
        await persist({...storage,[key]:JSON.stringify(saved)})
      }
      if(validation.type==='systemedu-lightkurve-request-holdout') {
        if(moduleId!=='M25'||!saved?.freeze) throw new Error('No saved prediction')
        const response=await fetch('/content/assets/lightkurve-transit-detective/practice/browser/holdout.json')
        if(!response.ok) throw new Error('Missing holdout')
        reply({type:'systemedu-lightkurve-holdout',moduleId,data:await response.json()})
      } else reply({type:'systemedu-lightkurve-state',moduleId,state:saved ?? {freeze:null,firstResult:null}})
    } catch {reply({type:'systemedu-lightkurve-error',moduleId})}
    return true
  }
  const artifactKey=`ios:artifact:${moduleId}:${ideaId}`
  if(pvlibArtifactReady(data,moduleId,ideaId)) {
    if(storage[artifactKey]) reply({type:'systemedu-pvlib-artifact-restore',module_id:moduleId,idea_id:ideaId,artifact:JSON.parse(storage[artifactKey])})
    return true
  }
  const artifact=lightkurveArtifactMessage(data,moduleId) ?? pvlibArtifactMessage(data,moduleId) ?? teachopencaddArtifactMessage(data,moduleId)
  if(artifact) { await persist({...storage,[artifactKey]:JSON.stringify(artifact)});return true }
  return false
}
