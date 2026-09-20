"use client"

import Link from "next/link"
import type { LearningRecordSession, RecordState } from "@/lib/learning-record-session"

export function downloadLearningRecord(value: unknown, name = "my-learning-record.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }))
  const link = document.createElement("a"); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LearningRecordStatus({ record }: { record: RecordState & { session: LearningRecordSession } }) {
  return <div className="mt-3 space-y-2 text-xs text-muted-foreground" data-learning-status>
    <p role="status">{record.message}</p>
    <div className="flex flex-wrap gap-4">
      {!record.session.token && <Link href="/login">登录以保存到账号</Link>}
      {record.session.token && <button type="button" disabled={record.busy} onClick={() => record.conflict ? record.session.refresh(true) : record.pending ? record.session.submit() : record.ready ? record.session.save() : record.session.refresh()}>{record.conflict ? "读取服务器版本（替换本机草稿）" : record.pending ? "重试本次提交" : record.ready ? "重试同步" : "重新连接"}</button>}
      <button type="button" onClick={() => downloadLearningRecord({ ...record.session.scope, body: record.body, history: record.history })}>下载当前记录</button>
    </div>
    {record.history.length > 0 && <details><summary>提交历史 · 最近 {record.history.length} 次</summary><ol className="mt-2 space-y-3">{record.history.map(item => <li key={item.id}><strong>{new Date(item.created_at).toLocaleString()} · 已保存，未评阅</strong>{item.body.answers.map(a => <p className="whitespace-pre-wrap" key={a.question_id}>{a.question}：{a.answer}</p>)}</li>)}</ol></details>}
  </div>
}
