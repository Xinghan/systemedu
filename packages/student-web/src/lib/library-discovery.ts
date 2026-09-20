import type { LibraryProjectSummary } from "@/lib/api"
import type { Locale } from "@/lib/i18n/locales"
import { LOCAL_PROJECTS, PROJECT_LINES, lineForCourse, localized, type LocalProject } from "@/lib/project-lines/catalog"
import courseSnapshots from "@/lib/project-lines/course-snapshots.json"

export type DiscoveryEntry = {
  id: string
  kind: "micro" | "guided" | "integration" | "full"
  title: string
  domain: string
  difficulty: number | null
  available: boolean
  searchText: string
  publishedAt: number
  project?: LibraryProjectSummary
  local?: LocalProject
  priority?: number
  lineId?: string
  source?: "local" | "service" | "snapshot"
  coverImage?: string
}

export function discoveryLevel(entry: DiscoveryEntry): number {
  if (entry.kind === "micro") return 0
  if (entry.kind === "guided") return 1
  if (entry.kind === "integration") return 2
  if (entry.difficulty == null) return 7
  return entry.difficulty <= 2 ? 3 : entry.difficulty + 1
}

export function sortDiscoveryEntries(entries: DiscoveryEntry[], sort: string, locale: Locale) {
  return [...entries].sort((a, b) => discoveryLevel(a) - discoveryLevel(b)
    || (a.difficulty ?? 99) - (b.difficulty ?? 99)
    || Number(b.available) - Number(a.available)
    || (sort === "recent" ? b.publishedAt - a.publishedAt : 0)
    || (a.priority ?? 99) - (b.priority ?? 99)
    || a.title.localeCompare(b.title, locale))
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
  const merged = new Map<string, LibraryProjectSummary>(courseSnapshots.map(p => [p.slug, {
    ...p, status: "draft", final_outcomes: [{ title: p.outcome, kind: "capability", description: p.outcome }],
  }]))
  for (const project of projects) merged.set(project.slug, project)
  const serviceSlugs = new Set(projects.map(p => p.slug))
  const local: DiscoveryEntry[] = LOCAL_PROJECTS.map((project, priority) => ({
    id: project.id, kind: project.kind, title: localized(project.title, locale), domain: project.domains[0], difficulty: null,
    available: true, publishedAt: 0, local: project, priority, lineId: project.lineId, source: "local", coverImage: project.coverImage,
    searchText: [project.title.zh, project.title.en, project.action.zh, project.action.en, project.outcome.zh, project.outcome.en, ...PROJECT_LINES.filter(line => line.id === project.lineId).flatMap(line => [line.title.zh, line.title.en, ...line.aliases]), project.id === "spot-a-world" ? "astronomy 天文 月球 火星" : ""].join(" ").toLowerCase(),
  }))
  const full: DiscoveryEntry[] = [...merged.values()].map((project) => ({
    id: project.slug, kind: "full", title: locale === "zh" ? project.title_zh || project.title : project.title || project.title_zh || project.slug,
    domain: normalizeDomain(project.domain),
    difficulty: typeof project.difficulty === "number" && Number.isFinite(project.difficulty) && project.difficulty >= 1 && project.difficulty <= 5 ? project.difficulty : null,
    available: project.status !== "draft", publishedAt: Date.parse(project.published_at || "") || 0, project,
    lineId: lineForCourse(project.slug)?.id, source: serviceSlugs.has(project.slug) ? "service" : "snapshot",
    coverImage: serviceSlugs.has(project.slug) ? undefined : lineForCourse(project.slug)?.image,
    searchText: [project.title, project.title_zh, project.slug, project.domain, project.description, ...(project.tags || []), ...outcomeTitles(project), ...PROJECT_LINES.filter(line => line.courseSlugs.includes(project.slug)).flatMap(line => [line.title.zh, line.title.en, ...line.aliases])].filter(Boolean).join(" ").toLowerCase(),
  }))
  return [...local, ...full]
}
