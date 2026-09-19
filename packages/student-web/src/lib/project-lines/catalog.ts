import type { Locale } from "@/lib/i18n/locales"

// 这里只登记已实现的入口；规划摘要不会混入可开始的项目列表。
export const SPACE_LINE = {
  id: "space-exploration",
  href: "/library?view=lines",
  flagshipSlug: "mars-analog-rover",
  firstProjectHref: "/explore/space-exploration/spot-a-world",
  title: { zh: "太空探索", en: "Space exploration" },
} as const

export const MICRO_PROJECTS = [{
  id: "spot-a-world",
  lineId: SPACE_LINE.id,
  href: SPACE_LINE.firstProjectHref,
  estimatedMinutes: 3,
  title: { zh: "我的第一张星球照片", en: "My first photo of a world" },
  action: { zh: "移动望远镜，选择月球或火星，拍下属于你的构图。", en: "Move a telescope, find the Moon or Mars, and frame your own photo." },
  outcome: { zh: "一张自己的星球照片与观测记录", en: "Your own world photo and observation record" },
  domains: ["aerospace"],
}] as const

export type MicroProject = typeof MICRO_PROJECTS[number]
export type DiscoveryKind = "all" | "micro" | "guided" | "integration" | "full"

// 来源：systemeduidea/project_lines/space-exploration/line.json，均未开放。
export const PLANNED_PROJECTS: Record<"guided" | "integration", { zh: string[]; en: string[] }> = {
  guided: {
    zh: ["为远征选择观察地点", "设计一次运载方案", "改造我的越野底盘", "给探测车制作地形样本", "写出我的第一段驾驶规则"],
    en: ["Choose an observation site", "Design a payload plan", "Improve an off-road chassis", "Label terrain for a rover", "Write a first driving rule"],
  },
  integration: {
    zh: ["组装我的第一辆自主探测车", "完成我的第一次火星远征"],
    en: ["Assemble my first autonomous rover", "Complete my first Mars expedition"],
  },
}

export function localized(value: { zh: string; en: string }, locale: Locale) {
  return value[locale]
}
