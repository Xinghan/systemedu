import map from './data/molecule-numbering-v2.json'
export const MOLECULE_NUMBERING_VERSION='consecutive-v2'
export const MOLECULE_PROJECT=map.project
export const LEGACY_MOLECULE_IDS:Readonly<Record<string,string>>=Object.fromEntries(map.modules.map(m=>[m.old,m.new]))
export function lessonPath(slug:string,moduleId:string){const base='/learn/'+encodeURIComponent(slug);return base+(slug===MOLECULE_PROJECT?'/v2/':'/')+encodeURIComponent(moduleId)}
export function legacyLessonPath(slug:string,oldId:string){if(slug!==MOLECULE_PROJECT)return lessonPath(slug,oldId);const current=LEGACY_MOLECULE_IDS[oldId];return current?lessonPath(slug,current):null}
export function isCurrentMoleculeId(id:string){return map.modules.some(m=>m.new===id)}
