"use client"

import { useEffect, useRef, useState } from "react"
import type { GuidedCourse, GuidedModule } from "@/lib/project-lines/guided-course"
import { COURSE_STORAGE_KEY, parseCourseRecord, verifiedDrivingArtifact } from "@/lib/project-lines/guided-progress"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { learningCacheKey, type RecordState } from "@/lib/learning-record-session"
import type { LearningScope } from "@/lib/api/learning-records"
import { LearningRecordStatus } from "./learning-record-status"
import { GuidedResponsePrompt } from "./guided-response-prompt"
import { responseComplete } from "@/lib/project-lines/guided-response"
import styles from "./guided-project-course.module.css"

export function guidedScope(course: GuidedCourse, node: GuidedModule): LearningScope {
  return { library_slug: course.id, module_id: node.module_id, activity_id: "reflection", kind: "classroom", content_version: course.version }
}

export function GuidedCourseNotebook({ course, node, onRecord }: {
  course: GuidedCourse; node: GuidedModule; onRecord: (id: string, record: RecordState) => void
}) {
  const record = useLearningRecord(guidedScope(course, node), { answers: node.questions.map((question, i) => ({ question_id: `q${i + 1}`, question, answer: "" })) })
  const [importMessage, setImportMessage] = useState("")
  const [activeStep, setActiveStep] = useState(0)
  const stepButtons = useRef<(HTMLButtonElement | null)[]>([])
  const completed = node.questions.map((_, i) => responseComplete(record.body, i, node.response_prompts?.[i]))
  useEffect(() => { if (record.ready) onRecord(node.module_id, record.session.snapshot()) }, [node.module_id, record.session, record.body, record.submittedAt, record.ready, onRecord])
  const locked = record.pending || record.busy && !record.ready
  function importLocal() {
    try {
      const guest = record.identity.token && localStorage.getItem(learningCacheKey("guest", guidedScope(course, node)))
      if (guest) {
        const body = JSON.parse(guest).body
        if (!body || !Array.isArray(body.answers) || body.answers.length !== node.questions.length || !body.answers.every((a: { answer?: unknown }) => typeof a.answer === "string" && a.answer.length <= 5000)) throw new Error()
        record.session.update({ answers: record.body.answers.map((a, i) => ({ ...a, answer: body.answers[i].answer })) })
      } else {
        const legacy = parseCourseRecord(localStorage.getItem(COURSE_STORAGE_KEY) || "null", course)
        const saved = legacy.nodes[node.module_id]
        if (!saved) { setImportMessage("此浏览器没有本节旧记录。"); return }
        record.session.update({ answers: record.body.answers.map((a, i) => ({ ...a, answer: saved.answers[i] })) })
      }
      setImportMessage("已作为本节新草稿导入，旧记录原件保留；提交历史不会自动迁移。")
    } catch { setImportMessage("没有可兼容的本节旧记录；原数据未覆盖。"); }
  }
  function associateArtifact() {
    try {
      const saved = JSON.parse(localStorage.getItem("systemedu:write-driving-rules:v1") || "[]")
      const artifact = Array.isArray(saved) ? saved.find(verifiedDrivingArtifact) : null
      if (!artifact) { setImportMessage("还没找到实际通过两条路线的已保存作品，请先在实验工具中保存。"); return }
      record.session.update({ ...record.body, artifact })
      setImportMessage("已将本机实验作品关联到本节草稿。课程记录仍需逐节提交。")
    } catch { setImportMessage("实验作品无法读取，原数据未改动。") }
  }
  return <div className={styles.notebook} id="lesson-notebook" data-guided-notebook={node.module_id}>
    <div className={styles.notebookHeading}><div><p className={styles.eyebrow}>我的学习记录 · {node.module_id}</p><h3>一步一步，留下你的发现</h3></div><span data-response-progress>{completed.filter(Boolean).length} / {node.questions.length} 步已写好</span></div>
    <p className={styles.notebookIntro}>先看一个例子，再留下自己的判断。一两句也可以，写完后随时能回来修改。</p>
    {node.questions.map((question, i) => <section key={question} className={styles.responseStep} data-response-step={i + 1}>
      <h4><button type="button" className={styles.stepToggle} ref={element => { stepButtons.current[i] = element }} aria-expanded={activeStep === i} aria-controls={`response-panel-${i}`} onClick={() => setActiveStep(i)}><span className={styles.stepNumber}>{String(i + 1).padStart(2, "0")}</span><span>{node.response_prompts?.[i]?.title ?? question}</span><small>{completed[i] ? "已写好" : "待填写"}</small></button></h4>
      <div id={`response-panel-${i}`} hidden={activeStep !== i}>
        <GuidedResponsePrompt body={record.body} index={i} question={question} prompt={node.response_prompts?.[i]} locked={locked} onChange={body => record.session.update(body)} />
        {i < node.questions.length - 1 && <div className={styles.stepNext}><span>{completed[i] ? "这一小步写好了，可以继续。" : "选出你的判断，并补齐上面的小空格。"}</span><button type="button" disabled={!completed[i]} onClick={() => { setActiveStep(i + 1); stepButtons.current[i + 1]?.focus() }}>继续下一步</button></div>}
      </div>
    </section>)}
    <div className={styles.notebookSubmit}><p>{completed.every(Boolean) ? "两步都已写好。提交会保留这一版记录，你之后仍可以修改。" : "输入会自动保存；两步写完后，再提交这一版记录。"}</p><button className={styles.primary} disabled={record.busy || record.conflict || !completed.every(Boolean)} onClick={() => record.session.submit()}>{record.pending ? "重试本次提交" : record.submittedAt ? "再次提交本节记录" : "提交本节学习记录"}</button></div>
    <LearningRecordStatus record={record}>
      {record.body.answers.every(a => !a.answer.trim()) && <div><p>旧浏览器记录未绑定账号。确认是自己的记录后，可导入本节。</p><button disabled={locked || !record.ready} onClick={importLocal}>将本机旧记录作为我的草稿</button></div>}
    </LearningRecordStatus>
    {node.module_id === "M04" && <div className={styles.delivery}><h4>关联实验作品</h4><p>实验工具仍保存本机作品。点击后将这份作品作为本节草稿附件，随账号记录保存。</p><button onClick={associateArtifact} disabled={locked || !record.ready}>关联实验作品</button>{record.body.artifact && <p>本节已关联实验凭据。</p>}</div>}
    {importMessage && <p role="status">{importMessage}</p>}
  </div>
}
