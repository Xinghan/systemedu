/**
 * @typedef {"criteria" | "stage_product" | "artifacts" | "self_check" | "handoff" | "guide" | "other"} CapstoneBlockType
 * @typedef {{ heading: string, body: string }} CapstoneCard
 * @typedef {{ type: CapstoneBlockType, title: string, cards: CapstoneCard[], body: string }} CapstoneBlock
 */

/** @param {string} title @returns {CapstoneBlockType} */
export function classifyCapstoneSection(title) {
  if (/阶段作品/.test(title)) return "stage_product"
  if (/交付物/.test(title)) return "artifacts"
  if (/自检清单/.test(title)) return "self_check"
  if (/下一关会用到它/.test(title)) return "handoff"
  if (/考核要点|评分标准/.test(title)) return "criteria"
  if (/自评|写作指引/.test(title)) return "guide"
  return "other"
}

/**
 * Turn simple child-facing markdown lists into card rows.  It deliberately
 * keeps the text intact instead of trying to interpret a child's evidence.
 *
 * @param {string} body
 * @returns {CapstoneCard[]}
 */
function listCards(body) {
  const cards = []
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/)
    if (!match) continue
    const item = match[1].trim()
    if (!item) continue
    const richMatch = item.match(/^\*\*(.+?)\*\*[：:]?\s*(.*)$/)
    cards.push({
      heading: (richMatch ? richMatch[1] : item).replace(/^`|`$/g, "").trim(),
      body: richMatch?.[2]?.trim() || "",
    })
  }
  return cards
}

/**
 * @param {string} body
 * @returns {CapstoneCard[]}
 */
function legacyChecklistCards(body) {
  const cards = []
  const parts = body.split(/(?=\*\*交付物[：:])|(?=### )/)
  for (const part of parts) {
    const trimmed = part.replace(/^---\s*\n?/, "").trim()
    if (!trimmed) continue
    const headMatch = trimmed.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)/)
      || trimmed.match(/^###\s+(.+?)\n([\s\S]*)/)
    if (headMatch) {
      cards.push({ heading: headMatch[1], body: headMatch[2].trim() })
    } else {
      cards.push({ heading: "", body: trimmed })
    }
  }
  return cards
}

/**
 * Parse capstone-assignment markdown into display blocks.  The four stage
 * contract sections have dedicated types; older capstones retain their
 * existing criteria/checklist rendering.
 *
 * @param {string} markdown
 * @returns {CapstoneBlock[]}
 */
export function parseCapstoneBlocks(markdown) {
  const blocks = []
  const sections = String(markdown || "").split(/^## /m).filter(Boolean)

  for (const section of sections) {
    const firstNewline = section.indexOf("\n")
    const title = firstNewline >= 0 ? section.slice(0, firstNewline).trim() : section.trim()
    const body = firstNewline >= 0 ? section.slice(firstNewline + 1).trim() : ""
    const type = classifyCapstoneSection(title)

    if (type === "criteria") {
      const cards = []
      const parts = body.split(/(?=\*\*标准\s*\d+[：:])/)
      for (const part of parts) {
        const trimmed = part.replace(/^---\s*\n?/, "").trim()
        if (!trimmed) continue
        const headMatch = trimmed.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)/)
        cards.push(headMatch
          ? { heading: headMatch[1], body: headMatch[2].trim() }
          : { heading: "", body: trimmed })
      }
      blocks.push({ type, title, cards, body: "" })
      continue
    }

    if (type === "artifacts" || type === "self_check") {
      const cards = listCards(body)
      blocks.push({ type, title, cards: cards.length > 0 ? cards : legacyChecklistCards(body), body: "" })
      continue
    }

    blocks.push({ type, title, cards: [], body })
  }

  return blocks
}
