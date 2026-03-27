/**
 * Project icon library lookup.
 * Uses pre-built Tabler Icons JSON (MIT licensed) stored in icon-library.json.
 * Matches project title + category + description against icon tags.
 * Falls back to CategoryIcon if no match found.
 */
import iconLibrary from "./icon-library.json"

type IconEntry = { svg: string; tags: string[] }
const LIBRARY = iconLibrary as Record<string, IconEntry>

/** Category → preferred icon names (ordered by priority) */
const CATEGORY_PREFERRED: Record<string, string[]> = {
  math:      ["math-function", "math-integral", "math-pi", "math-symbols", "calculator", "geometry", "infinity"],
  physics:   ["atom", "wave-sine", "magnet", "bolt", "radioactive", "circuit-resistor", "prism-light"],
  chemistry: ["flask", "atom", "molecule", "dna", "microscope", "biohazard"],
  biology:   ["dna", "microscope", "brain", "spiral", "virus", "leaf"],
  cs:        ["cpu", "code", "robot", "topology-complex", "drone", "brain"],
  ai:        ["brain", "cpu", "robot", "topology-star", "cpu-2"],
  aerospace: ["rocket", "satellite", "planet", "telescope", "comet", "moon"],
  robotics:  ["robot", "drone", "engine", "cpu", "gear"],
  energy:    ["solar-panel", "wind", "bolt", "windmill", "battery", "bulb"],
  climate:   ["wind", "sun", "leaf", "solar-panel", "windmill"],
  music:     ["wave-sine", "spiral"],
  biotech:   ["dna", "microscope", "flask", "virus", "brain"],
  other:     ["atom", "bulb", "compass", "school", "diamond"],
}

/** Score an icon against a text query */
function scoreIcon(iconName: string, entry: IconEntry, query: string): number {
  const q = query.toLowerCase()
  let score = 0
  for (const tag of entry.tags) {
    if (q.includes(tag)) score += 3
    if (tag.includes(q) || q.includes(tag.slice(0, 4))) score += 1
  }
  if (q.includes(iconName.replace(/-/g, " "))) score += 5
  return score
}

/**
 * Find best icon SVG for a project.
 * Returns SVG string (already sized for 24x24), or null if no match.
 */
export function findProjectIcon(
  title: string,
  category: string,
  description: string,
): string | null {
  const query = `${title} ${description}`.toLowerCase()

  // 1. Try category preferred list first
  const preferred = CATEGORY_PREFERRED[category] ?? CATEGORY_PREFERRED.other
  for (const name of preferred) {
    if (LIBRARY[name]) return colorizeIcon(LIBRARY[name].svg)
  }

  // 2. Score all icons against the text query
  let best: { name: string; score: number } | null = null
  for (const [name, entry] of Object.entries(LIBRARY)) {
    const score = scoreIcon(name, entry, query)
    if (score > 0 && (!best || score > best.score)) {
      best = { name, score }
    }
  }
  if (best) return colorizeIcon(LIBRARY[best.name].svg)

  // 3. Fallback: first item of category preferred
  const fallback = preferred[0]
  if (fallback && LIBRARY[fallback]) return colorizeIcon(LIBRARY[fallback].svg)

  return null
}

/**
 * Apply brand color (#7c3aed) to the icon SVG.
 * Tabler uses currentColor — we set it directly.
 */
function colorizeIcon(svg: string): string {
  return svg
    .replace(/stroke="currentColor"/g, 'stroke="#7c3aed"')
    .replace(/fill="currentColor"/g, 'fill="#7c3aed"')
    .replace(/<svg /, '<svg class="w-6 h-6" ')
}
