/**
 * Split a markdown string into pages.
 *
 * Strategy:
 * 1. If the content has multiple ## or ### headings, split by headings.
 * 2. Otherwise, split by double-newline paragraph breaks,
 *    grouping paragraphs to fill ~800 chars per page.
 * 3. Single short content (< 800 chars, no headings) stays as one page.
 */

const PAGE_TARGET_CHARS = 800

export function splitByHeadings(markdown: string): string[] {
  if (!markdown || !markdown.trim()) return [""]

  // First try heading-based split
  const headingPages = splitByHeadingMarkers(markdown)
  if (headingPages.length > 1) return headingPages

  // Fallback: split by paragraphs if content is long
  return splitByParagraphs(markdown)
}

/** Split markdown by ## or ### headings into pages. */
function splitByHeadingMarkers(markdown: string): string[] {
  const lines = markdown.split("\n")
  const pages: string[] = []
  let currentPage: string[] = []

  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
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

  if (pages[0] === "" && pages.length > 1) {
    pages.shift()
  }

  return pages.length > 0 ? pages : [markdown.trim()]
}

/**
 * Split long markdown into pages by grouping paragraphs.
 * Each page targets ~PAGE_TARGET_CHARS characters.
 * Never breaks in the middle of a paragraph or code block.
 */
function splitByParagraphs(markdown: string): string[] {
  const trimmed = markdown.trim()
  if (trimmed.length <= PAGE_TARGET_CHARS) return [trimmed]

  // Split by double newlines (paragraph boundaries)
  const blocks = trimmed.split(/\n{2,}/)
  const pages: string[] = []
  let currentPage: string[] = []
  let currentLen = 0

  for (const block of blocks) {
    const blockLen = block.length
    // If adding this block exceeds target and page is non-empty, start new page
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

  // If we only got 1 page from paragraph splitting, return as-is (no pagination)
  return pages.length > 1 ? pages : [trimmed]
}
