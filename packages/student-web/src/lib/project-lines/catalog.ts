import type { Locale } from "@/lib/i18n/locales"

// 这里只登记已实现的入口；规划摘要不会混入可开始的项目列表。
export const SPACE_LINE = {
  id: "space-exploration",
  href: "/library?view=lines",
  flagshipSlug: "mars-analog-rover",
  firstProjectHref: "/explore/space-exploration/spot-a-world",
  title: { zh: "太空探索", en: "Space exploration" },
} as const

export type LocalProject = {
  id: string; lineId: string; href: string; kind: "micro" | "guided"; estimatedMinutes: number;
  title: { zh: string; en: string }; action: { zh: string; en: string }; outcome: { zh: string; en: string };
  challenge: { zh: string; en: string }; startLabel: { zh: string; en: string }; domains: readonly string[]; coverImage?: string;
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
  id: "write-driving-rules", lineId: SPACE_LINE.id, kind: "guided", href: "/explore/space-exploration/write-driving-rules", estimatedMinutes: 15,
  title: { zh: "写出我的第一段驾驶规则", en: "Write my first driving rules" },
  action: { zh: "修改地形到动作的规则，在两条路线检验，遇到未知地面先停下求助。", en: "Edit terrain-to-action rules, test two routes, and stop for unknown terrain." },
  outcome: { zh: "可运行的驾驶规则与两条路线的测试记录", en: "Runnable driving rules and tests on two routes" },
  challenge: { zh: "改一条规则、换路验证", en: "Edit a rule and test another route" },
  startLabel: { zh: "打开规则工作台", en: "Open the rule workbench" }, domains: ["aerospace", "computing"],
  coverImage: "/project-lines/space-exploration/write-driving-rules/cover-ai.png",
}]
export const LOCAL_PROJECTS = [...MICRO_PROJECTS, ...GUIDED_PROJECTS]

export type DiscoveryKind = "all" | "micro" | "guided" | "integration" | "full"

// 来源：systemeduidea/project_lines/space-exploration/line.json，均未开放。
export const PLANNED_PROJECTS: Record<"guided" | "integration", { zh: string[]; en: string[] }> = {
  guided: {
    zh: ["为远征选择观察地点", "设计一次运载方案", "改造我的越野底盘", "给探测车制作地形样本"],
    en: ["Choose an observation site", "Design a payload plan", "Improve an off-road chassis", "Label terrain for a rover"],
  },
  integration: {
    zh: ["组装我的第一辆自主探测车", "完成我的第一次火星远征"],
    en: ["Assemble my first autonomous rover", "Complete my first Mars expedition"],
  },
}

export function localized(value: { zh: string; en: string }, locale: Locale) {
  return value[locale]
}
