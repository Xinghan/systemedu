import { MISSION_STATIONS } from "./space-curriculum"
import { LOCAL_PROJECTS } from "./catalog"
import snapshots from "./course-snapshots.json"
import { SPACE_MISSION_HREF } from "./mission-routes"
import { projectCoverProps } from "../project-cover"

export const SPACE_JOURNEY_HREF = SPACE_MISSION_HREF
export const SPACE_JOURNEY_LINE = "space-exploration"
export const JOURNEY_LEVELS = [
  { level: 1, role: "接受任务", task: "先观察，留下一个问题", evidence: "第一次观察与任务档案", support: "先选一个 3 分钟体验。浏览器即可，不需要购买器材。" },
  { level: 2, role: "设计方案", task: "选择目标，比较结构", evidence: "任务简报、底盘与接口方案", support: "用已有引导课完成选择和对照。模拟参数在制作时要重新测量。" },
  { level: 3, role: "制造原型", task: "让自己的车动起来", evidence: "3D 打印车、程序与实测", support: "数字原型可以先做，正式实物需要打印结构件、低压标准器件及成人协助。" },
  { level: 4, role: "升级自主能力", task: "训练视觉，接入同一辆车", evidence: "数据、模型、联调与停止测试", support: "视觉学习可与打印等待并行。升级主控与路线闭环需先完成样机验证。" },
  { level: 5, role: "执行并交付", task: "在现场验证，交付证据", evidence: "远征尝试、复测与完整工程档案", support: "记录真实失败和修订。人工演练、自主实测、作品提交与能力评阅分别说明。" },
] as const

export const JOURNEY_STATIONS = MISSION_STATIONS
export type JourneyStation = typeof JOURNEY_STATIONS[number]
export const JOURNEY_IDS = ["spot-a-world", "land-a-probe", "drive-and-frame", "pick-an-observation-site", "plan-a-payload", "tune-a-chassis", "write-driving-rules", "assemble-a-rover", "label-the-terrain", "run-an-expedition", "mars-analog-rover", "lightkurve-transit-detective"]
export function journeyStationFor(projectId: string) {
  const defaults: Record<string, string> = { "mars-analog-rover": "autonomy", "assemble-a-rover": "build", "write-driving-rules": "build" }
  return defaults[projectId] ? JOURNEY_STATIONS.find(s => s.id === defaults[projectId]) : JOURNEY_STATIONS.find(s => s.projects.includes(projectId))
}
export function journeyHref(projectId?: string) { const station = projectId && journeyStationFor(projectId); return SPACE_JOURNEY_HREF + (station ? `?station=${station.id}#journey-map` : "") }

export function journeyProject(id: string) {
  const local = LOCAL_PROJECTS.find(p => p.id === id)
  // This newer research course is supplied by the content service, outside the legacy snapshots.
  // Summary follows its existing course manifest; availability is still checked by /library/[slug].
  const full = snapshots.find(p => p.slug === id) ?? (id === "lightkurve-transit-detective" ? {
    title_zh: "抓住行星的影子 — 可复跑的真实凌星调查",
    outcome: "真实光变数据、可复跑的分析程序与独立片段验证报告",
    coverImage: "",
  } : undefined)
  if (!local && !full) throw new Error(`Missing journey project: ${id}`)
  // Older deployed course snapshots omit covers; use their existing optimized asset mapping.
  const snapshotCover = full && "coverImage" in full && typeof full.coverImage === "string" ? full.coverImage : ""
  return { id, title: local?.title.zh ?? full!.title_zh, href: local?.href ?? `/library/${id}`, outcome: local?.outcome.zh ?? full!.outcome,
    cover: local?.coverImage ?? projectCoverProps(id, snapshotCover, "card").src, micro: local?.kind === "micro", full: !local,
    duration: local ? `约 ${local.estimatedMinutes} 分钟 · ${local.learningNodes ? `${local.learningNodes} 个节点` : "直接操作"}` : "完整课程 · 可分阶段完成",
    preparation: local?.preparation?.zh, station: journeyStationFor(id) ?? JOURNEY_STATIONS[7],
  }
}

// Fixed scopes match existing course editions. Changing the journey never migrates student records.
export const JOURNEY_DELIVERIES: Record<string, { module: string; version: string }> = {
  "pick-an-observation-site": { module: "M03", version: "1.0" },
  "plan-a-payload": { module: "M03", version: "1.0" },
  "tune-a-chassis": { module: "M03", version: "1.0" },
  "label-the-terrain": { module: "M03", version: "1.0" },
  "write-driving-rules": { module: "M04", version: "1.0" },
  "assemble-a-rover": { module: "M08", version: "2.0" },
  "run-an-expedition": { module: "M05", version: "2.0" },
}
