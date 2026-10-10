import type { CourseContent, SlideEntry } from "./types/api"

export type LessonSlot = `theory:${string}` | `idea:${string}` | `section:${string}` | "intro" | "outro" | "supplement"

/** Preserve fenced code verbatim while recognizing actual lesson placeholders. */
export function splitLessonParts(markdown: string): string[] {
  const parts: string[] = []
  let text = ""
  let fence: { character: string; length: number } | null = null
  for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fence) {
      text += line
      if (new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`).test(line)) fence = null
    } else if (marker) {
      fence = { character: marker[1][0], length: marker[1].length }
      text += line
    } else {
      for (const fragment of line.split(/(\[\[(?:IDEA|THEORY):[^\]]+\]\])/g)) {
        if (/^\[\[(?:IDEA|THEORY):[^\]]+\]\]$/.test(fragment)) {
          if (text) parts.push(text)
          parts.push(fragment); text = ""
        } else text += fragment
      }
    }
  }
  if (text) parts.push(text)
  return parts
}

export function firstMarkerSections(sections: NonNullable<CourseContent["sections"]>) {
  const owners = new Map<string, number>()
  sections.forEach((section, index) => {
    for (const part of splitLessonParts(section.body_markdown)) {
      if (/^\[\[(?:IDEA|THEORY):[^\]]+\]\]$/.test(part) && !owners.has(part)) owners.set(part, index)
    }
  })
  return owners
}

/** Match explicit source identifiers only. No title similarity or index guessing. */
export function buildLessonSlideLayout(content: CourseContent, slides: SlideEntry[]) {
  const markdown = content.sections?.length
    ? content.sections.map(s => s.body_markdown).join("\n")
    : content.plan_markdown || ""
  const available = new Set<LessonSlot>()
  for (const part of splitLessonParts(markdown)) {
    const match = part.match(/^\[\[(THEORY|IDEA):([^\]]+)\]\]$/)
    if (match) available.add(`${match[1].toLowerCase()}:${match[2]}` as LessonSlot)
  }
  for (const section of content.sections || []) available.add(`section:${section.section_id}`)
  const aliases = new Map<string, string>()
  for (const idea of content.ideas || []) {
    if (available.has(`idea:${idea.idea_id}`)) aliases.set(idea.idea_id, idea.idea_id)
    else if (idea.topic && available.has(`idea:${idea.topic}`)) aliases.set(idea.idea_id, idea.topic)
  }
  const slots = new Map<LessonSlot, number[]>()
  slides.forEach((slide, index) => {
    const source = slide.lesson_anchor
      || (slide.payload.theory_id ? { kind: "theory", id: slide.payload.theory_id } : undefined)
      || (slide.payload.idea_id ? { kind: "idea", id: slide.payload.idea_id } : undefined)
    let slot: LessonSlot = slide.kind === "intro" ? "intro" : slide.kind === "outro" ? "outro" : "supplement"
    if (source) {
      const id = source.kind === "idea" ? aliases.get(source.id) || source.id : source.id
      const explicit = `${source.kind}:${id}` as LessonSlot
      // A broken explicit association must remain supplemental, not be guessed.
      slot = available.has(explicit) ? explicit : "supplement"
    }
    const entries = slots.get(slot) || []
    slots.set(slot, [...entries, index])
  })
  return slots
}

/** This slide reuses precisely the activity already rendered in the article. */
export function isSharedActivitySlide(slide: SlideEntry) {
  return (slide.kind === "animation" || slide.kind === "game")
    && !!slide.payload.idea_id && !slide.payload.technical_visual
}
