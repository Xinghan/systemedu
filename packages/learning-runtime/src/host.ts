export type Activity = string
export type Snapshot = Record<string, unknown>
export interface LearningHost {
  load(): Promise<Snapshot | null>
  save(state: Snapshot): Promise<{ saved_at: string }>
  exportState(): Promise<unknown>
  advance?(): Promise<unknown>
}
// Presentation only: the native host keeps one navigation layer while an activity is open.
export function setClassroomImmersive(immersive: boolean) {
  const handler = (window as unknown as { webkit?: { messageHandlers?: { classroomPresentation?: { postMessage: (message: unknown) => Promise<unknown> } } } }).webkit?.messageHandlers?.classroomPresentation
  if (!handler) return
  const params = new URLSearchParams(location.search)
  void handler.postMessage({session:params.get('session'),activity:params.get('activity'),immersive}).catch(() => {})
}
export function activityFrom(value: string | null): Activity {
  if (value === "mechanical-hand" || value === "mars-landing" || value === "driving-intro" || (value && /^course:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(value) && value.length <= 220)) return value
  throw new Error("无法识别这项学习活动，请返回后重新打开。")
}
export function nativeHost(activity: Activity, session: string): LearningHost {
  const send = async (method: string, state?: Snapshot) => {
    const handler = (window as unknown as { webkit?: { messageHandlers?: { learning?: { postMessage: (message: unknown) => Promise<unknown> } } } }).webkit?.messageHandlers?.learning
    if (!handler) throw new Error("本地保存服务未连接，请返回后重新打开。")
    const request_id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("")
    return handler.postMessage({ version: 1, session, activity, request_id, method, ...(state ? { state } : {}) })
  }
  return {
    load: async () => await send("load") as Snapshot | null,
    save: async state => { const {reference_workspace: _references, ...owned} = state; return await send("save", owned) as { saved_at: string } },
    exportState: () => send("export"),
    advance: () => send("advance"),
  }
}
// Browser preview is explicitly local and never claims account synchronization.
export function browserHost(activity: Activity): LearningHost {
  const key = `systemedu:runtime-preview:v1:${activity}`
  const workspaceKey = activity.startsWith("course:") ? `systemedu:runtime-workspace:v1:${activity.split(":").slice(1,3).join(":")}` : null
  return {
    async load() {
      const raw = localStorage.getItem(key), shared = workspaceKey ? localStorage.getItem(workspaceKey) : null
      const references: Record<string,string> = {}
      for (const project of ['pick-an-observation-site:1.0','plan-a-payload:1.0','tune-a-chassis:1.0','label-the-terrain:1.0','write-driving-rules:1.0','assemble-a-rover:2.0','run-an-expedition:2.0']) {
        const source = `systemedu:runtime-workspace:v1:${project}`
        if(source === workspaceKey) continue
        const values = JSON.parse(localStorage.getItem(source) ?? '{}') as Record<string,string>
        for(const [k,v] of Object.entries(values)) if(k.startsWith('systemedu:learning:v1:guest:') && k.includes('final-deliverable')) references[k]=v
      }
      return {...JSON.parse(raw ?? '{}'), ...(shared ? {shared_workspace:JSON.parse(shared)} : {}),reference_workspace:references} as Snapshot
    },
    async save(state) { const {reference_workspace: _references, ...owned} = state; if (workspaceKey && owned.shared_workspace) localStorage.setItem(workspaceKey, JSON.stringify(owned.shared_workspace)); localStorage.setItem(key, JSON.stringify(owned)); return { saved_at: new Date().toISOString() } },
    async exportState() {
      const blob = new Blob([localStorage.getItem(key) ?? "{}"], { type: "application/json" })
      const url = URL.createObjectURL(blob), link = document.createElement("a")
      link.href = url; link.download = `${activity}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  }
}
