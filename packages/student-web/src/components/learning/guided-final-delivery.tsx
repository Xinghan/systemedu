"use client"

import { Check, Circle, Package, ArrowUpRight } from "lucide-react"
import type { LearningBody } from "@/lib/api/learning-records"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import type { GuidedCourse, GuidedModule } from "@/lib/project-lines/guided-course"
import { ACTION_LABELS, TERRAIN_LABELS, ROUTE_LABELS, deliveryChecks, deliveryScope, deliverySnapshot, inspectedDrivingArtifact } from "@/lib/project-lines/driving-delivery"
import { runRules } from "../../../public/project-lines/space-exploration/_shared/models.mjs"
import { LearningRecordStatus } from "./learning-record-status"
import styles from "./guided-final-delivery.module.css"

function ArtifactPreview({ body }: { body: LearningBody }) {
  const artifact = inspectedDrivingArtifact(body.artifact)
  if (!artifact) return null
  return <div className={styles.preview} data-delivery-preview>
    <h4>我写的驾驶规则</h4>
    <dl className={styles.rules}>{Object.entries(artifact.program.rules).map(([terrain, action]) => <div key={terrain}><dt>如果是{TERRAIN_LABELS[terrain]}</dt><dd>{ACTION_LABELS[action]}</dd></div>)}</dl>
    <h4>这一版的测试证据</h4>
    {(["training", "transfer"] as const).map(route => {
      const label = ROUTE_LABELS[route]
      const expected = runRules(artifact.program.rules, route)
      const saved = artifact.evidence.runs.find(run => run.route_id === route && run.signature === expected.signature && run.passed && run.status === expected.status && JSON.stringify(run.steps) === JSON.stringify(expected.steps) && JSON.stringify(run.trace) === JSON.stringify(expected.trace))!
      return <details className={styles.run} key={route}>
        <summary><span>{label}</span><span>已通过 · 查看 {saved.steps.length} 步记录</span></summary>
        <ol>{saved.steps.map((step, i) => <li key={i}><span>{TERRAIN_LABELS[step.terrain]} → {ACTION_LABELS[step.action]}</span><span>{step.outcome}</span></li>)}</ol>
      </details>
    })}
    <p className={styles.boundary}>已用当前规则复核保存的运行步骤。结果只适用于这两条模拟路线，不代表真实火星车测试或知识掌握评定。</p>
  </div>
}

export function GuidedFinalDelivery({ course, node, source, sourceReady, associate, associateDisabled, message }: {
  course: GuidedCourse; node: GuidedModule; source: LearningBody; sourceReady: boolean
  associate: () => void; associateDisabled: boolean; message: string
}) {
  const record = useLearningRecord(deliveryScope(course, node), { answers: [] })
  const checks = deliveryChecks(source, node)
  const ready = sourceReady && checks.every(check => check.passed)
  const prepared = ready ? deliverySnapshot(course, node, source) : null
  const unchanged = prepared && JSON.stringify(prepared) === JSON.stringify(record.body)
  const submitted = !!record.submittedAt && unchanged
  const saved = record.history[0] ?? (record.submittedAt ? { body: record.body, created_at: record.submittedAt } : null)

  async function submit() {
    if (!record.ready || record.conflict || record.busy) return
    if (!record.pending) {
      if (!prepared) return
      record.session.update(prepared)
    }
    await record.session.submit()
  }

  return <section id="project-delivery" className={styles.delivery} data-project-delivery aria-labelledby="project-delivery-title">
    <div className={styles.heading}><span className={styles.icon}><Package size={22} /></span><div><p>最终交付物</p><h3 id="project-delivery-title">{course.final_deliverable?.title ?? "我的驾驶规则作品包"}</h3></div></div>
    <p className={styles.intro}>把实验里的规则和证据带过来，再配上你刚写好的说明，组成一份可以回来查看的项目作品。</p>
    <ol className={styles.checks} aria-label="作品验收清单">{checks.map(check => <li key={check.id} data-delivery-check={check.id} data-passed={sourceReady && check.passed}>
      {sourceReady && check.passed ? <Check size={18} /> : <Circle size={18} />}
      <div><strong>{check.title}</strong><p>{sourceReady && check.passed ? check.id === "explanation" ? "说明已填写，内容待自评或评阅。" : "证据核对通过。" : check.hint}</p></div>
      <span>{sourceReady && check.passed ? "已具备" : "待完成"}</span>
    </li>)}</ol>
    <div className={styles.actions}>
      <button type="button" onClick={associate} disabled={associateDisabled}>关联实验作品</button>
      <a href="#lesson-practice">返回本节实验 <ArrowUpRight size={14} /></a>
    </div>
    {message && <p className={styles.boundary} role="status">{message}</p>}
    {source.artifact && <p className={styles.boundary}>本节已关联实验凭据。修改实验规则后，请重新测试、保存，再次关联新版本。</p>}
    <ArtifactPreview body={source} />
    <div className={styles.selfReview}><h4>交付前，试着向别人讲清楚</h4><p>规则为什么要这样选？哪次测试让你修改了想法？如果换成没测试过的地形，你还需要什么证据？可以一边展开测试记录，一边用自己的话说明。</p></div>
    <p className={styles.state} data-delivery-state role="status">{record.pending ? "上次交付尚未确认，请先重试同一份作品。" : submitted ? record.identity.token ? "这一版作品已提交到账号，可随时回到这里查看。" : "这一版作品仅保存在本机，尚未提交到账号。" : ready ? "作品和说明已齐备，可以交付这一版。" : "作品还没有齐备。完成上面的待办后，再交付你的项目作品。"}</p>
    {!unchanged && saved && <p className={styles.boundary}>{record.identity.token ? "当前内容与上次交付不同。上次作品仍然保留，重新交付会保存新版本。" : "当前内容与本机上次交付不同。再次保存会更新本机作品；需要保留旧副本时，可先从记录选项导出。"}</p>}
    <button className={styles.submit} type="button" onClick={submit} disabled={!record.ready || record.busy || record.conflict || (!record.pending && (!ready || !!submitted))}>
      {record.pending ? "重试上次交付" : submitted ? "当前版本已保存" : record.identity.token ? "提交项目作品" : "保存项目作品到本机"}
    </button>
    <p className={styles.boundary}>作品交付与课堂记录分别保存。验收只核对规则、测试证据和说明完整性，不自动给出成绩。</p>
    {saved && <details className={styles.savedVersion} data-delivered-version><summary>查看上次交付的完整作品 · {new Date(saved.created_at).toLocaleString()}</summary><ArtifactPreview body={saved.body} /><h4>我的作品说明</h4>{saved.body.answers.map(answer => <div className={styles.explanation} key={answer.question_id}><strong>{answer.question}</strong><p>{answer.answer}</p></div>)}</details>}
    <LearningRecordStatus record={record} />
  </section>
}
