"use client"

import { useEffect, useState } from "react"
import type { GuidedCourse, GuidedModule } from "@/lib/project-lines/guided-course"
import { COURSE_STORAGE_KEY, parseCourseRecord, verifiedDrivingArtifact } from "@/lib/project-lines/guided-progress"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { learningCacheKey, type RecordState } from "@/lib/learning-record-session"
import type { LearningScope } from "@/lib/api/learning-records"
import { LearningRecordStatus } from "./learning-record-status"
import styles from "./guided-project-course.module.css"

export function guidedScope(course: GuidedCourse, node: GuidedModule): LearningScope {
  return { library_slug: course.id, module_id: node.module_id, activity_id: "reflection", kind: "classroom", content_version: course.version }
}

export function GuidedCourseNotebook({ course, node, onRecord }: {
  course: GuidedCourse; node: GuidedModule; onRecord: (id: string, record: RecordState) => void
}) {
  const record = useLearningRecord(guidedScope(course, node), { answers: node.questions.map((question, i) => ({ question_id: `q${i + 1}`, question, answer: "" })) })
  const [importMessage, setImportMessage] = useState("")
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
  return <div className={styles.notebook} data-guided-notebook={node.module_id}>
    <p className={styles.eyebrow}>我的学习记录 · {node.module_id} · {record.identity.token ? "账号保存" : "本机草稿"}</p>
    {node.questions.map((question, i) => <label key={question}><strong>{i + 1}. {question}</strong><textarea aria-label={question} value={record.body.answers[i]?.answer ?? ""} maxLength={5000} disabled={locked} onChange={e => record.session.update({ ...record.body, answers: record.body.answers.map((a, at) => at === i ? { ...a, answer: e.target.value } : a) })} placeholder="记录你自己的观察、选择和理由。" rows={4} /></label>)}
    <button className={styles.primary} disabled={record.busy || record.conflict || !record.body.answers.every(a => a.answer.trim())} onClick={() => record.session.submit()}>{record.pending ? "重试本次提交" : record.submittedAt ? "再次提交本节记录" : "提交本节学习记录"}</button>
    <LearningRecordStatus record={record} />
    {record.body.answers.every(a => !a.answer.trim()) && <div className={styles.watchTask}><p>旧浏览器记录未绑定账号。仅在确认是自己的记录时导入本节。</p><button disabled={locked || !record.ready} onClick={importLocal}>将本机旧记录作为我的草稿</button></div>}
    {node.module_id === "M04" && <div className={styles.delivery}><h4>关联实验作品</h4><p>实验工具仍保存本机作品。点击后将这份作品作为本节草稿附件，随账号记录保存。</p><button onClick={associateArtifact} disabled={locked || !record.ready}>关联实验作品</button>{record.body.artifact && <p>本节已关联实验凭据。</p>}</div>}
    {importMessage && <p role="status">{importMessage}</p>}
  </div>
}
