"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, ArrowRight, BookOpen, Download, ExternalLink, Play, FlaskConical } from "lucide-react"
import type { GuidedCourse, LearningResource } from "@/lib/project-lines/guided-course"
import { COURSE_STORAGE_KEY, newCourseRecord, parseCourseRecord, verifiedDrivingArtifact, type CourseRecord } from "@/lib/project-lines/guided-progress"
import styles from "./guided-project-course.module.css"

function VideoResource({ resource }: { resource: LearningResource }) {
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  return <article className={styles.resource}>
    <span className={styles.resourceKind}>VIDEO · {resource.publisher} · 英文资源 / 中文引导</span>
    <h4>{resource.title}</h4><p>{resource.purpose}</p>
    {!playing && (resource.youtube_id || resource.media_url) && <button className={styles.playButton} onClick={() => setPlaying(true)}><Play size={15} />播放视频</button>}
    {playing && resource.youtube_id && <iframe className={styles.video} src={`https://www.youtube-nocookie.com/embed/${resource.youtube_id}`} title={resource.title} allow="fullscreen; picture-in-picture" allowFullScreen />}
    {playing && resource.media_url && <video className={styles.video} controls preload="metadata" src={resource.media_url} onError={() => setFailed(true)} aria-label={resource.title}><a href={resource.url}>到来源页观看</a></video>}
    {failed && <p role="status">此视频暂时无法播放。可打开官方来源，或先读下方中文要点继续学习。</p>}
    <div className={styles.watchTask}><strong>带着问题看</strong><p>{resource.prompt}</p></div>
    <details><summary>中文要点 / 视频无法播放时</summary><p>{resource.fallback}</p></details>
    <a className={styles.sourceLink} href={resource.url} target="_blank" rel="noreferrer">打开原始视频与说明 <ExternalLink size={13} /></a>
  </article>
}

export function GuidedProjectCourse({ course }: { course: GuidedCourse }) {
  const search = useSearchParams()
  const current = course.modules.find(node => node.module_id === search.get("node")) ?? course.modules[0]
  const index = course.modules.indexOf(current)
  const [record, setRecord] = useState<CourseRecord>(() => newCourseRecord(course))
  const [loaded, setLoaded] = useState(false)
  const [writable, setWritable] = useState(true)
  const [status, setStatus] = useState("")
  const [labOpen, setLabOpen] = useState(false)
  const [artifactStatus, setArtifactStatus] = useState("")
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const raw = localStorage.getItem(COURSE_STORAGE_KEY)
      // 首次挂载才读取浏览器存储，保证服务端渲染和 hydration 的初始值一致。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRecord(parseCourseRecord(raw, course))
    } catch {
      setWritable(false)
      setStatus("旧学习记录无法读取，未覆盖。当前可以继续学习，完成后请下载记录。")
    }
    setLoaded(true)
  }, [course])
  const answers = record.nodes[current.module_id]?.answers ?? current.questions.map(() => "")
  const submitted = course.modules.filter(node => record.nodes[node.module_id]?.submitted_at).length

  function persist(next: CourseRecord) {
    setRecord(next)
    if (!writable) { setStatus("记录仍在当前页面中，未写入本机；请下载保存。"); return }
    try { localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(next)); setStatus("已保存到当前浏览器，可随时回来或下载记录。") }
    catch { setWritable(false); setStatus("记录未写入本机，内容仍在当前页面中；请下载保存。") }
  }
  function changeAnswer(at: number, text: string) {
    const nextAnswers = answers.map((answer, i) => i === at ? text : answer)
    persist({ ...record, nodes: { ...record.nodes, [current.module_id]: { answers: nextAnswers } } })
  }
  function submitNode() {
    if (!answers.every(answer => answer.trim())) { setStatus("先留下本节的两项观察与解释，再提交学习记录。"); return }
    persist({ ...record, nodes: { ...record.nodes, [current.module_id]: { answers, submitted_at: new Date().toISOString() } } })
  }
  function associateArtifact() {
    try {
      const records: unknown = JSON.parse(localStorage.getItem("systemedu:write-driving-rules:v1") || "[]")
      const artifact = Array.isArray(records) ? records.find(verifiedDrivingArtifact) : null
      if (!artifact) { setArtifactStatus("还没找到符合当前格式、实际通过两条路线的已保存作品。请先在实验工具里测试并保存。"); return }
      persist({ ...record, lab_artifact: artifact })
      setArtifactStatus("已关联规则与两条路线的验证记录。它是实验凭据，课程学习记录仍需分别提交。")
    } catch { setArtifactStatus("实验作品无法读取，原数据未改动。可回实验工具重新保存或下载备份。") }
  }
  function download() {
    const blob = new Blob([JSON.stringify({ ...record, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob), link = document.createElement("a")
    link.href = url; link.download = "my-driving-course-record.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <main className={styles.page} data-guided-course={course.id}>
    <header className={styles.header}><Link href="/library?view=lines&line=space-exploration"><ArrowLeft size={15} />星际远征队</Link><span>引导课程 / 学习、实践、交付</span></header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>从操作，走向理解与制作</p><h1>{course.title}</h1><p className={styles.subtitle}>{course.subtitle}</p><p className={styles.audience}>{course.audience}</p></div>
      <div className={styles.courseFacts}><div><strong>{course.modules.length}</strong><span>学习节点</span></div><div><strong>{course.estimated_minutes}<small> 分钟</small></strong><span>累计设计目标 · 可分次完成</span></div><p>{course.outcome}</p></div>
    </section>
    <div className={styles.layout}>
      <aside className={styles.outline} aria-label="课程学习路径">
        <p className={styles.eyebrow}>你的学习路径</p>
        {course.stages.map(stage => <section key={stage.stage_id}><h2>{stage.title}</h2>{course.modules.filter(node => node.stage_id === stage.stage_id).map(node => <Link key={node.module_id} href={`?node=${node.module_id}`} aria-current={node.module_id === current.module_id ? "step" : undefined} className={styles.nodeLink} onClick={() => setLabOpen(false)}><span>{node.module_id}</span><div><strong>{node.title}</strong><small>{node.estimated_minutes} 分钟目标 · {record.nodes[node.module_id]?.submitted_at ? "已提交记录" : "待学习记录"}</small></div><ArrowRight size={13} /></Link>)}</section>)}
        <div className={styles.progress}><span>已提交学习记录</span><strong data-course-progress>{submitted} / {course.modules.length}</strong><p>记录自己的观察和解释；提交记录不等于自动评定掌握。</p><button onClick={download} disabled={!loaded}><Download size={14} />下载课程记录</button></div>
      </aside>
      <article className={styles.lesson} data-module={current.module_id}>
        <div className={styles.nodeHeading}><span>{current.module_id} / {course.modules.length} 个节点中的第 {index + 1} 节</span><span>{current.estimated_minutes} 分钟目标</span></div>
        <h2>{current.title}</h2><p className={styles.coreQuestion}>{current.core_question}</p>
        <div className={styles.objective}><BookOpen size={19} /><div><strong>这一节你要学会</strong><p>{current.objective}</p><small>留下：{current.output}</small>{current.depends_on.length > 0 && <small>建议先完成：{current.depends_on.join("、")} 的学习与记录；也可以随时回看。</small>}</div></div>
        <nav className={styles.sectionNav} aria-label="本节内容"><a href="#lesson-reading">学习正文</a><a href="#lesson-references">参考资料</a><a href="#lesson-videos">视频与观察</a><a href="#lesson-practice">实践与记录</a></nav>
        <section id="lesson-reading" className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{current.lesson}</ReactMarkdown></section>
        <section id="lesson-references" className={styles.section}><h3>带着问题读资料</h3>{current.resources.filter(r => r.kind === "reference").map(resource => <article className={styles.resource} key={resource.url}><span className={styles.resourceKind}>REFERENCE · {resource.publisher}</span><h4><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} <ExternalLink size={14} /></a></h4><p>{resource.purpose}</p><div className={styles.watchTask}><strong>阅读后想一想</strong><p>{resource.prompt}</p></div><details><summary>中文阅读提示</summary><p>{resource.fallback}</p></details><small>来源核对：{resource.checked_at} · 英文资料配中文引导</small></article>)}</section>
        <section id="lesson-videos" className={styles.section}><h3>看一次，再说出你的发现</h3>{current.resources.filter(r => r.kind === "video").map(resource => <VideoResource key={current.module_id + resource.url} resource={resource} />)}</section>
        <section id="lesson-practice" className={styles.section}><h3>实践与节点作品</h3><div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{current.assignment}</ReactMarkdown></div>
          {current.lab && <div className={styles.lab}><div><FlaskConical size={20} /><div><h4>驾驶规则实验工具</h4><p>用它完成本节任务；实验结果和课程学习记录分别保存。</p></div></div><div className={styles.labActions}><button onClick={() => setLabOpen(!labOpen)}>{labOpen ? "收起实验工具" : "打开本节实验"}<ArrowRight size={15} /></button><a href={course.lab_url} target="_blank" rel="noreferrer">独立窗口操作 <ExternalLink size={13} /></a></div>{labOpen && <iframe src={course.lab_url} title="驾驶规则实验工具" className={styles.labFrame} />}</div>}
          <div className={styles.notebook}><p className={styles.eyebrow}>我的学习记录 · {current.module_id}</p>{current.questions.map((question, i) => <label key={current.module_id + i}><strong>{i + 1}. {question}</strong><textarea aria-label={question} value={answers[i]} maxLength={5000} disabled={!loaded} onChange={event => changeAnswer(i, event.target.value)} placeholder="记录你自己的观察、选择和理由。" rows={4} /></label>)}<button className={styles.primary} onClick={submitNode} disabled={!loaded || !answers.every(a => a.trim())}>{record.nodes[current.module_id]?.submitted_at ? "更新本节学习记录" : "提交本节学习记录"}<ArrowRight size={15} /></button><p className={styles.status} role="status">{status || "记录只保存在当前浏览器，也可以下载带走。"}</p></div>
          {index === course.modules.length - 1 && <div className={styles.delivery}><h4>把实验作品放进课程交付包</h4><p>先在实验工具里保存当前规则，再关联测试证据。课程不会因为实验通过就自动提交全部学习节点。</p><button onClick={associateArtifact}>关联实验作品</button><p role="status">{artifactStatus || (record.lab_artifact ? "已有一份通过两条路线验证的规则作品。" : "尚未关联实验作品。")}</p><button onClick={download}><Download size={14} />下载课程与实验交付记录</button></div>}
        </section>
        <footer className={styles.nodeFooter}>{index > 0 ? <Link href={`?node=${course.modules[index - 1].module_id}`} onClick={() => setLabOpen(false)}><ArrowLeft size={14} />上一节点</Link> : <span />}{index < course.modules.length - 1 ? <Link href={`?node=${course.modules[index + 1].module_id}`} onClick={() => setLabOpen(false)}>下一节点：{course.modules[index + 1].title}<ArrowRight size={14} /></Link> : <Link href="/library?view=lines&line=space-exploration">回到项目线<ArrowRight size={14} /></Link>}</footer>
      </article>
    </div>
  </main>
}
