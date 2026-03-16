/**
 * Split a markdown string into pages by ## or ### headings.
 *
 * Each heading starts a new page. Content before the first heading
 * becomes page 0 (if non-empty). Returns the original string as a
 * single-element array when no headings are found.
 */
export function splitByHeadings(markdown: string): string[] {
  if (!markdown || !markdown.trim()) return [""]

  // Split on lines that start with ## or ### (but not #### or deeper)
  const lines = markdown.split("\n")
  const pages: string[] = []
  let currentPage: string[] = []

  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      // This line is a ## or ### heading — start a new page
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

  // Push the last page
  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n").trim())
  }

  // Filter out empty leading pages (but keep at least one)
  if (pages.length === 0) return [markdown.trim()]

  // If the first page is empty (no content before first heading), remove it
  if (pages[0] === "" && pages.length > 1) {
    pages.shift()
  }

  return pages.length > 0 ? pages : [markdown.trim()]
}
