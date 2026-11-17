import { useEffect, useState } from "react"
import { List, NotebookPen, BookOpen, ArrowUpRight } from "lucide-react"
import { LessonMarkdown } from "../lesson-markdown"
import type { Snapshot } from "../host"
import fixture from "../../../learning-contracts/fixtures/driving-intro.json"
import { readingPages } from "./reading-pages"
import { Pager, Sheet } from "./primitives"

const pages = readingPages(fixture.module.lesson)
const sections = [...new Set(pages.map(page => page.section))]
// Short display headings fit a phone; the source headings remain in the contents.
const headings: Record<string, string> = {
  "从你开车，到车自己作决定": "让程序决定下一步动作",
  "先认识这间实验室的四种输入": "认识四种地形输入",
  "用资料补上真正的世界": "对照真实的探测任务",
  "留下一份自己的观察表": "写下你的驾驶判断",
}

export function MobileReader({ initial, onChange }: { initial: Snapshot; onChange: (state: Snapshot) => void }) {
  const [index, setIndex] = useState(() => Math.max(0, pages.findIndex(page => page.id === initial.reader_page)))
  const [note, setNote] = useState(typeof initial.note === "string" ? initial.note : "")
  const [panel, setPanel] = useState<"contents" | "note" | "sources" | null>(null)
  const page = pages[index], sectionIndex = sections.indexOf(page.section)
  useEffect(() => { onChange({ note, reader_page: page.id }) }, [note, page.id, onChange])
  return <div className="mobile-reader">
    <header className="reading-heading"><button onClick={() => setPanel("contents")} aria-label="打开课文目录"><List size={17}/><span>M01 · 先看路，再决定</span></button><span>{sectionIndex + 1} / {sections.length} 节</span></header>
    <div className="section-progress" aria-hidden="true">{sections.map((section, i) => <span key={section} data-active={i <= sectionIndex}/>)}</div>
    <article className="reading-card" key={page.id} data-reading-page={page.id} aria-label={`课文第 ${index + 1} 页`} tabIndex={0}>
      <p className="overline">{page.fields ? `逐项对照 · ${page.row} / ${page.rows}` : `阅读 · ${String(index + 1).padStart(2, "0")}`}</p>
      <h1>{headings[page.section] ?? page.section}</h1>
      {page.fields ? <dl className="comparison-card">{page.fields.map((field, i) => <div key={i}><dt><LessonMarkdown>{field.label}</LessonMarkdown></dt><dd><LessonMarkdown>{field.value || "—"}</LessonMarkdown></dd></div>)}</dl> : <div className="reading-prose"><LessonMarkdown>{page.markdown}</LessonMarkdown></div>}
      {index === pages.length - 1 && <button className="wide-button" onClick={() => setPanel("note")}>写下我的判断<NotebookPen size={17}/></button>}
    </article>
    <div className="reader-controls"><Pager index={index} count={pages.length} onChange={setIndex}/><div className="reader-actions"><button aria-label={note ? "我的笔记" : "记笔记"} onClick={() => setPanel("note")}><NotebookPen size={18}/>{note ? "我的笔记" : "记笔记"}</button><button aria-label="本节资料" onClick={() => setPanel("sources")}><BookOpen size={18}/>本节资料</button></div></div>
    {panel === "contents" && <Sheet title="本节阅读路径" onClose={() => setPanel(null)}><p>{fixture.module.core_question}</p><div className="contents-list">{sections.map((section, i) => <button key={section} aria-current={section === page.section ? "step" : undefined} onClick={() => { setIndex(pages.findIndex(page => page.section === section)); setPanel(null) }}><span>0{i + 1}</span><strong>{section}</strong><ArrowUpRight size={17}/></button>)}</div><p className="muted">每次只读一个要点。阅读位置和笔记保存在本机。</p></Sheet>}
    {panel === "note" && <Sheet title="我的阅读笔记" onClose={() => setPanel(null)}><label className="note-label" htmlFor="reading-note">看不清路面时，你还需要什么信息？</label><textarea id="reading-note" value={note} maxLength={20000} placeholder="写下你的观察和建议动作。" onChange={event => setNote(event.target.value)}/><p className="muted">笔记自动保存在本机；当前预览不会提交课程作业。</p></Sheet>}
    {panel === "sources" && <Sheet title="本节资料" onClose={() => setPanel(null)}><p className="muted">课文可以离线阅读，打开外部资料需要网络。</p><div className="resource-list">{fixture.module.resources.map(item => <div key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a><p>{item.purpose}</p></div>)}</div></Sheet>}
  </div>
}
