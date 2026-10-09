import { STUDENT_API_URL } from "../api/client"
import { learningRecords, type LearningScope } from "../api/learning-records"
import { learningCacheKey } from "../learning-record-session"
import { JOURNEY_DELIVERIES, JOURNEY_IDS } from "./space-journey"

export type JourneyProgress = { state: "loading" | "new" | "local" | "submitted" | "draft" | "active" | "unknown" | "guest" | "review"; label: string; count?: number; total?: number; note: string }
export type JourneyProgressMap = Record<string, JourneyProgress>
export const waitingProgress = (): JourneyProgressMap => Object.fromEntries(JOURNEY_IDS.map(id => [id, { state: "loading", label: "读取进展", note: "" }]))
const unknown = (): JourneyProgress => ({state:"unknown", label:"进展待读取", note:"暂时没有完整读到已有记录，可以重试；不会算作未完成。"})
const MICRO_IDS = ["spot-a-world", "land-a-probe", "drive-and-frame"]
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v) }
function validLocalWork(id: string, v: unknown) {
  if (!object(v) || v.schema_version !== `${id}/1` || v.origin !== "simulated" || typeof v.created_at !== "string" || !Number.isFinite(Date.parse(v.created_at))) return false
  if (id === "land-a-probe") return v.artifact_id === "landing-replay" && Array.isArray(v.frames) && v.frames.length > 1 && object(v.result) && ["landed","hard","outside","aborted"].includes(String(v.result.status))
  if (typeof v.image !== "string" || !v.image.startsWith("data:image/jpeg;base64,")) return false
  if (id === "spot-a-world") return v.artifact_id === "sky-observation" && object(v.evidence) && v.evidence.manual_pan === true && v.evidence.manual_zoom === true
  return v.artifact_id === "first-drive" && Array.isArray(v.path) && v.path.length > 1
}

async function withTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([request, new Promise<never>((_, reject)=>{timer=setTimeout(()=>reject(new Error("Progress timed out")),15000)})]) }
  finally { if (timer) clearTimeout(timer) }
}

async function accountGet<T>(token: string | null, path: string): Promise<T> {
  const response = await fetch(`${STUDENT_API_URL}${path}`, { signal: AbortSignal.timeout(15000), cache:"no-store", headers:{"X-Course-Numbering":"consecutive-v2", ...(token ? {Authorization:`Bearer ${token}`} : {})} })
  if (!response.ok) throw new Error("Progress unavailable")
  return response.json()
}

export async function readJourneyProject(id: string, token: string | null, owner: string): Promise<JourneyProgress> {
  try {
    if (MICRO_IDS.includes(id)) {
      // Legacy micro games are device-scoped. Never attribute another browser user's album to an account.
      if (token) return {state:"guest",label:"本机体验",note:"这些短体验使用本机相册，不计入账号作品。进入项目可查看本机记录。"}
      const raw=localStorage.getItem(`systemedu:${id}:v1`)
      if (!raw) return {state:"new",label:"等你第一次尝试",note:"3 分钟体验的作品保存在当前浏览器。"}
      const saved: unknown=JSON.parse(raw)
      if (!Array.isArray(saved) || saved.length > 30 || !saved.every(v=>validLocalWork(id,v))) return unknown()
      return saved.length ? {state:"local",label:`${saved.length} 份本机作品`,count:saved.length,note:"教学模拟的操作记录；失败的尝试也值得保留，不代表已掌握。"} : {state:"new",label:"等你第一次尝试",note:"本机相册还没有作品。"}
    }
    const delivery=JOURNEY_DELIVERIES[id]
    if (delivery) {
      const scope: LearningScope={library_slug:id,module_id:delivery.module,activity_id:"final-deliverable",kind:"assignment",content_version:delivery.version}
      if (token) {
        const history=await withTimeout(learningRecords.read(token,scope))
        if (history.submissions.length) return {state:"submitted",label:"作品已提交 · 待评阅",note:"读取现有课程的正式交付快照；提交不等于评定掌握。"}
        return history.draft ? {state:"draft",label:"作品草稿待交付",note:"回到项目继续整理作品并按课程要求提交。"} : {state:"new",label:"尚无交付记录",note:"尚未读取到正式交付；可进入项目继续已有课堂记录。"}
      }
      const raw=localStorage.getItem(learningCacheKey(owner,scope))
      if (!raw) return {state:"new",label:"尚无本机交付",note:"访客作品保存在当前浏览器，登录后的课程作品按账号保存。"}
      const cached=JSON.parse(raw)
      if (cached?.version!==1 || !Array.isArray(cached.body?.answers) || !cached.body.answers.every((a: unknown)=>object(a)&&typeof a.answer === "string")) return unknown()
      if (cached.submittedAt && !cached.dirty) return {state:"submitted",label:"本机作品已保存",note:"本机保存的交付版本，不代表已通过评阅。"}
      return {state:"draft",label:"本机作品草稿",note:"进入课程继续整理并保存交付版本。"}
    }
    if (!token) return {state:"guest",label:"登录后读取课程进展",note:"可先查看项目目标与课程目录。原课程登录及加入要求保持不变。"}
    const [tree,status]=await Promise.all([
      accountGet<{modules?:{module_id:string}[]}>(token,`/api/library/projects/${id}/tree`),
      accountGet<{completed_knode_ids:string[]}>(token,`/api/my/knodes/${id}/complete-status`),
    ])
    if (!tree.modules?.length || !Array.isArray(status.completed_knode_ids)) return unknown()
    const ids=new Set(tree.modules.map(m=>m.module_id)),completed=new Set(status.completed_knode_ids.filter(n=>ids.has(n)))
    const count=completed.size,total=ids.size
    return {state:count===total?"review":count?"active":"new",label:`${count} / ${total} 节点已标记完成`,count,total,note:count===total?"课程节点已完成，仍需复核完整工程或研究作品。":"读取原课堂的完成标记；浏览过某一课不会被当作完成此前课程。"}
  } catch { return unknown() }
}

export function hasJourneyEvidence(progress?: JourneyProgress) { return progress?.state === "local" || progress?.state === "submitted" }
export function recommendJourneyProject(progress: JourneyProgressMap) {
  const continuing=JOURNEY_IDS.find(id=>["draft","active"].includes(progress[id]?.state))
  if (continuing) return continuing
  // One small success is enough to try a guided project; the other micro experiences remain open.
  const triedMicro=JOURNEY_IDS.some(id=>hasJourneyEvidence(progress[id]) || progress[id]?.state === "review")
  return JOURNEY_IDS.find(id=>(!triedMicro||!MICRO_IDS.includes(id))&&!hasJourneyEvidence(progress[id])&&progress[id]?.state!=="review") ?? "mars-analog-rover"
}
