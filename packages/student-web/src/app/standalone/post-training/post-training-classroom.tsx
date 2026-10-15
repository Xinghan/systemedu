"use client"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Code2, Download, Play, Upload, X } from "lucide-react"
import { CourseReadingBody } from "@/components/learning/course-content-view"
import { LessonSlidesProvider, LessonSlideshowButton } from "@/components/learning/lesson-slides"
import { createRecordStore, COURSE_ID, isRecord, type ModuleId, type RecordData } from "./record"
import { AlgorithmLab } from "./algorithm-lab"
import { ALGORITHMS } from "./algorithm-catalog"
import { ConceptLab } from "./labs"
import type { CourseModule } from "./types"
import s from "./post-training.module.css"

export function PostTrainingClassroom({ modules, moduleId, markdown }: { modules: CourseModule[]; moduleId: ModuleId; markdown: string }) {
  const current = modules.find(m => m.id === moduleId)!
  const index = modules.findIndex(m => m.id === moduleId)
  const store = useMemo(() => createRecordStore(), [])
  const { record, ready, message } = useSyncExternalStore(store.subscribe, store.snapshot, store.serverSnapshot)
  const [video, setVideo] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState("")
  const [pending, setPending] = useState<RecordData | null>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { store.start() }, [store])
  const node = record.nodes[moduleId]
  const updateNode = (patch: Partial<typeof node>) => store.update({ ...record, nodes: { ...record.nodes, [moduleId]: { ...node, ...patch } } })
  const content = { plan_markdown: markdown.replace(/\[\[LAB(?::[a-z0-9]+)?\]\]/g, ""), ideas: [], rendered_sections: {} }
  const done = modules.filter(m => m.checklist.every((_,i) => record.nodes[m.id].checks[i])).length
  async function importFile(selected?: File) {
    if (!selected) return
    try {
      if (selected.size > 200_000) throw new Error("too large")
      const value: unknown = JSON.parse(await selected.text())
      if (!isRecord(value)) throw new Error("unknown schema")
      setPending(value); setImportMessage("文件已验证。确认后将恢复五个节点的笔记、自查和实验参数。")
    } catch { setImportMessage("无法导入：需要本课程 v2 导出的 JSON（200 KB以内）。当前记录保持不变。") }
    if (file.current) file.current.value = ""
  }
  const nav = <nav aria-label="课程节点">{modules.map((m,i) => <Link key={m.id} href={`/standalone/post-training/${m.id}`} className={moduleId === m.id ? s.currentNode : ""} aria-current={moduleId === m.id ? "page" : undefined}><span className={s.nodeNumber}>{m.checklist.every((_,j) => record.nodes[m.id].checks[j]) ? <Check size={16} /> : `0${i+1}`}</span><span><strong>{m.short}</strong><small>{m.duration}</small></span><ChevronRight size={14} /></Link>)}</nav>
  return <div className={s.page}>
    <a href="#lesson" className={s.skip}>跳到正文</a>
    <LessonSlidesProvider content={content} slides={current.slides} projectName={COURSE_ID} moduleId={moduleId} title={current.title} currentIndex={node.slide} onIndexChange={slide => updateNode({ slide })}>
      <header className={s.topbar}><Link href="/standalone/post-training/M01" className={s.wordmark}><Code2 size={23} /><strong>POST / TRAIN</strong><span>专业课程</span></Link><a className={s.headerDownload} href="/standalone/post-training/ticketlab-course.zip" download><Download size={15} /><span>下载课程与实验仓库</span></a></header>
      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.courseLabel}>ENGINEERING SERIES / 001</div><h2>LLM<br />后训练工程</h2><p className={s.sidebarIntro}>从训练目标到可复现的<br />参数高效适配实验。</p>
          <div className={s.progress}><span>{done} / 5 节已自查</span><div><i style={{ width: `${done/5*100}%` }} /></div></div>
          {nav}
          <div className={s.sidebarFoot}><span>PREREQUISITES</span><p>Python · 向量与矩阵<br />梯度基础随课补充</p><Link href="/standalone/post-training/M05#lesson">环境、项目与验收 <ArrowUpRight size={14} /></Link></div>
        </aside>
        <main className={s.main}>
          <details className={s.mobileNav}><summary>课程目录 <span>{moduleId} / 05</span></summary>{nav}</details>
          <div className={s.breadcrumb}>LLM 后训练工程 <ChevronRight size={13} /> <span>节点 0{index+1}</span></div>
          <section className={s.hero}>
            <p className={s.eyebrow}>{current.eyebrow}</p><h1>{current.title}</h1><p className={s.lead}>{current.description}</p>
            <div className={s.heroMeta}><span><BookOpen size={14} />{current.duration}</span><span><Code2 size={14} />{current.deliverable}</span></div>
            <div className={s.heroActions}><a href="#lesson" className={s.primary}>进入正文 <ArrowDown size={15} /></a><LessonSlideshowButton /><a href="#videos" className={s.textLink}>YouTube 索引 <ArrowUpRight size={14} /></a></div>
            <div className={s.pathStrip}>{["定位方法", "训练循环", "低秩更新", "量化适配", "实验交付"].map((x,i) => <span key={x} className={i === index ? s.pathActive : ""}><small>0{i+1}</small>{x}</span>)}</div>
          </section>
          <section id="videos" className={s.videos}>
            <div className={s.sectionHeading}><div><p className={s.eyebrow}>WATCH WITH A QUESTION</p><h2>YouTube 视频索引</h2></div><span>原课程 / 作者视频</span></div>
            <p className={s.smallNote}>观看重点见各视频下方。大学课程使用 YouTube 原站入口，作者报告可在页内打开。</p>
            {current.videos.map((v,i) => <article key={v.url} className={s.videoRow}><div className={s.videoIndex}>V0{i+1}</div><div className={s.videoInfo}><span>{v.type} · {v.author}</span><a href={v.url} target="_blank" rel="noreferrer"><h3>{v.title} <ArrowUpRight size={16} /></h3></a><p>{v.focus}</p><div className={s.watchQuestion}><strong>看完回答</strong>{v.question}</div></div>{v.embed === false ? <a className={s.videoPlay} href={v.url} target="_blank" rel="noreferrer" aria-label={`在 YouTube 打开 ${v.title}`}><ArrowUpRight size={18} /><span>原站</span></a> : <button aria-label={`播放 ${v.title}`} onClick={() => setVideo(video === v.url ? null : v.url)} className={s.videoPlay}>{video === v.url ? <X size={18} /> : <Play size={18} />}<span>{video === v.url ? "收起" : "播放"}</span></button>}</article>)}
            {video && <div className={s.videoEmbed}><iframe title="YouTube 原课程视频" src={`https://www.youtube-nocookie.com/embed/${new URL(video).searchParams.get("v")}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /><a href={video} target="_blank" rel="noreferrer">打开原视频 <ArrowUpRight size={14} /></a></div>}
          </section>
          <article id="lesson" className={s.lesson} aria-label="课程正文">
            <div className={s.lessonLabel}><span>LECTURE NOTES</span><span>{moduleId} · THEORY / CODE / EXPERIMENT</span></div>
            <nav className={s.algorithmIndex} aria-label="本节算法实验"><strong>计算实验导航</strong>{[...markdown.matchAll(/\[\[LAB:([a-z0-9]+)\]\]/g)].map(match => <a key={match[1]} href={`#lab-${match[1]}`}>{ALGORITHMS[match[1]].title}<ArrowDown size={12} /></a>)}</nav>
            {markdown.split(/(\[\[LAB(?::[a-z0-9]+)?\]\])/g).map((part,i) => {
              const match = part.match(/^\[\[LAB(?::([a-z0-9]+))?\]\]$/)
              if (match) return <fieldset key={i} disabled={!ready} className={s.labFieldset}>{match[1] ? <AlgorithmLab id={match[1]} state={record.experiments?.[match[1]]} update={next => store.update({ ...record, experiments: { ...record.experiments, [match[1]]: next } })} /> : <ConceptLab moduleId={moduleId} lab={record.lab} update={lab => store.update({ ...record, lab })} />}</fieldset>
              return <CourseReadingBody key={i} content={{ plan_markdown: part, ideas: [], rendered_sections: {} }} projectName={COURSE_ID} moduleId={moduleId} knowledgeLevel="K3" />
            })}
          </article>
          <section className={s.readings}><div className={s.sectionHeading}><div><p className={s.eyebrow}>PRIMARY SOURCES</p><h2>讲义与技术资料</h2></div></div>{current.reading.map(r => <a key={r.url} href={r.url} target="_blank" rel="noreferrer"><BookOpen size={19} /><div><strong>{r.title}</strong><p>{r.detail}</p></div><ArrowUpRight size={17} /></a>)}</section>
          <section id="notebook" className={s.notebook}><div className={s.sectionHeading}><div><p className={s.eyebrow}>YOUR EXPERIMENT LOG</p><h2>节点作业与实验记录</h2></div><span>{node.checks.slice(0,current.checklist.length).filter(Boolean).length} / {current.checklist.length}</span></div><p className={s.smallNote}>详细作业见正文末尾。保存你的配置、结果路径和观察；自查勾选不代表自动评分。</p>
            <fieldset disabled={!ready} className={s.checklist}>{current.checklist.map((item,i) => <label key={item}><input type="checkbox" checked={node.checks[i]} onChange={e => updateNode({ checks: node.checks.map((v,j) => j === i ? e.target.checked : v) })} /><span>{item}</span></label>)}</fieldset>
            <label className={s.noteLabel}>实验笔记 / 证据链接<textarea aria-label="实验笔记" disabled={!ready} rows={6} maxLength={12000} value={node.notes} onChange={e => updateNode({ notes: e.target.value })} placeholder="记录：配置与 commit → 观察到的结果 → 解释 → 下一步。可粘贴本机产物路径或实验报告链接。" /></label>
            <p className={s.saveStatus} role="status">{message} · 仅本浏览器保存，导出可跨设备恢复。</p>
            <div className={s.exports}><form action="/standalone/post-training/download" method="post"><input type="hidden" name="record" value={JSON.stringify(record)} /><button disabled={!ready} name="format" value="json"><Download size={14} />导出 JSON</button><button disabled={!ready} name="format" value="markdown">导出笔记</button></form><button disabled={!ready} onClick={() => file.current?.click()}><Upload size={14} />恢复记录</button><input type="file" ref={file} hidden accept=".json,application/json" aria-label="导入实验记录文件" onChange={e => void importFile(e.target.files?.[0])} /></div>
            {importMessage && <p role="status" className={s.smallNote}>{importMessage}</p>}{pending && <div className={s.importReview}><p>待恢复：5 个节点，包含 {Object.values(pending.nodes).filter(n => n.notes.trim()).length} 份笔记、{Object.keys(pending.experiments ?? {}).length} 组算法实验状态。</p><button onClick={() => { store.update(pending); setPending(null); setImportMessage("已恢复，请核对笔记与实验参数。") }}>确认恢复</button><button onClick={() => { setPending(null); setImportMessage("已取消恢复。") }}>取消</button></div>}
          </section>
          <a className={s.downloadPanel} href="/standalone/post-training/ticketlab-course.zip" download><div><span>TAKE THE LAB WITH YOU</span><h3>课程讲义 + TicketLab 实验仓库</h3><p>详解讲义 · 视频索引 · 数值推导脚本 · train / evaluate · 环境与验收</p></div><Download size={26} /></a>
          <div className={s.nextNav}>{index > 0 ? <Link href={`/standalone/post-training/${modules[index-1].id}`}><small>上一节点</small><strong>{modules[index-1].short}</strong></Link> : <span />}{index < 4 ? <Link href={`/standalone/post-training/${modules[index+1].id}`}><small>下一节点 <ArrowRight size={14} /></small><strong>{modules[index+1].short}</strong></Link> : <Link href="/standalone/post-training/M01"><small>回到课程起点</small><strong>复核方法与评估协议</strong></Link>}</div>
          <footer className={s.footer}>POST / TRAIN · 独立专业课程 <span>EDITION 03 · 15 ALGORITHM LABS</span></footer>
        </main>
      </div>
    </LessonSlidesProvider>
  </div>
}
