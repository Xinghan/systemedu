import type { DiscoveryEntry } from "./library-discovery"
import type { Locale } from "./i18n/locales"
import lines from "./project-lines/taxonomy-lines.json"
import assignments from "./project-lines/project-taxonomy.json"

export const FIELD_NAMES = {
  zh: { robotics: "机器人", aerospace: "航空航天", biomedicine: "新药", energy: "能源", environment: "环境", computing: "计算机与 AI", neuroscience: "脑科学" },
  en: { robotics: "Robotics", aerospace: "Aerospace", biomedicine: "Drug discovery", energy: "Energy", environment: "Environment", computing: "Computing & AI", neuroscience: "Brain science" },
} as const
export type ProjectField = keyof typeof FIELD_NAMES.zh
type Assignment = { primary: ProjectField; related: ProjectField[] }
const taxonomy = assignments as Record<string, Assignment>
const legacyFields: Record<string, string> = { bioscience: "biomedicine", climate: "environment", earth: "environment", bionics: "neuroscience" }

export function primaryProjectLine(projectId: string, fallbackLineId?: string) {
  const assignment = taxonomy[projectId]
  return lines.find(line => assignment ? line.fieldId === assignment.primary : line.id === fallbackLineId)
}

export function fieldName(field: string, locale: Locale) {
  return FIELD_NAMES[locale][field as ProjectField] || (locale === "zh" ? "其他领域" : "Other fields")
}

export function entryFields(entry: DiscoveryEntry): string[] {
  const assignment = taxonomy[entry.id]
  return assignment ? [assignment.primary, ...assignment.related] : [legacyFields[entry.domain] || entry.domain]
}

export function entryLineIds(entry: DiscoveryEntry): string[] {
  const fields = entryFields(entry)
  const ids = fields.flatMap(field => lines.filter(line => line.fieldId === field).map(line => line.id))
  return ids.length ? ids : entry.lineId ? [entry.lineId] : []
}

export function entryInLine(entry: DiscoveryEntry, lineId: string) { return entryLineIds(entry).includes(lineId) }
export function entryInField(entry: DiscoveryEntry, field: string) { return entryFields(entry).includes(field) }

/** Presentation taxonomy only: never change lesson URLs, course IDs or stored progress keys. */
export function classifyDiscoveryEntries(entries: DiscoveryEntry[]): DiscoveryEntry[] {
  return entries.map(entry => {
    const fields = entryFields(entry)
    const primaryLine = lines.find(line => line.fieldId === fields[0])
    const keywords = lines.filter(line => fields.includes(line.fieldId)).flatMap(line => [line.title.zh, line.title.en, line.domains.zh, line.domains.en, ...line.aliases])
    return { ...entry, domain: fields[0], lineId: primaryLine?.id || entry.lineId,
      searchText: [entry.searchText, ...fields.flatMap(field => [fieldName(field, "zh"), fieldName(field, "en")]), ...keywords].join(" ").toLowerCase() }
  })
}
