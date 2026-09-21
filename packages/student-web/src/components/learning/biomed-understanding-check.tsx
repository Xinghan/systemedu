"use client"

import guides from '@/lib/project-lines/biomed-lesson-guides.json'
import { useLearningRecord } from '@/lib/hooks/use-learning-record'
import { LearningRecordStatus } from './learning-record-status'
import styles from './biomed-workspace.module.css'

type Guide = typeof guides['build-a-candidate-filter']['M01']
const byProject: Record<string, Record<string, Guide>> = guides

export function BiomedUnderstandingCheck({ project, node }: { project: string; node: string }) {
  const guide = byProject[project]?.[node]
  return guide ? <CheckQuestion key={`${project}/${node}`} project={project} node={node} guide={guide} /> : null
}

function CheckQuestion({ project, node, guide }: { project: string; node: string; guide: Guide }) {
  const { check } = guide
  const record = useLearningRecord({ library_slug: project, module_id: node, activity_id: 'concept-check', kind: 'quiz', content_version: '1.0' }, { answers: [] })
  const choice = record.body.answers[0]?.answer || ''
  const option = check.options.find(o => o.id === choice)
  const checked = !!option && record.body.artifact?.checkedChoice === choice
  const correct = choice === check.correct
  const locked = !record.ready || record.busy || record.pending || record.conflict
  function select(id: string) {
    record.session.update({ answers: [{ question_id: 'concept', question: check.question, answer: id }], client_context: { assessment: 'formative-practice', schema: 'biomed-concept-check/1' } })
  }
  async function submit() {
    if (record.pending) { await record.session.submit(); return }
    if (!option) return
    record.session.update({ ...record.body, artifact: { checkedChoice: choice, selectedText: option.text }, client_context: { assessment: 'formative-practice', schema: 'biomed-concept-check/1' } })
    await record.session.submit()
  }
  return <section className={styles.conceptCheck} data-biomed-check aria-labelledby={`check-${node}`}>
    <p className={styles.eyebrow}>停一下，想明白 / {node}</p>
    <fieldset disabled={locked}>
      <legend id={`check-${node}`}>{check.question}</legend>
      <div className={styles.options}>{check.options.map(o => <label key={o.id} data-selected={choice === o.id}>
        <input type="radio" name={`concept-${project}-${node}`} value={o.id} checked={choice === o.id} onChange={() => select(o.id)} />
        <span>{o.text}</span>
      </label>)}</div>
    </fieldset>
    <button className={styles.button} type="button" disabled={!record.ready || record.busy || record.conflict || (!record.pending && (!option || checked))} onClick={submit}>{record.pending ? '重试保存这次自检' : '检查我的理解'}</button>
    {checked && <div className={styles.checkFeedback} role="status" data-correct={correct}><strong>{correct ? '这次判断有依据' : '再想一步'}</strong><p>{option.feedback}</p>{!correct && <p>可以回看本节例子，换一个选择再检查。</p>}</div>}
    <p className={styles.muted}>这是帮助理解的练习，可反复尝试，不计入作品验收。登录后保留每次提交；自动反馈不代表已掌握。</p>
    {record.history.length > 0 && <details className={styles.history}><summary>查看自检尝试 · {record.history.length} 次</summary><ol>{record.history.map(attempt => {
      const answer = check.options.find(o => o.id === attempt.body.answers[0]?.answer)
      return <li key={attempt.id}>{new Date(attempt.created_at).toLocaleString()} · {answer?.text || '未识别的旧记录'} · {answer?.id === check.correct ? '判断符合本题依据' : '需要再想一步'}</li>
    })}</ol></details>}
    <LearningRecordStatus record={record} />
  </section>
}
