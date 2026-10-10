"use client"

import Link from "next/link"
import { useState } from "react"
import { FileCheck2, Link2 } from "lucide-react"
import { useLearningIdentity, useLearningRecord } from "@/lib/hooks/use-learning-record"
import { learningRecords, type LearningBody } from "@/lib/api/learning-records"
import { learningCacheKey } from "@/lib/learning-record-session"
import { JOURNEY_DELIVERIES, journeyProject } from "@/lib/project-lines/space-journey"
import { addMissionEvidence, deliveryScope, dossierFrom, evidenceDigest, INITIAL_MISSION_BODY, MISSION_DOSSIER_SCOPE, type MissionEvidence, type EvidenceCheck } from "@/lib/project-lines/space-mission-dossier"
import { LearningRecordStatus } from "@/components/learning/learning-record-status"
import s from "./space-mission-curriculum.module.css"

export function SpaceMissionDossier() {
  const { owner } = useLearningIdentity()
  return <DossierSession key={owner} />
}
function DossierSession() {
  const record = useLearningRecord(MISSION_DOSSIER_SCOPE, INITIAL_MISSION_BODY)
  const dossier = dossierFrom(record.body)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<Record<string, string>>({})
  const locked = !record.ready || record.busy || record.pending || record.conflict || !dossier || busy
  async function evidence(project: string): Promise<MissionEvidence | null> {
    const scope = deliveryScope(project)
    let body: LearningBody, submissionId: string, createdAt: string
    if (record.identity.token) {
      const latest = (await learningRecords.read(record.identity.token, scope)).submissions[0]
      if (!latest) return null
      body = latest.body; submissionId = latest.id; createdAt = latest.created_at
    } else {
      const raw = localStorage.getItem(learningCacheKey(record.identity.owner, scope))
      const local = raw ? JSON.parse(raw) : null
      if (!local?.submittedAt || local.dirty) return null
      body = local.body; createdAt = local.submittedAt; submissionId = `local:${createdAt}`
    }
    if (!body || !Array.isArray(body.answers) || !body.artifact || !body.answers.every(a => typeof a.answer === "string")) throw new Error("作品快照尚不完整，请回原课程核对。")
    return { scope, submissionId, createdAt, digest: await evidenceDigest(body), owner: record.identity.owner, summary: body.answers.slice(0, 3).map(a => `${a.question}：${a.answer}`).join("\n").slice(0, 1800) }
  }
  async function link(project: string) {
    if (!dossier) return
    setBusy(true)
    try {
      const found = await evidence(project)
      if (!found) { setMessage("还没有可关联的正式作品。请先回原课程提交；课堂笔记或未提交草稿不能替代作品。"); return }
      record.session.update({ ...record.body, artifact: { ...addMissionEvidence(dossier, found), checks: { ...dossier.checks, [project]: { state: "current", checkedAt: new Date().toISOString(), message: "已关联这个提交版本 · 待复核" } } } })
      setStatus(previous => ({ ...previous, [project]: "已关联这个提交版本 · 待复核" }))
      setMessage("已关联作品版本与内容指纹，旧关联仍保留。原作品没有改动；数据和代码是否兼容仍需实际测试。")
    } catch (error) { setMessage(error instanceof Error ? error.message : "读取失败，原档案保留。") }
    finally { setBusy(false) }
  }
  async function check() {
    if (!dossier) return
    setBusy(true)
    const result: Record<string, string> = {}
    const checks: Record<string, EvidenceCheck> = {}
    await Promise.all(Object.keys(JOURNEY_DELIVERIES).map(async project => {
      const saved = dossier.links.filter(e => e.scope.library_slug === project).at(-1)
      if (!saved) return
      if (saved.owner !== record.identity.owner) { result[project] = "所属身份不同，需回原作品核对"; checks[project] = { state: "unknown", checkedAt: new Date().toISOString(), message: result[project] }; return }
      try {
        const latest = await evidence(project)
        result[project] = !latest ? "原提交暂未找到，保留关联" : latest.digest !== saved.digest || latest.submissionId !== saved.submissionId ? "来源已有新版 · 下游需要复核/复测" : "与当前提交一致 · 尚未评阅"
      } catch { result[project] = "来源读取失败，原关联仍保留" }
      checks[project] = { state: result[project].includes("已有新版") ? "changed" : result[project].includes("一致") ? "current" : "unknown", checkedAt: new Date().toISOString(), message: result[project] }
    }))
    record.session.update({ ...record.body, artifact: { ...dossier, checks } })
    setStatus(result); setBusy(false)
  }
  return <section className={s.dossier} id="mission-dossier" data-mission-dossier aria-label="我的远征档案">
    <header><p>ONE MISSION · YOUR EVIDENCE</p><h2>同一个目标，一路积累的作品。</h2><span>在这里明确任务，关联自己已提交的版本。原始照片、程序和测试保留在各项目作品中。</span></header>
    {!dossier ? <p role="alert">这份档案的格式尚不兼容，原数据未覆盖。请在记录选项中导出备份。</p> : <>
      <div className={s.briefFields}>{record.body.answers.map((answer, i) => <label key={answer.question_id}><span>0{i + 1} / {answer.question}</span><input maxLength={600} disabled={locked} value={answer.answer} placeholder={['例如：比较两块地垫的纹理，检验车是否会减速','例如：教室地面 2×3 米，软边界与停车区','例如：两次路线日志、现场照片与误判记录'][i]} onChange={e => record.session.update({ ...record.body, answers: record.body.answers.map((a, n) => n === i ? { ...a, answer: e.target.value } : a) })}/></label>)}</div>
      <details className={s.evidenceList}><summary><Link2 size={16}/>关联已有作品 <small>{new Set(dossier.links.map(e => e.scope.library_slug)).size} / 7 类 · 不代表验收通过</small></summary>
        <p>只读取当前身份的正式提交。关联保存版本信息和说明摘要，不自动转换模拟参数、训练模型或认定实物通过。</p>
        {Object.keys(JOURNEY_DELIVERIES).map(project => { const p = journeyProject(project), linked = dossier.links.filter(e => e.scope.library_slug === project), latest = linked.at(-1); return <article key={project} data-evidence-project={project}><div><strong>{p.title}</strong><span>{status[project] || dossier.checks?.[project]?.message || (latest ? `已关联 ${new Date(latest.createdAt).toLocaleDateString()} 的版本 · 待复核` : "尚未关联")}</span><Link href={`${p.href}?node=${JOURNEY_DELIVERIES[project].module}&mission=space#project-delivery`}>查看原作品</Link></div><button type="button" disabled={locked} onClick={() => void link(project)}>{latest ? "关联最新提交" : "关联我的提交"}</button>{latest && <details><summary>关联版本与说明</summary>{linked.map(e => <div key={e.submissionId + e.digest}><small>{e.scope.module_id} · 课程 {e.scope.content_version} · {e.submissionId}</small><p>{e.summary}</p><code>SHA-256 {e.digest}</code></div>)}</details>}</article> })}
        <button type="button" disabled={locked || !dossier.links.length} onClick={() => void check()}>检查来源是否有更新</button>
      </details>
      <details className={s.versionFields}><summary>整车、模型与完整工程文件</summary><p>记录文件位置与版本，帮助自己复查。这里不是文件上传，仍需按原课程交付实际文件。</p>{([['vehicleVersion','车辆与程序版本','例如：打印底盘 v2 / controller-03.py'],['modelVersion','数据与模型版本','例如：dataset-v2 / terrain-model-04.tflite'],['archiveLocation','完整工程文件位置','例如：自己的工程文件夹或有权限访问的资料链接']] as const).map(([key,label,placeholder]) => <label key={key}>{label}<input value={dossier[key]} maxLength={800} disabled={locked} placeholder={placeholder} onChange={e => record.session.update({ ...record.body, artifact: { ...dossier, [key]: e.target.value } })}/></label>)}</details>
      {message && <p role="status">{message}</p>}
      <button className={s.primary} type="button" disabled={(!record.pending && locked) || record.busy || record.conflict || record.body.answers.some(a => !a.answer.trim())} onClick={() => void record.session.submit()}><FileCheck2 size={16}/>{record.pending ? "重试保存这版档案" : "保存这版任务档案"}</button><p className={s.hint}>保存保留一份历史快照，后续可以修订。它不是全线完成或能力通过的证明。</p>
    </>}
    <LearningRecordStatus record={record}/>
  </section>
}
