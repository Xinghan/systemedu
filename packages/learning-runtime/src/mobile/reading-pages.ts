import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import type { RootContent } from "mdast"

export type ReadingPage = { id: string; section: string; markdown: string; fields?: { label: string; value: string }[]; row?: number; rows?: number }

/** Paginate syntax nodes, never split Markdown with a character-count/line regex. */
export function readingPages(source: string): ReadingPage[] {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(source)
  const pages: ReadingPage[] = []
  let section = "课文", sectionIndex = 0, index = 0
  const raw = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) => source.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0)
  // A GFM cell position includes its delimiter pipes. Child positions contain only
  // inline content, including original Markdown escapes, emphasis and link syntax.
  const cellText = (cell: { children: { position?: { start: { offset?: number }; end: { offset?: number } } }[] }) => cell.children.length ? source.slice(cell.children[0].position?.start.offset ?? 0, cell.children.at(-1)?.position?.end.offset ?? 0) : ""
  function push(markdown: string, extra: Partial<ReadingPage> = {}) { pages.push({ id: `s${sectionIndex}-p${++index}`, section, markdown, ...extra }) }
  function append(node: RootContent) {
    if (node.type === "heading") { section = node.children.map(raw).join(""); sectionIndex++; index = 0 }
    else if (node.type === "table") {
      const headers = node.children[0]?.children ?? []
      node.children.slice(1).forEach((row, i) => push("", { fields: headers.map((header, col) => ({ label: cellText(header), value: row.children[col] ? cellText(row.children[col]) : "" })), row: i + 1, rows: node.children.length - 1 }))
    } else if (node.type === "list") {
      node.children.forEach(item => push(raw(item)))
    } else if (node.type !== "definition" && node.type !== "thematicBreak") push(raw(node))
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
