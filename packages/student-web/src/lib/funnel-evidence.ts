export type GateId = "lip" | "sol" | "sim" | "tox"
export type Candidate = {id:string;mw:number;logp:number;hbd:number;hba:number;logS:number;similarity:number;toxScore:number}
export const GATES: Record<GateId,{name:string;cost:number;rule:string}> = {
  lip:{name:"四性质初筛",cost:1,rule:"MW ≤ 500；logP ≤ 5；HBD ≤ 5；HBA ≤ 10"},
  sol:{name:"估算溶解度",cost:2,rule:"教学 logS ≥ −4（log₁₀ mol/L）"},
  sim:{name:"固定参考相似度",cost:3,rule:"教学相似度 ≤ 0.85"},
  tox:{name:"模型风险门槛",cost:4,rule:"教学风险分数 ≤ 可调阈值"},
}
export const DEFAULT_ORDER: GateId[] = ["lip","sol","sim","tox"]
export const FUNNEL_SEED = 8603
/** Fixed synthetic rows. Neither real compounds, RDKit values, nor model predictions. */
export function makeCandidates(count=5000,seed=FUNNEL_SEED):Candidate[] {
  if(!Number.isInteger(count)||count<0||count>100000)throw new Error("Invalid candidate count")
  let state=seed>>>0
  const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
  const round=(x:number)=>Math.round(x*100)/100
  return Array.from({length:count},(_,i)=>({id:`C${String(i+1).padStart(4,"0")}`,mw:round(150+450*random()),logp:round(-1+8*random()),hbd:Math.floor(8*random()),hba:Math.floor(14*random()),logS:round(-6+5*random()),similarity:round(random()),toxScore:round(random())}))
}
export function passesGate(row:Candidate,gate:GateId,toxLimit=.3) {
  if(gate==="lip")return row.mw<=500&&row.logp<=5&&row.hbd<=5&&row.hba<=10
  if(gate==="sol")return row.logS>=-4
  if(gate==="sim")return row.similarity<=.85
  if(gate==="tox")return row.toxScore<=toxLimit
  throw new Error("Unknown gate")
}
export function runFunnel(rows:Candidate[],order:GateId[]=DEFAULT_ORDER,toxLimit=.3) {
  if(new Set(order).size!==order.length||order.some(g=>!GATES[g]))throw new Error("Duplicate or unknown gate")
  if(!Number.isFinite(toxLimit)||toxLimit<0||toxLimit>1)throw new Error("Invalid score threshold")
  if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!r.id||[r.mw,r.logp,r.hbd,r.hba,r.logS,r.similarity,r.toxScore].some(v=>!Number.isFinite(v))))throw new Error("Missing, non-finite, or duplicate candidate data")
  let alive=rows,cost=0
  const stages=order.map(gate=>{
    const input=alive.length,rejected=alive.filter(r=>!passesGate(r,gate,toxLimit)).map(r=>r.id)
    alive=alive.filter(r=>passesGate(r,gate,toxLimit));const stageCost=input*GATES[gate].cost;cost+=stageCost
    return {gate,input,remaining:alive.length,rejected:rejected.length,rejectedIds:rejected,ids:alive.map(r=>r.id),stageCost,cumulativeCost:cost}
  })
  return {initial:rows.length,stages,survivors:alive,cost,toxLimit,order:[...order]}
}
export function gateOrders(gates:GateId[]=DEFAULT_ORDER):GateId[][] {
  return gates.length?gates.flatMap(g=>gateOrders(gates.filter(x=>x!==g)).map(rest=>[g,...rest])):[[]]
}
export function rankedOrders(rows:Candidate[],toxLimit=.3) {
  return gateOrders().map(order=>runFunnel(rows,order,toxLimit)).sort((a,b)=>a.cost-b.cost)
}
export function rejectStage(row:Candidate,order:GateId[],toxLimit:number) {return order.findIndex(g=>!passesGate(row,g,toxLimit))}
