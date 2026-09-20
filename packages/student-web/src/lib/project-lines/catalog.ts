import type { Locale } from "@/lib/i18n/locales"
import lineData from "./lines.json"
import spaceCourses from "./space-courses.json"

export const PROJECT_LINES = lineData
export type ProjectLine = typeof PROJECT_LINES[number]
export const LINES_HREF = "/library?view=lines"
export function lineHref(id: string) { return `${LINES_HREF}&line=${encodeURIComponent(id)}` }
export function lineForCourse(slug: string) { return PROJECT_LINES.find(line => line.courseSlugs.includes(slug)) }

// 这里只登记已实现的入口；规划摘要不会混入可开始的项目列表。
export const SPACE_LINE = {
  id: "space-exploration",
  href: "/library?view=lines&line=space-exploration",
  flagshipSlug: "mars-analog-rover",
  firstProjectHref: "/explore/space-exploration/spot-a-world",
  title: { zh: "星际远征队", en: "Starbound Crew" },
} as const

export type LocalProject = {
  id: string; lineId: string; href: string; kind: "micro" | "guided" | "integration"; estimatedMinutes: number; learningNodes?: number;
  title: { zh: string; en: string }; action: { zh: string; en: string }; outcome: { zh: string; en: string };
  challenge: { zh: string; en: string }; startLabel: { zh: string; en: string }; domains: readonly string[]; coverImage?: string;
  preparation?: { zh: string; en: string };
}

export const MICRO_PROJECTS: readonly LocalProject[] = [{
  id: "spot-a-world",
  lineId: SPACE_LINE.id,
  href: SPACE_LINE.firstProjectHref,
  estimatedMinutes: 3,
  kind: "micro",
  title: { zh: "我的第一张星球照片", en: "My first photo of a world" },
  action: { zh: "移动望远镜，选择月球或火星，拍下属于你的构图。", en: "Move a telescope, find the Moon or Mars, and frame your own photo." },
  outcome: { zh: "一张自己的星球照片与观测记录", en: "Your own world photo and observation record" },
  domains: ["aerospace"],
  challenge: { zh: "拖动、选择、拍摄", en: "Move, choose, take a photo" },
  startLabel: { zh: "打开观测台", en: "Open the observatory" },
  coverImage: "/project-lines/space-exploration/spot-a-world/cover-ai.png",
}, {
  id: "land-a-probe", lineId: SPACE_LINE.id, kind: "micro", href: "/explore/space-exploration/land-a-probe", estimatedMinutes: 3,
  title: { zh: "把探测器稳稳送下去", en: "Bring a lander down safely" },
  action: { zh: "改变制动时机，观察下降、重试并比较两次着陆。", en: "Change when you brake, retry, and compare your landings." },
  outcome: { zh: "自己的着陆轨迹、操作回放与对比记录", en: "Your landing trajectories, controls, and comparison" },
  challenge: { zh: "观察速度、控制制动", en: "Watch the speed and brake" },
  startLabel: { zh: "开始着陆", en: "Try a landing" }, domains: ["aerospace"],
  coverImage: "/project-lines/space-exploration/land-a-probe/cover-ai.png",
}, {
  id: "drive-and-frame", lineId: SPACE_LINE.id, kind: "micro", href: "/explore/space-exploration/drive-and-frame", estimatedMinutes: 3,
  title: { zh: "开车找到观察点", en: "Drive to an observation point" },
  action: { zh: "选一个目标，驾驶探测车绕过岩石，调整镜头拍下地形。", en: "Choose a target, drive around rocks, and frame a terrain photo." },
  outcome: { zh: "自己驾驶的路线与亲手取景的地形照片", en: "Your own route and a terrain photo you framed" },
  challenge: { zh: "驾驶、绕行、取景", en: "Drive, navigate, frame" },
  startLabel: { zh: "开动探测车", en: "Drive the rover" }, domains: ["aerospace"],
  coverImage: "/project-lines/space-exploration/drive-and-frame/cover-ai.png",
}]

export const GUIDED_PROJECTS: readonly LocalProject[] = [{
  id: "write-driving-rules", lineId: SPACE_LINE.id, kind: "guided", href: "/explore/space-exploration/write-driving-rules", estimatedMinutes: 50, learningNodes: 4,
  title: { zh: "写出我的第一段驾驶规则", en: "Write my first driving rules" },
  action: { zh: "通过正文、参考资料与视频理解条件判断，再编写规则、对照测试并交付。", en: "Read, watch, write conditions, compare tests, and explain your driving rules." },
  outcome: { zh: "驾驶规则作品包：规则、双路线证据与说明", en: "A driving-rules bundle with tests and an explanation" },
  challenge: { zh: "理解、编写、检验、交付", en: "Edit a rule and test another route" },
  startLabel: { zh: "进入驾驶规则课程", en: "Start the driving rules course" }, domains: ["aerospace", "computing"],
  coverImage: "/project-lines/space-exploration/write-driving-rules/cover-ai.png",
}]
export const SPACE_COURSES: readonly LocalProject[] = spaceCourses.map(project => ({...project, kind: project.kind as "guided" | "integration"}))
export const LOCAL_PROJECTS = [...MICRO_PROJECTS, ...GUIDED_PROJECTS, ...SPACE_COURSES]

export type DiscoveryKind = "all" | "micro" | "guided" | "integration" | "full"

// 太空项目线本批规划已实现；其他主题规划留在 lines.json。
export const PLANNED_PROJECTS: Record<"guided" | "integration", { zh: string[]; en: string[] }> = {
  guided: {
    zh: [],
    en: [],
  },
  integration: {
    zh: [],
    en: [],
  },
}

export function localized(value: { zh: string; en: string }, locale: Locale) {
  return value[locale]
}
