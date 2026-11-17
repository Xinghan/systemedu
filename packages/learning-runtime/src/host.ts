export type Activity = string
export type Snapshot = Record<string, unknown>
export interface LearningHost {
  load(): Promise<Snapshot | null>
  save(state: Snapshot): Promise<{ saved_at: string }>
  exportState(): Promise<unknown>
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
    save: async state => await send("save", state) as { saved_at: string },
    exportState: () => send("export"),
  }
}
// Browser preview is explicitly local and never claims account synchronization.
export function browserHost(activity: Activity): LearningHost {
  const key = `systemedu:runtime-preview:v1:${activity}`
  const workspaceKey = activity.startsWith("course:") ? `systemedu:runtime-workspace:v1:${activity.split(":").slice(1,3).join(":")}` : null
  return {
    async load() { const raw = localStorage.getItem(key), shared = workspaceKey ? localStorage.getItem(workspaceKey) : null; return raw || shared ? {...JSON.parse(raw ?? "{}"), ...(shared ? {shared_workspace:JSON.parse(shared)} : {})} as Snapshot : null },
    async save(state) { if (workspaceKey && state.shared_workspace) localStorage.setItem(workspaceKey, JSON.stringify(state.shared_workspace)); localStorage.setItem(key, JSON.stringify(state)); return { saved_at: new Date().toISOString() } },
    async exportState() {
      const blob = new Blob([localStorage.getItem(key) ?? "{}"], { type: "application/json" })
      const url = URL.createObjectURL(blob), link = document.createElement("a")
      link.href = url; link.download = `${activity}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  }
}
