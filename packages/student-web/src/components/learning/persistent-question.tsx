"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LearningRecordStatus } from "./learning-record-status"

export function questionVersion(value: unknown) {
  // 内容指纹只用于隔离题目版本，不作为安全校验。
  let hash = 2166136261
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `question-v1-${(hash >>> 0).toString(16)}`
}

export function PersistentQuestion({ projectName, moduleId, activityId, question, options, correctAnswer, explanation, referenceAnswer, kind = "assignment" }: {
  projectName: string; moduleId?: string; activityId: string; question: string
  options?: { value: string; label: string }[]; correctAnswer?: string
  explanation?: string; referenceAnswer?: string; kind?: "quiz" | "assignment" | "exam"
}) {
  const params = useParams<{ moduleId?: string }>()
  const actualModule = moduleId || params.moduleId
  if (!actualModule || !projectName) return <p>请从课程节点打开此题，才能将回答保存到正确的课程。</p>
  return <QuestionRecord key={`${projectName}/${actualModule}/${activityId}`} projectName={projectName} moduleId={actualModule} activityId={activityId} question={question} options={options} correctAnswer={correctAnswer} explanation={explanation} referenceAnswer={referenceAnswer} kind={kind} />
}

function QuestionRecord({ projectName, moduleId, activityId, question, options, correctAnswer, explanation, referenceAnswer, kind }: {
  projectName: string; moduleId: string; activityId: string; question: string
  options?: { value: string; label: string }[]; correctAnswer?: string; explanation?: string; referenceAnswer?: string
  kind: "quiz" | "assignment" | "exam"
}) {
  const record = useLearningRecord({ library_slug: projectName, module_id: moduleId, activity_id: activityId, kind, content_version: questionVersion({ question, options, correctAnswer, referenceAnswer }) }, { answers: [{ question_id: activityId, question, answer: "" }] })
  const answer = record.body.answers[0]?.answer ?? ""
  const submitted = !!record.submittedAt
  const locked = record.pending || record.busy && !record.ready
  function change(value: string) {
    record.session.update({ ...record.body, answers: [{ question_id: activityId, question, answer: value }], client_context: {
      ...(options && kind !== "exam" ? { practice_feedback: { correct: value === correctAnswer, source: "client-practice-check" } } : {}),
    } })
  }
  return <section className="my-5 rounded-lg border border-border p-4 space-y-3" data-persistent-question={activityId}>
    <h4 className="font-medium text-sm">{question}</h4>
    {options ? <div className="space-y-2">{options.map(option => <button key={option.value} type="button" aria-pressed={answer === option.value} disabled={locked || submitted} onClick={() => change(option.value)} className={`block w-full rounded border px-3 py-2 text-left text-sm ${answer === option.value ? "border-primary bg-primary/10" : "border-border"}`}>{option.label}</button>)}</div> : <textarea aria-label={question} className="w-full rounded border border-border p-3 text-sm" rows={4} maxLength={20000} value={answer} disabled={locked} onChange={event => change(event.target.value)} />}
    <button type="button" className="rounded bg-primary text-primary-foreground px-4 py-2 text-xs disabled:opacity-40" disabled={!answer.trim() || record.busy || record.conflict} onClick={() => record.session.submit()}>{record.pending ? "重试本次提交" : submitted ? "再次提交答案" : "提交答案"}</button>
    {submitted && options && kind !== "exam" && <p className="text-sm">练习自检：{answer === correctAnswer ? "与参考答案一致。" : "与参考答案不同，可结合解析再尝试。"} {explanation}<button type="button" className="ml-3 underline" onClick={() => change("")}>重新作答</button></p>}
    {submitted && (!options || kind === "exam") && <p className="text-sm">回答已保留，尚未评分。</p>}
    {submitted && referenceAnswer && kind !== "exam" && <details><summary>查看参考思路</summary><p className="whitespace-pre-wrap text-sm">{referenceAnswer}</p></details>}
    <LearningRecordStatus record={record} />
  </section>
}

export function PersistentTheoryQuiz({ projectName, moduleId, theoryId, exercises }: {
  projectName: string; moduleId?: string; theoryId: string
  exercises: { question: string; options: string[]; correct: number; explanation?: string }[]
}) {
  const [expanded, setExpanded] = useState(false)
  return <div className="mt-6 border-t pt-4"><button onClick={() => setExpanded(!expanded)}>自测 · {exercises.length} 题</button>
    {expanded && exercises.map((ex, i) => <PersistentQuestion key={`${theoryId}/${i}`} projectName={projectName} moduleId={moduleId} activityId={`${theoryId}_q${i}`} kind="quiz" question={ex.question} options={ex.options.map((label, value) => ({ label, value: String(value) }))} correctAnswer={String(ex.correct)} explanation={ex.explanation} />)}
  </div>
}
