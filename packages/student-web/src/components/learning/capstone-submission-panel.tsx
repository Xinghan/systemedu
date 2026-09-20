"use client"

import type { KnodeInfo, NodeProgress } from "@/lib/types/api"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LearningRecordStatus } from "./learning-record-status"
import { questionVersion } from "./persistent-question"

interface CapstoneSubmissionPanelProps {
  projectName: string
  nodeId: number
  knode: KnodeInfo
  progress: NodeProgress | null
  onStatusChange?: () => void
}

export function CapstoneSubmissionPanel(props: CapstoneSubmissionPanelProps) {
  if (!props.knode.module_id) return <p>请从课程节点打开项目交付，才能保存到正确的课程。</p>
  return <CapstoneRecord {...props} moduleId={props.knode.module_id} />
}

function CapstoneRecord({ projectName, knode, moduleId }: CapstoneSubmissionPanelProps & { moduleId: string }) {
  const artifacts = knode.acceptance_artifacts ?? []
  const standards = knode.acceptance_standard ?? []
  const questions = ["成果链接与提交说明", ...standards.map((s, i) => `标准 ${i + 1}：${s}`)]
  const record = useLearningRecord({ library_slug: projectName, module_id: moduleId,
    activity_id: "capstone-delivery", kind: "assignment", content_version: questionVersion({ artifacts, standards }) }, {
    answers: questions.map((question, i) => ({ question_id: i ? `reflection_${i}` : "delivery", question, answer: "" })),
    artifact: { checklist: {} },
  })
  const raw = record.body.artifact?.checklist
  const checklist = raw && typeof raw === "object" ? raw as Record<string, boolean> : {}
  const locked = record.pending || record.busy && !record.ready
  return <section className="mt-8 space-y-5 rounded-xl border border-border p-5" data-capstone-record>
    <h3 className="text-lg font-semibold">项目交付记录</h3>
    <p className="text-sm text-muted-foreground">勾选已完成的成果，填写说明和自己的反思。登录后自动保存草稿；提交后保留每次交付历史，等待评阅。</p>
    {artifacts.length > 0 && <fieldset className="space-y-3"><legend className="font-medium mb-3">成果清单</legend>{artifacts.map(item => <label key={item.artifact_id} className="flex gap-3 items-start">
      <input type="checkbox" checked={checklist[item.artifact_id] === true} disabled={locked} onChange={event => record.session.update({ ...record.body, artifact: { ...record.body.artifact, checklist: { ...checklist, [item.artifact_id]: event.target.checked } } })} />
      <span className="text-sm"><strong>{item.title}</strong><span className="block text-muted-foreground">{item.description} · {item.format}</span></span>
    </label>)}</fieldset>}
    {record.body.answers.map((item, i) => <label className="block space-y-2" key={item.question_id}><span className="text-sm font-medium">{item.question}</span>
      {i === 0 && <p className="text-xs text-muted-foreground">可以粘贴作品链接，并说明做了什么、还缺什么。这里保存文字和链接，暂不接收文件附件。</p>}
      <textarea className="block w-full rounded border border-border p-3 text-sm" aria-label={item.question} rows={4} maxLength={20000} disabled={locked} value={item.answer} onChange={event => record.session.update({ ...record.body, answers: record.body.answers.map((a, at) => at === i ? { ...a, answer: event.target.value } : a) })} />
    </label>)}
    <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40" disabled={record.busy || record.conflict || record.body.answers.some(a => !a.answer.trim())} onClick={() => record.session.submit()}>{record.pending ? "重试本次提交" : record.submittedAt ? "再次提交项目交付" : "提交项目交付"}</button>
    {record.submittedAt && <p className="text-sm">交付记录已保存，尚未评阅。</p>}
    <LearningRecordStatus record={record} />
  </section>
}
