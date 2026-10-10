import source from "./data/m03-molecules.json"

export type Vector3 = [number, number, number]
export type MolecularGeometry = {
  id: string; name: string; formula: string; smiles: string; cid: number
  atoms: Array<{ id: number; element: string; position: number[] }>
  bonds: Array<{ a: number; b: number; order: number }>
  heavyAtoms: number; totalAtoms: number; mw: number; rings: number; aromaticRings: number
  sourceUrl: string; sdfUrl: string; sdfSha256: string
}
export const MOLECULES: MolecularGeometry[] = source.rows
export const GEOMETRY_SOURCE = { ...source, rows: undefined }
export function subtract(a: number[], b: number[]): Vector3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]] }
export function distance(a: number[], b: number[]) { return Math.hypot(...subtract(a,b)) }
export function angleDegrees(a: number[], center: number[], b: number[]) {
  const u=subtract(a,center),v=subtract(b,center),d=Math.hypot(...u)*Math.hypot(...v)
  if(!d) throw new Error("Coincident atoms")
  return Math.acos(Math.max(-1,Math.min(1,u.reduce((s,n,i)=>s+n*v[i],0)/d)))*180/Math.PI
}
export function moleculeCounts(m: MolecularGeometry, showH = true) {
  const visible=m.atoms.filter(a=>showH||a.element!=="H"),ids=new Set(visible.map(a=>a.id))
  return {atoms:visible.length,bonds:m.bonds.filter(b=>ids.has(b.a)&&ids.has(b.b)).length,hydrogens:m.atoms.filter(a=>a.element==="H").length,heavy:m.heavyAtoms,rings:m.rings,aromaticRings:m.aromaticRings}
}
export function elementCounts(m: MolecularGeometry) {
  return m.atoms.reduce<Record<string,number>>((out,a)=>{out[a.element]=(out[a.element]||0)+1;return out},{})
}
export function centerBondAngle(m: MolecularGeometry) {
  const center=m.id==="water"?m.atoms.find(a=>a.element==="O"):m.atoms.find(a=>a.element==="C")
  if(!center)return null
  const hs=m.bonds.filter(b=>b.a===center.id||b.b===center.id).map(b=>m.atoms[b.a===center.id?b.b:b.a]).filter(a=>a.element==="H")
  return hs.length>=2?angleDegrees(hs[0].position,center.position,hs[1].position):null
}
/** Plane normal is derived from coordinates, not a guessed default viewing axis. */
export function molecularPlaneNormal(m: MolecularGeometry): Vector3 {
  const a=m.atoms[0].position,b=m.atoms[1].position,c=m.atoms[2].position,u=subtract(b,a),v=subtract(c,a)
  const n:Vector3=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)
  return length>1e-8?n.map(x=>x/length) as Vector3:[0,0,1]
}
export function planeDeviation(m: MolecularGeometry) {
  const n=molecularPlaneNormal(m),origin=m.atoms[0].position
  return Math.max(...m.atoms.map(a=>Math.abs(subtract(a.position,origin).reduce((s,x,i)=>s+x*n[i],0))))
}
