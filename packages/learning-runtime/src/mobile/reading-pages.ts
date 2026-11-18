import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import type { RootContent } from "mdast"

export type ReadingPage = { id: string; section: string; markdown: string; sourceIndex: number; fields?: { label: string; value: string }[]; row?: number; rows?: number }

/** Prefer a stable paragraph bookmark; older records contain only a source page index. */
export function restoreReadingPage(pages: ReadingPage[], pageId: unknown, pageIndex: unknown = 0): number {
  const bookmarked = typeof pageId === 'string' ? pages.findIndex(page => page.id === pageId) : -1
  if (bookmarked >= 0) return bookmarked
  const saved = Number(pageIndex)
  const sourceIndex = Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0
  const next = pages.findIndex(page => page.sourceIndex >= sourceIndex)
  return next >= 0 ? next : Math.max(0, pages.length - 1)
}

/** Paginate syntax nodes, never split Markdown with a character-count/line regex. */
export function readingPages(source: string): ReadingPage[] {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(source)
  const pages: ReadingPage[] = []
  let section = "课文", sectionIndex = 0, index = 0
  let sourceIndex = 0, inPreface = true
  const raw = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) => source.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0)
  // A GFM cell position includes its delimiter pipes. Child positions contain only
  // inline content, including original Markdown escapes, emphasis and link syntax.
  const cellText = (cell: { children: { position?: { start: { offset?: number }; end: { offset?: number } } }[] }) => cell.children.length ? source.slice(cell.children[0].position?.start.offset ?? 0, cell.children.at(-1)?.position?.end.offset ?? 0) : ""
  function push(markdown: string, extra: Partial<ReadingPage> = {}, visible = true) {
    // Reserve the old identity even for a hidden authoring block. Removing one
    // must not move the bookmarks of all the paragraphs that follow it.
    const page = { id: `s${sectionIndex}-p${++index}`, sourceIndex: sourceIndex++, section, markdown, ...extra }
    if (!visible) return
    pages.push(page)
    inPreface = false
  }
  function append(node: RootContent) {
    if (node.type === "heading") { section = node.children.map(raw).join(""); sectionIndex++; index = 0 }
    else if (node.type === "table") {
      const headers = node.children[0]?.children ?? []
      node.children.slice(1).forEach((row, i) => push("", { fields: headers.map((header, col) => ({ label: cellText(header), value: row.children[col] ? cellText(row.children[col]) : "" })), row: i + 1, rows: node.children.length - 1 }))
    } else if (node.type === "list") {
      node.children.forEach(item => push(raw(item), {}, item.children.length > 0))
    } else if (node.type !== "definition" && node.type !== "thematicBreak") {
      const markdown = raw(node)
      const label = markdown.replace(/^ {0,3}>\s?/gm, '').trim()
      const moduleLabel = inPreface && (node.type === 'paragraph' || node.type === 'blockquote') &&
        /^(?:\*\*)?Module(?:\*\*)?\s*[:：]\s*M\d+[a-z]?(?:\*\*)?(?:\s*[·|｜]\s*[^\n]+)?$/i.test(label)
      const invisible = node.type === 'html' && !markdown.replace(/<!--[\s\S]*?-->/g, '').trim() ||
        node.type === 'blockquote' && node.children.length === 0
      push(markdown, {}, !moduleLabel && !invisible)
    }
  }
  tree.children.forEach(append)
  // Preserve reference-style links in each independently rendered page.
  const definitions = tree.children.filter(node => node.type === "definition").map(raw).join("\n")
  if (definitions) for (const page of pages) {
    page.markdown += `\n\n${definitions}`
    page.fields?.forEach(field => { field.label += `\n\n${definitions}`; field.value += `\n\n${definitions}` })
  }
  return pages
}
