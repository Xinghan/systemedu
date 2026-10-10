import type { LearningBody, LearningScope } from "../api/learning-records"
export type MissionTask = {
 id: string; code: string; title: string; station: string; role: string; category: string; goal: string;
 actions: string[]; outputs: string[]; checks: string[]; minutes: number | null;
 resources: {url:string; title:string; purpose:string; kind:string}[]; preparation:string; note:string
}
export const STATUS_LABELS = { todo: "待开始", active: "进行中", blocked: "遇到阻碍", review: "准备自检", done: "自检完成" } as const
export type TaskStatus = keyof typeof STATUS_LABELS
export type TaskState = { status: TaskStatus; checks: string[]; evidence: string; blocker: string; next: string; due: string; updatedAt: string }
export const EMPTY_TASK: TaskState = { status: "todo", checks: [], evidence: "", blocker: "", next: "", due: "", updatedAt: "" }
export type WorkSegment = { id: string; task: string; startedAt: string; endedAt: string; seconds: number; reason: string }
export type MissionOperations = {
  schema: string
  tasks: Record<string, TaskState>
  plan: { weeklyMinutes: number; milestones: Record<string, string> }
  time: { totals: Record<string, number>; days: Record<string, number>; recent: WorkSegment[] }
  events: { task: string; status: TaskStatus; at: string }[]
}
export function localDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}` }
export const heartbeatSeconds = (previous: number, now: number, visible: boolean) => visible && now>=previous && now-previous<=2500 ? (now-previous)/1000 : 0
export function weekSeconds(ops: MissionOperations, now: Date) {
  const start=new Date(now);start.setHours(12,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7))
  return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return ops.time.days[localDay(d)]||0}).reduce((a,b)=>a+b,0)
}
export function duration(seconds: number) { const n=Math.max(0,Math.floor(seconds));return n>=3600?`${Math.floor(n/3600)} 小时 ${Math.floor(n%3600/60)} 分钟`:n>=60?`${Math.floor(n/60)} 分钟 ${n%60} 秒`:`${n} 秒` }

export function taskState(ops: MissionOperations, id: string): TaskState { return ops.tasks[id] || EMPTY_TASK }

export function canFinish(task: MissionTask, state: TaskState) { return task.checks.every((_,i)=>state.checks.includes(`check-${i}`)) && !!state.evidence.trim() && !state.blocker.trim() }

export const dateValid = (v: unknown): v is string => typeof v === "string" && (v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + "T12:00:00Z")) && new Date(v + "T12:00:00Z").toISOString().slice(0,10) === v)

export function createMissionOperations(TASKS: MissionTask[], scope: LearningScope, schema: string, steps: string[]) {
 const taskById = (id:string) => TASKS.find(t=>t.id===id)
 const stationIds = [...new Set(TASKS.map(t=>t.station))]
const INITIAL_OPERATIONS: LearningBody = { answers: [], artifact: { schema: schema, tasks: {}, plan: { weeklyMinutes: 120, milestones: {} }, time: { totals: {}, days: {}, recent: [] }, events: [] } }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const short = (v: unknown, n: number) => typeof v === "string" && v.length <= n
const seconds = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 315360000
const status = (v: unknown): v is TaskStatus => typeof v === "string" && Object.hasOwn(STATUS_LABELS, v)

function operationsFrom(body: LearningBody): MissionOperations | null {
  const a = body.artifact
  if (!a || a.schema !== schema || !object(a.tasks) || Object.keys(a.tasks).length > TASKS.length || !object(a.plan) || !object(a.time) || !Array.isArray(a.events) || a.events.length > 80) return null
  if (!Object.entries(a.tasks).every(([id,t]) => { const task=taskById(id); return task && object(t) && status(t.status) && Array.isArray(t.checks) && t.checks.length <= task.checks.length && t.checks.every(c=>typeof c==="string"&&/^check-\d+$/.test(c)&&Number(c.slice(6))<task.checks.length) && short(t.evidence,300) && short(t.blocker,160) && short(t.next,200) && dateValid(t.due) && short(t.updatedAt,40) })) return null
  if (!Number.isInteger(a.plan.weeklyMinutes) || Number(a.plan.weeklyMinutes)<15 || Number(a.plan.weeklyMinutes)>1200 || !object(a.plan.milestones) || Object.keys(a.plan.milestones).length>stationIds.length || !Object.entries(a.plan.milestones).every(([k,v])=>TASKS.some(t=>t.station===k)&&dateValid(v))) return null
  if (!object(a.time.totals) || !Object.entries(a.time.totals).every(([k,v])=>taskById(k)&&seconds(v)) || !object(a.time.days) || Object.keys(a.time.days).length>730 || !Object.entries(a.time.days).every(([k,v])=>k&&dateValid(k)&&seconds(v)) || !Array.isArray(a.time.recent) || a.time.recent.length>80 || !a.time.recent.every(r=>object(r)&&short(r.id,80)&&taskById(String(r.task))&&short(r.startedAt,40)&&short(r.endedAt,40)&&seconds(r.seconds)&&Number(r.seconds)<=1200&&short(r.reason,40))) return null
  if (!a.events.every(e=>object(e)&&taskById(String(e.task))&&status(e.status)&&short(e.at,40))) return null
  return a as MissionOperations
}
function changeTask(ops: MissionOperations, id: string, patch: Partial<TaskState>, at: string): MissionOperations {
  const task=taskById(id); if (!task) throw new Error("未知子任务")
  const old=taskState(ops,id), next={...old,...patch,updatedAt:at}
  if (next.status==="done"&&!canFinish(task,next)) next.status="review"
  if (next.status==="blocked"&&!next.blocker.trim()) throw new Error("先写下卡住的问题，再标记阻碍。")
  const events=old.status!==next.status?[...ops.events,{task:id,status:next.status,at}].slice(-80):ops.events
  return {...ops,tasks:{...ops.tasks,[id]:next},events}
}
/** Cumulative segment updates are idempotent. Existing totals are never recalculated from a capped log. */
function recordWork(ops: MissionOperations, segment: WorkSegment, day: string): MissionOperations {
  if (!taskById(segment.task) || !seconds(segment.seconds) || segment.seconds>1200 || !day || !dateValid(day)) throw new Error("计时记录无效")
  const prior=ops.time.recent.find(r=>r.id===segment.id)
  if (prior && prior.task!==segment.task) throw new Error("计时标识与任务不符")
  const delta=segment.seconds-(prior?.seconds||0)
  if (delta<0) return ops
  const days={...ops.time.days,[day]:(ops.time.days[day]||0)+delta}
  const keptDays=Object.fromEntries(Object.entries(days).sort(([a],[b])=>a.localeCompare(b)).slice(-730))
  const recent=[...ops.time.recent.filter(r=>r.id!==segment.id),segment].slice(-80)
  return {...ops,time:{totals:{...ops.time.totals,[segment.task]:(ops.time.totals[segment.task]||0)+delta},days:keptDays,recent}}
}

 function mainProgress(ops: MissionOperations) { return {done:steps.filter(id=>taskState(ops,id).status==="done").length,total:steps.length} }
 return {TASKS, scope, INITIAL_OPERATIONS, taskById, operationsFrom, taskState, canFinish, changeTask, recordWork, mainProgress}
}
export type MissionEngine = ReturnType<typeof createMissionOperations>
