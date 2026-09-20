"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, ArrowRight, BookOpen, Download, ExternalLink, FlaskConical } from "lucide-react"
import type { GuidedCourse } from "@/lib/project-lines/guided-course"
import { newCourseRecord, type CourseRecord } from "@/lib/project-lines/guided-progress"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { learningRecords } from "@/lib/api/learning-records"
import { learningCacheKey, type RecordState } from "@/lib/learning-record-session"
import { GuidedCourseNotebook, guidedScope } from "./guided-course-notebook"
import { CourseVideoResource } from "./course-video-resource"
import styles from "./guided-project-course.module.css"

export function GuidedProjectCourse({ course }: { course: GuidedCourse }) {
  const identity = useLearningIdentity()
  return <GuidedCourseSession key={identity.owner} course={course} token={identity.token} owner={identity.owner} />
}

function GuidedCourseSession({ course, token, owner }: { course: GuidedCourse; token: string | null; owner: string }) {
  const search = useSearchParams()
  const current = course.modules.find(node => node.module_id === search.get("node")) ?? course.modules[0]
  const index = course.modules.indexOf(current)
  const [record, setRecord] = useState<CourseRecord>(() => newCourseRecord(course))
  const [loaded, setLoaded] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  const [loadMessage, setLoadMessage] = useState("")
  const onRecord = useCallback((id: string, saved: Pick<RecordState, "body" | "submittedAt">) => {
    setRecord(previous => ({ ...previous, nodes: { ...previous.nodes, [id]: { answers: saved.body.answers.map(a => a.answer), ...(saved.submittedAt ? { submitted_at: saved.submittedAt } : {}) } }, ...(id === "M04" ? { lab_artifact: saved.body.artifact ?? undefined } : {}) }))
  }, [])
  useEffect(() => {
    let active = true
    Promise.all(course.modules.map(async node => {
      const scope = guidedScope(course, node)
      if (token) {
        const remote = await learningRecords.read(token, scope)
        if (active && remote.draft) setRecord(previous => previous.nodes[node.module_id] ? previous : { ...previous, nodes: { ...previous.nodes, [node.module_id]: { answers: remote.draft!.body.answers.map(a => a.answer), ...(remote.draft!.status === "submitted" ? { submitted_at: remote.submissions[0]?.created_at } : {}) } }, ...(node.module_id === "M04" ? { lab_artifact: remote.draft!.body.artifact ?? undefined } : {}) })
      } else {
        const raw = localStorage.getItem(learningCacheKey(owner, scope))
        if (raw) {
          const cached = JSON.parse(raw)
          if (active && Array.isArray(cached.body?.answers)) onRecord(node.module_id, { body: cached.body, submittedAt: cached.submittedAt })
        }
      }
    })).catch(() => { if (active) setLoadMessage("部分节点记录尚未读取，可进入节点重试；下载包含当前已读取内容。") }).finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [course, token, owner, onRecord])
  const submitted = course.modules.filter(node => record.nodes[node.module_id]?.submitted_at).length

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
    {course.final_deliverable && <section className={styles.projectGoal} aria-label="最终作品目标"><div><p className={styles.eyebrow}>做完后，你会拥有</p><h2>{course.final_deliverable.title}</h2><ul>{course.final_deliverable.parts.map(part => <li key={part}>{part}</li>)}</ul><p className={styles.goalAcceptance}>怎样验收：{course.final_deliverable.acceptance.join("；")}。</p></div><Link href={`/explore/space-exploration/${course.id}?node=${course.final_deliverable.module_id}#project-delivery`}>查看我的最终作品<ArrowRight size={16} /></Link></section>}
    <div className={styles.layout}>
      <aside className={styles.outline} aria-label="课程学习路径">
        <p className={styles.eyebrow}>你的学习路径</p>
        {course.stages.map(stage => <section key={stage.stage_id}><h2>{stage.title}</h2>{course.modules.filter(node => node.stage_id === stage.stage_id).map(node => <Link key={node.module_id} href={`?node=${node.module_id}`} aria-current={node.module_id === current.module_id ? "step" : undefined} className={styles.nodeLink} onClick={() => setLabOpen(false)}><span>{node.module_id}</span><div><strong>{node.title}</strong><small>{node.estimated_minutes} 分钟目标 · {record.nodes[node.module_id]?.submitted_at ? "已提交记录" : "待学习记录"}</small></div><ArrowRight size={13} /></Link>)}</section>)}
        <div className={styles.progress}><span>已提交学习记录</span><strong data-course-progress>{submitted} / {course.modules.length}</strong>{loadMessage && <p role="status">{loadMessage}</p>}<p>{token ? "记录按账号自动保存，随时回来继续。" : "未登录时记录仅保存在本机。"}提交记录不等于评定掌握。</p><a className={styles.returnToNotebook} href="#lesson-notebook">回到本节记录 <ArrowRight size={14} /></a><details className={styles.courseBackup}><summary>课程记录选项</summary><p>需要离线副本时，再导出整门课程的已读取记录。</p><button onClick={download} disabled={!loaded}><Download size={14} />下载课程记录</button></details></div>
      </aside>
      <article className={styles.lesson} data-module={current.module_id}>
        <div className={styles.nodeHeading}><span>{current.module_id} / {course.modules.length} 个节点中的第 {index + 1} 节</span><span>{current.estimated_minutes} 分钟目标</span></div>
        <h2>{current.title}</h2><p className={styles.coreQuestion}>{current.core_question}</p>
        <div className={styles.objective}><BookOpen size={19} /><div><strong>这一节你要学会</strong><p>{current.objective}</p><small>留下：{current.output}</small>{current.depends_on.length > 0 && <small>建议先完成：{current.depends_on.join("、")} 的学习与记录；也可以随时回看。</small>}</div></div>
        <nav className={styles.sectionNav} aria-label="本节内容"><a href="#lesson-reading">学习正文</a><a href="#lesson-references">参考资料</a><a href="#lesson-videos">视频与观察</a><a href="#lesson-practice">实践与记录</a></nav>
        <section id="lesson-reading" className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{current.lesson}</ReactMarkdown></section>
        <section id="lesson-references" className={styles.section}><h3>带着问题读资料</h3>{current.resources.filter(r => r.kind === "reference").map(resource => <article className={styles.resource} key={resource.url}><a className={styles.referenceHeading} href={resource.url} target="_blank" rel="noreferrer"><span className={styles.resourceIcon}><BookOpen size={18} /></span><div><span className={styles.resourceKind}>参考资料 · {resource.publisher}</span><h4>{resource.title}</h4><p>{resource.purpose}</p></div><ExternalLink size={15} /></a><div className={styles.watchTask}><strong>阅读后想一想</strong><p>{resource.prompt}</p></div><details><summary>中文阅读提示</summary><p>{resource.fallback}</p></details><small>来源核对：{resource.checked_at} · 英文资料配中文引导</small></article>)}</section>
        <section id="lesson-videos" className={styles.section}><h3>看一次，再说出你的发现</h3>{current.resources.filter(r => r.kind === "video").map(resource => <CourseVideoResource key={current.module_id + resource.url} resource={resource} />)}</section>
        <section id="lesson-practice" className={styles.section}><h3>实践与节点作品</h3><div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{current.assignment}</ReactMarkdown></div>
          {current.lab && <div className={styles.lab}><div><FlaskConical size={20} /><div><h4>驾驶规则实验工具</h4><p>用它完成本节任务；实验结果和课程学习记录分别保存。</p></div></div><div className={styles.labActions}><button onClick={() => setLabOpen(!labOpen)}>{labOpen ? "收起实验工具" : "打开本节实验"}<ArrowRight size={15} /></button><a href={course.lab_url} target="_blank" rel="noreferrer">独立窗口操作 <ExternalLink size={13} /></a></div>{labOpen && <iframe src={course.lab_url} title="驾驶规则实验工具" className={styles.labFrame} />}</div>}
          <GuidedCourseNotebook key={current.module_id} course={course} node={current} onRecord={onRecord} />
        </section>
        <footer className={styles.nodeFooter}>{index > 0 ? <Link href={`?node=${course.modules[index - 1].module_id}`} onClick={() => setLabOpen(false)}><ArrowLeft size={14} />上一节点</Link> : <span />}{index < course.modules.length - 1 ? <Link href={`?node=${course.modules[index + 1].module_id}`} onClick={() => setLabOpen(false)}>下一节点：{course.modules[index + 1].title}<ArrowRight size={14} /></Link> : <Link href="/library?view=lines&line=space-exploration">回到项目线<ArrowRight size={14} /></Link>}</footer>
      </article>
    </div>
  </main>
}
