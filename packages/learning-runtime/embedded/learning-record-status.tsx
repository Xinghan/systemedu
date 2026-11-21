import type { ReactNode } from 'react'
import type { LearningRecordSession, RecordState } from '../../student-web/src/lib/learning-record-session'

export function downloadLearningRecord(value: unknown, name = 'my-learning-record.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'}))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Keep the source record controls, but describe the local App host accurately. */
export function LearningRecordStatus({record, children}: {record: RecordState & {session: LearningRecordSession}; children?: ReactNode}) {
  const backup = () => downloadLearningRecord({...record.session.scope, body:record.body, history:record.history})
  return <div data-learning-status>
    <p role="status">{record.attention ? record.message : !record.ready ? '正在读取本机记录…' : record.submittedAt ? '这一版已保存在本机，尚未提交到账号。' : '编辑内容会自动保存到本机，可从课堂上方导出记录。'}</p>
    {record.attention && <button onClick={backup}>导出当前记录</button>}
    <details data-record-options><summary>记录选项{record.history.length ? ` · ${record.history.length} 次保存` : ''}</summary>
      {!record.attention && <><p>日常编辑自动保存。需要独立副本时，可以导出备份。</p><button onClick={backup}>导出当前记录</button></>}
      {children}
      {!!record.history.length && <details><summary>查看保存历史</summary><ol>{record.history.map(item=><li key={item.id}><strong>{new Date(item.created_at).toLocaleString()} · 已保存，未评阅</strong>{item.body.answers.map(a=><p key={a.question_id}>{a.question}：{a.answer}</p>)}</li>)}</ol></details>}
    </details>
  </div>
}
