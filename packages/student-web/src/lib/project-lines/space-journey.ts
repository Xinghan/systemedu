import { LOCAL_PROJECTS } from "./catalog"
import snapshots from "./course-snapshots.json"
import { SPACE_MISSION_HREF } from "./mission-routes"

export const SPACE_JOURNEY_HREF = SPACE_MISSION_HREF
export const SPACE_JOURNEY_LINE = "space-exploration"
export const JOURNEY_LEVELS = [
  { level: 1, role: "探索新人", task: "先做一次，再提出问题", evidence: "照片、着陆轨迹与路线记录", support: "浏览器即可。先选一个 3 分钟项目体验，不需要购买器材。" },
  { level: 2, role: "任务学徒", task: "做出方法，用对照检验", evidence: "选址、预算、底盘、样本与规则作品", support: "每项有多节课程、资料和作品要求。可以分次完成；先在浏览器做实验。" },
  { level: 3, role: "系统建造者", task: "让零件协作，让方案落地", evidence: "3D 打印实物车与测试档案", support: "可先做数字原型；正式交付需要 3D 打印结构、简单低压器件及成人协助。" },
  { level: 4, role: "远征负责人", task: "自己定目标，在新现场验证", evidence: "实地远征、失败诊断与修订记录", support: "先准备已完成的实物车、可控地面测试区与成人支持。" },
  { level: 5, role: "高阶工程与研究", task: "选择方向，承担完整交付", evidence: "自主探测车工程或可复现的行星研究", support: "高阶有两条方向，可以先选一条深挖。完整工程需硬件与长期投入；天文研究以真实数据与计算为主。" },
] as const

export const JOURNEY_STATIONS = [
  { id: "first-contact", level: 1, place: "启程观测港", projects: ["spot-a-world", "land-a-probe", "drive-and-frame"],
    message: "先不用学完一整门课。选一个世界、试一次着陆，或开车找到观察点。带回第一件作品，我们再来讨论你发现了什么。", handoff: "照片和操作记录，会成为下一站选择观察目标、解释设计的起点。" },
  { id: "mission-design", level: 2, place: "任务设计所", projects: ["pick-an-observation-site", "plan-a-payload"],
    message: "我们知道怎么观察了，但要去哪里、带什么？用图像支持你的选址，在重量和电源限制下做取舍。", handoff: "把选址与装备预算带到后面的整车方案和远征计划里。" },
  { id: "mechanics", level: 2, place: "结构实验室", projects: ["tune-a-chassis"],
    message: "同一段路，换一个参数会怎样？保留第一版，用相同条件做比较。我们要的是证据，不是看起来更厉害的底盘。", handoff: "底盘配置与对照测试，可以在系统建造课程中作为自己的输入。" },
  { id: "perception", level: 2, place: "感知与控制站", projects: ["label-the-terrain", "write-driving-rules"],
    message: "让车先看见，再作判断。给地形整理样本，把你的想法写成规则，再用新的路线看看它会不会犯错。", handoff: "把地形样本和测试过的驾驶规则带入整车设计，检查它们在新路线中还能不能用。" },
  { id: "build", level: 3, place: "系统建造区", projects: ["assemble-a-rover"],
    message: "现在，你要对整个系统负责。把结构、感知、控制和能源接起来，先排错，再打印、装配，让桌面上的车真的动起来。", handoff: "完成实物交付后，远征项目可以读取你的车的设计与制作摘要。数字模拟还不能代替这一步。" },
  { id: "expedition", level: 4, place: "远征指挥站", projects: ["run-an-expedition"],
    message: "一辆能动的车，还没有完成任务。这次由你定目标、布置现场、收集数据，再解释哪些结果支持你的方案。", handoff: "带着现场失效与修订经验，进入真实数据训练和自主系统工程。" },
  { id: "autonomy", level: 5, place: "自主工程中心", projects: ["mars-analog-rover"],
    message: "从真实 HiRISE 影像开始，让分类器上车，在自己的地面场景测试。你要交付数据、模型、控制和任务证据，也要说清模型在哪里失效。", handoff: "终点作品：用 NASA HiRISE 影像训练的火星类比探测车与完整工程记录。可与行星研究方向并行选择。" },
  { id: "planet-science", level: 5, place: "行星研究站", projects: ["lightkurve-transit-detective"],
    message: "如果你更想追问远方是什么，就走这条研究方向。从真实光变数据寻找线索，检查噪声与假象，把判断写成别人可以复查的报告。", handoff: "终点作品：可复现的行星候选信号研究。它与自主探测车是两条高阶方向，不互为必修先修。" },
] as const

export type JourneyStation = typeof JOURNEY_STATIONS[number]
export const JOURNEY_IDS: string[] = JOURNEY_STATIONS.flatMap(s => [...s.projects])
export function journeyStationFor(projectId: string) { return JOURNEY_STATIONS.find(s => (s.projects as readonly string[]).includes(projectId)) }
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
  return { id, title: local?.title.zh ?? full!.title_zh, href: local?.href ?? `/library/${id}`, outcome: local?.outcome.zh ?? full!.outcome,
    cover: local?.coverImage ?? full!.coverImage, micro: local?.kind === "micro", full: !local,
    duration: local ? `约 ${local.estimatedMinutes} 分钟 · ${local.learningNodes ? `${local.learningNodes} 个节点` : "直接操作"}` : "完整课程 · 可分阶段完成",
    preparation: local?.preparation?.zh, station: journeyStationFor(id)!,
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
