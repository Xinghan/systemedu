export const COURSE_ID = "llm-post-training-professional"
export const VERSION = "2026-10-15.2"
export const MODULE_IDS = ["M01", "M02", "M03", "M04", "M05"] as const
export type ModuleId = typeof MODULE_IDS[number]
export type NodeRecord = { notes: string; checks: boolean[]; slide: number }
export type RecordData = {
  schema: 2; course: typeof COURSE_ID; version: typeof VERSION
  nodes: Record<ModuleId, NodeRecord>
  lab: { rank: number; angle: number; quantized: boolean; maskPrompt: boolean; keepEos: boolean; signal: number }
}
export function freshRecord(): RecordData {
  return { schema: 2, course: COURSE_ID, version: VERSION,
    nodes: Object.fromEntries(MODULE_IDS.map(id => [id, { notes: "", checks: [false, false, false, false], slide: 0 }])) as Record<ModuleId, NodeRecord>,
    lab: { rank: 8, angle: -25, quantized: true, maskPrompt: true, keepEos: true, signal: 0 } }
}
export function isRecord(value: unknown): value is RecordData {
  if (!value || typeof value !== "object") return false
  const r = value as RecordData
  return r.schema === 2 && r.course === COURSE_ID && r.version === VERSION && !!r.nodes && !!r.lab
    && MODULE_IDS.every(id => { const n = r.nodes[id]; return n && typeof n.notes === "string" && n.notes.length <= 12000
      && Array.isArray(n.checks) && n.checks.length === 4 && n.checks.every(x => typeof x === "boolean")
      && Number.isInteger(n.slide) && n.slide >= 0 && n.slide < 5 })
    && [2, 4, 8, 16, 32].includes(r.lab.rank)
    && Number.isFinite(r.lab.angle) && r.lab.angle >= -60 && r.lab.angle <= 30
    && typeof r.lab.quantized === "boolean" && typeof r.lab.maskPrompt === "boolean" && typeof r.lab.keepEos === "boolean"
    && Number.isInteger(r.lab.signal) && r.lab.signal >= 0 && r.lab.signal <= 3
}
export function createRecordStore() {
  const key = `${COURSE_ID}:${VERSION}`
  let state = { record: freshRecord(), ready: false, writable: true, message: "正在读取本地实验记录…" }
  const initial = state
  const listeners = new Set<() => void>()
  const publish = () => listeners.forEach(fn => fn())
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    snapshot: () => state, serverSnapshot: () => initial,
    start() {
      if (state.ready) return
      try {
        const raw = localStorage.getItem(key)
        const parsed: unknown = raw ? JSON.parse(raw) : freshRecord()
        if (!isRecord(parsed)) throw new Error("Unsupported record")
        state = { record: parsed, ready: true, writable: true, message: raw ? "已恢复本浏览器的记录" : "记录自动保存在本浏览器" }
      } catch { state = { ...state, ready: true, writable: false, message: "无法读取本地记录，原数据保留；请导出当前记录备份。" } }
      publish()
    },
    update(next: RecordData) {
      if (!isRecord(next)) return
      let { writable, message } = state
      if (writable) {
        try { localStorage.setItem(key, JSON.stringify(next)); message = "已保存到本浏览器" }
        catch { writable = false; message = "本地保存不可用，请导出记录备份。" }
      }
      state = { record: next, ready: true, writable, message }; publish()
    },
  }
}
