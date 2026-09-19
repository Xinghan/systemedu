import type { LibraryProjectSummary } from "@/lib/api"
import type { Locale } from "@/lib/i18n/locales"
import { LOCAL_PROJECTS, localized, type LocalProject } from "@/lib/project-lines/catalog"

export type DiscoveryEntry = {
  id: string
  kind: "micro" | "guided" | "full"
  title: string
  domain: string
  difficulty: number | null
  available: boolean
  searchText: string
  publishedAt: number
  project?: LibraryProjectSummary
  local?: LocalProject
  priority?: number
}

export function normalizeDomain(raw?: string | null): string {
  const value = (raw || "").toLowerCase()
  if (/climat|environment|气候|环境/.test(value)) return "climate"
  if (/aero|space|航天|太空/.test(value)) return "aerospace"
  if (/bio|生物/.test(value)) return "bioscience"
  if (/robot|机械|机器人/.test(value)) return "robotics"
  if (/material|材料/.test(value)) return "materials"
  if (/energy|能源/.test(value)) return "energy"
  if (/comput|^ai$|计算|人工智能/.test(value)) return "computing"
  return "other"
}

// 部分旧课程的 final_outcomes 仍是字符串数组，先归一化再用于展示和搜索。
export function outcomeTitles(project: LibraryProjectSummary): string[] {
  if (!Array.isArray(project.final_outcomes)) return []
  return project.final_outcomes.flatMap((outcome: unknown) => {
    if (typeof outcome === "string") return [outcome]
    if (outcome && typeof outcome === "object" && "title" in outcome && typeof outcome.title === "string") return [outcome.title]
    return []
  })
}

export function displayOutcome(project: LibraryProjectSummary): string | null {
  const outcomes: unknown[] = Array.isArray(project.final_outcomes) ? project.final_outcomes : []
  const capability = outcomes.find((outcome) => outcome && typeof outcome === "object" && "kind" in outcome && outcome.kind === "capability")
  if (capability && typeof capability === "object" && "title" in capability && typeof capability.title === "string") return capability.title
  return outcomeTitles(project)[0] || null
}

export function makeDiscoveryEntries(projects: LibraryProjectSummary[], locale: Locale): DiscoveryEntry[] {
  const local: DiscoveryEntry[] = LOCAL_PROJECTS.map((project, priority) => ({
    id: project.id, kind: project.kind, title: localized(project.title, locale), domain: "aerospace", difficulty: null,
    available: true, publishedAt: 0, local: project, priority,
    searchText: [project.title.zh, project.title.en, project.action.zh, project.action.en, project.outcome.zh, project.outcome.en, "太空探索 space exploration", project.id === "spot-a-world" ? "astronomy 天文 月球 火星" : ""].join(" ").toLowerCase(),
  }))
  const full: DiscoveryEntry[] = projects.map((project) => ({
    id: project.slug, kind: "full", title: locale === "zh" ? project.title_zh || project.title : project.title || project.title_zh || project.slug,
    domain: normalizeDomain(project.domain),
    difficulty: typeof project.difficulty === "number" && Number.isFinite(project.difficulty) && project.difficulty >= 1 && project.difficulty <= 5 ? project.difficulty : null,
    available: project.status !== "draft", publishedAt: Date.parse(project.published_at || "") || 0, project,
    searchText: [project.title, project.title_zh, project.slug, project.domain, project.description, ...(project.tags || []), ...outcomeTitles(project), project.slug === "mars-analog-rover" ? "太空探索 space exploration" : ""].filter(Boolean).join(" ").toLowerCase(),
  }))
  return [...local, ...full]
}
