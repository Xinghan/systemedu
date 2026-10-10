import type { LearningBody, LearningScope } from "./api/learning-records"

export type Site = "sand" | "rock" | "target"
export type Route = "direct" | "detour"
export type Checkpoint = "survey" | "plan" | "stopped" | "capture" | "complete"
export type Attempt = { route: Route; outcome: "stopped" | "arrived" }
export type Mission = {
  version: 1
  checkpoint: Checkpoint
  observed: Site[]
  attempts: Attempt[]
  route: Route | null
  photo: { x: number; y: number; zoom: number } | null
}

/** One crop definition for the viewfinder, saved artifact and exported photograph. */
export function photoCrop(photo: NonNullable<Mission["photo"]>, width: number, height: number) {
  const sw = width / photo.zoom, sh = sw * 2 / 3
  return {
    sx: Math.max(0, Math.min(width - sw, width * photo.x / 100 - sw / 2)),
    sy: Math.max(0, Math.min(height - sh, height * photo.y / 100 - sh / 2)), sw, sh,
  }
}

export const MISSION_SCOPE: LearningScope = {
  library_slug: "mars-analog-rover", module_id: "OPENING",
  activity_id: "first-person-mission", kind: "classroom", content_version: "1.0",
}
export const EMPTY_MISSION: Mission = {
  version: 1, checkpoint: "survey", observed: [], attempts: [], route: null, photo: null,
}
export const INITIAL_BODY: LearningBody = { answers: [], artifact: EMPTY_MISSION }
export const SITES: { id: Site; title: string; short: string; x: number; y: number; note: string }[] = [
  { id: "rock", title: "连续岩面", short: "岩面", x: 29, y: 58, note: "表面较实，仍需检查凸起和坡度。" },
  { id: "sand", title: "松软沙地", short: "沙地", x: 54, y: 70, note: "沙纹清晰；看似平坦，也可能打滑。" },
  { id: "target", title: "目标岩层", short: "岩层", x: 64, y: 35, note: "拍清横向纹理，带回可观察的证据。" },
]
export const ROUTES = {
  direct: { title: "直接穿越", detail: "穿过沙地 · 路程较短", path: "M 50 94 Q 51 70 54 61 T 64 37" },
  detour: { title: "沿岩面绕行", detail: "绕开沙地 · 路程较长", path: "M 50 94 C 22 89 22 66 29 53 S 48 46 64 37" },
} as const

// These are authored teaching outcomes, not a navigation or soil-physics model.
export function routeOutcome(route: Route): Attempt["outcome"] {
  return route === "direct" ? "stopped" : "arrived"
}
export function finishAttempt(mission: Mission, route: Route): Mission {
  const outcome = routeOutcome(route)
  return { ...mission, route, checkpoint: outcome === "arrived" ? "capture" : "stopped",
    attempts: [...mission.attempts.slice(-49), { route, outcome }] }
}
export function readMission(value: unknown): Mission {
  if (!value || typeof value !== "object") return EMPTY_MISSION
  const m = value as Partial<Mission>
  if (m.version !== 1 || !["survey", "plan", "stopped", "capture", "complete"].includes(m.checkpoint ?? "") ||
      !Array.isArray(m.observed) || m.observed.length > 3 || new Set(m.observed).size !== m.observed.length ||
      !m.observed.every(v => ["sand", "rock", "target"].includes(v)) ||
      !Array.isArray(m.attempts) || m.attempts.length > 50 ||
      !m.attempts.every(a => a && ["direct", "detour"].includes(a.route) && a.outcome === routeOutcome(a.route)) ||
      (m.route !== null && m.route !== "direct" && m.route !== "detour")) return EMPTY_MISSION
  if (m.photo !== null && (!m.photo || !Number.isFinite(m.photo.x) || !Number.isFinite(m.photo.y) ||
      !Number.isFinite(m.photo.zoom) || m.photo.x < 45 || m.photo.x > 80 || m.photo.y < 20 ||
      m.photo.y > 55 || m.photo.zoom < 1.3 || m.photo.zoom > 2.4)) return EMPTY_MISSION
  if (m.checkpoint !== "survey" && m.observed.length !== 3) return EMPTY_MISSION
  if (["capture", "complete"].includes(m.checkpoint!) && m.attempts.at(-1)?.outcome !== "arrived") return EMPTY_MISSION
  if (m.checkpoint === "stopped" && m.attempts.at(-1)?.outcome !== "stopped") return EMPTY_MISSION
  if (m.checkpoint === "complete" && !m.photo) return EMPTY_MISSION
  return m as Mission
}
export function missionBody(m: Mission): LearningBody {
  return { artifact: m, answers: [
    { question_id: "observations", question: "你检查了哪些地形？", answer: m.observed.map(id => SITES.find(s => s.id === id)!.title).join("、") || "尚未观察" },
    { question_id: "plan", question: "你做了哪些路线尝试？", answer: m.attempts.map(a => `${ROUTES[a.route].title}：${a.outcome === "arrived" ? "抵达" : "保护停车"}`).join("；") || "尚未执行" },
    { question_id: "evidence", question: "任务交付物", answer: m.photo ? "路线尝试、三处地形观察与岩层取景照片（教学模拟）" : "任务进行中" },
  ], client_context: { experience: "rover-cinematic-opening", simulation: true } }
}

export const DIALOGUE = {
  welcome: "你来了，坐我旁边。我是林岚。今天，晨光号的下一段任务，由我们一起完成。",
  mission: "看这片岩层。我们要让晨光号走到它面前，拍一张能看清纹理的照片。但它前面，有一片松软的沙地。",
  handover: "你不用遥控它。先观察，再选一条路线，让它自己执行。第一步，替我看看相机里的三处地形。",
  sand: "这里能看到细细的沙纹。看上去平坦，不一定好走。车轮可能打滑。先把这个风险记下来。",
  rock: "这边是连续的岩面。可能比松沙更稳，但还要留意凸起。照片只是线索，真正开车还需要传感器判断。",
  target: "就是这片岩层。我们的目标不是跑得最快，而是安全地到达，带回一张看得清的照片。",
  plan: "现在轮到你决定。直接穿过沙地，路短；沿左侧岩面绕行，路长。你愿意把哪份计划交给晨光号？",
  stopped: "它停下来了。在这次模拟里，车轮打滑触发了保护停车。没关系，保留这次尝试。我们回到起点，换一条路线再试。",
  arrived: "到了！你看，岩石上的层次清楚多了。移动取景框，让那些横向的纹理落在画面中间，再按下快门。",
  complete: "第一份任务档案，完成。这条路线和这张照片，是你做出的决定。下一步，我们把你的判断，写成探测车真正能执行的规则。",
} as const
export type VoiceLine = keyof typeof DIALOGUE
