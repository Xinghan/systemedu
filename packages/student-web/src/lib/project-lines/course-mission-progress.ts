import { STUDENT_API_URL } from "../api/client"
import { learningRecords } from "../api/learning-records"
import { learningCacheKey } from "../learning-record-session"
import { reflectionScope, type MissionNodeState } from "./space-mission-progress"
const validAnswers = (body: unknown) => !!body && typeof body === "object" && "answers" in body && Array.isArray(body.answers) && body.answers.length > 0 && body.answers.every((a: unknown) => !!a && typeof a === "object" && "answer" in a && typeof a.answer === "string")

async function timed<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 15000) })]) }
  finally { clearTimeout(timer) }
}
export async function readCourseMissionProgress(MISSION_MODULES: {ref:string;kind:string;project:string;module:string;version:string}[], token: string | null, owner: string, update: (ref: string, state: MissionNodeState) => void) {
  const guided = MISSION_MODULES.filter(m => m.kind === "guided")
  let cursor = 0
  async function worker() {
    while (cursor < guided.length) {
      const m = guided[cursor++], scope = reflectionScope(m.project, m.module, m.version)
      try {
        const raw = localStorage.getItem(learningCacheKey(owner, scope))
        const local = raw ? JSON.parse(raw) : null
        if (token) {
          const remote = await timed(learningRecords.read(token, scope))
          const submitted = remote.submissions.some(s => validAnswers(s.body) && s.body.answers.every(a => a.answer.trim()))
          update(m.ref, local?.dirty ? "draft" : remote.draft?.status === "draft" ? "draft" : submitted ? "recorded" : "new")
        } else {
          if (local && (local.version !== 1 || !validAnswers(local.body))) throw new Error("Invalid local record")
          update(m.ref, local?.dirty ? "draft" : local?.submittedAt && local.body.answers.every((a: {answer: string}) => a.answer.trim()) ? "recorded" : local ? "draft" : "new")
        }
      } catch { update(m.ref, "unknown") }
    }
  }
  const full = async () => {
    const all = MISSION_MODULES.filter(m => m.kind === "full")
    await Promise.all([...new Set(all.map(m=>m.project))].map(async project=>{
    const refs=all.filter(m=>m.project===project)
    if (!token) { refs.forEach(m => update(m.ref, "guest")); return }
    try {
      const response = await fetch(`${STUDENT_API_URL}/api/my/knodes/${encodeURIComponent(project)}/complete-status`, { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, "X-Course-Numbering": "consecutive-v2" } })
      if (!response.ok) throw new Error("Unavailable")
      const body = await response.json()
      if (!Array.isArray(body.completed_knode_ids)) throw new Error("Invalid completion status")
      const completed = new Set(body.completed_knode_ids)
      refs.forEach(m => update(m.ref, completed.has(m.module) ? "marked" : "new"))
    } catch { refs.forEach(m => update(m.ref, "unknown")) }
    }))
  }
  await Promise.all([full(), ...Array.from({ length: 4 }, worker)])
}
