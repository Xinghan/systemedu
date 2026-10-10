import type { SlideEntry, SlidePayload } from "@/lib/types/api"

/** Preserve the two course-file schemas at the player boundary. */
export function normalizeSlides(value: unknown, moduleId: string): SlideEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const raw = item as Partial<SlideEntry>
    const payload = raw.payload && typeof raw.payload === "object"
      ? raw.payload as SlidePayload & { title?: string; subtitle?: string }
      : {}
    const cards = Array.isArray(payload.concept_cards) ? payload.concept_cards.map((card) => {
      const legacy = card as typeof card & { label?: string; text?: string }
      return { ...card, title: card.title || legacy.label || "", body: card.body || legacy.text || "" }
    }) : undefined
    return [{
      ...raw,
      slide_id: raw.slide_id || `${moduleId}-slide-${index + 1}`,
      slide_index: index,
      kind: raw.kind || "bullet",
      title: raw.title || payload.title || payload.hero_title || `Slide ${index + 1}`,
      body_markdown: raw.body_markdown || "",
      audio_script: raw.audio_script || "",
      generated_at: raw.generated_at || null,
      payload: {
        ...payload,
        hero_subtitle: payload.hero_subtitle || payload.subtitle,
        concept_cards: cards,
      },
    }]
  })
}
