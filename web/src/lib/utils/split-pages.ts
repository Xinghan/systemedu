/**
 * Split a markdown string into pages for slide-like reading.
 *
 * Strategy:
 * 1. If content has multiple markdown headings (#, ##, ###), split by headings.
 * 2. Otherwise, split by paragraph breaks (double newlines), grouping into
 *    pages of roughly PAGE_TARGET_CHARS each.
 * 3. Very short content (single paragraph, < target) stays as one page.
 */

const PAGE_TARGET_CHARS = 400

export function splitByHeadings(markdown: string): string[] {
  if (!markdown || !markdown.trim()) return [""]

  const trimmed = markdown.trim()

  // Try heading-based split first (supports #, ##, ###)
  const headingPages = splitByHeadingMarkers(trimmed)
  if (headingPages.length > 1) return headingPages

  // Fallback: split by paragraphs
  return splitByParagraphs(trimmed)
}

/** Split markdown by #, ## or ### headings into pages. */
function splitByHeadingMarkers(markdown: string): string[] {
  const lines = markdown.split("\n")
  const pages: string[] = []
  let currentPage: string[] = []

  for (const line of lines) {
    // Match #, ##, or ### at line start (but not #### or deeper)
    if (/^#{1,3}\s/.test(line)) {
      if (currentPage.length > 0) {
        const content = currentPage.join("\n").trim()
        if (content || pages.length > 0) {
          pages.push(content)
        }
      }
      currentPage = [line]
    } else {
      currentPage.push(line)
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n").trim())
  }

  if (pages.length === 0) return [markdown.trim()]

  // Remove empty first page (content before first heading that is empty)
  if (pages[0] === "" && pages.length > 1) {
    pages.shift()
  }

  return pages.length > 0 ? pages : [markdown.trim()]
}

/**
 * Split long markdown into pages by grouping paragraphs.
 * Each page targets ~PAGE_TARGET_CHARS characters.
 */
function splitByParagraphs(markdown: string): string[] {
  const trimmed = markdown.trim()

  // Split by double newlines (paragraph boundaries)
  const blocks = trimmed.split(/\n{2,}/).filter((b) => b.trim())

  // If only 1 block, can't split
  if (blocks.length <= 1) return [trimmed]

  const pages: string[] = []
  let currentPage: string[] = []
  let currentLen = 0

  for (const block of blocks) {
    const blockLen = block.length
    if (currentLen > 0 && currentLen + blockLen > PAGE_TARGET_CHARS) {
      pages.push(currentPage.join("\n\n").trim())
      currentPage = [block]
      currentLen = blockLen
    } else {
      currentPage.push(block)
      currentLen += blockLen
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n\n").trim())
  }

  return pages.length > 1 ? pages : [trimmed]
}
