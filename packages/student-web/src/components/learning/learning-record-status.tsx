"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { LearningRecordSession, RecordState } from "@/lib/learning-record-session"

export function downloadLearningRecord(value: unknown, name = "my-learning-record.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }))
  const link = document.createElement("a"); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LearningRecordStatus({ record, children }: { record: RecordState & { session: LearningRecordSession }; children?: ReactNode }) {
  const backup = () => downloadLearningRecord({ ...record.session.scope, body: record.body, history: record.history })
  return <div className="mt-3 space-y-2 text-xs text-muted-foreground" data-learning-status>
    <p role="status">{record.message}</p>
    <div className="flex flex-wrap gap-4">
      {!record.session.token && <Link href="/login">登录以保存到账号</Link>}
      {record.session.token && (record.attention || record.pending) && <button type="button" disabled={record.busy} onClick={() => record.conflict ? record.session.refresh(true) : record.pending ? record.session.submit() : record.ready ? record.session.save() : record.session.refresh()}>{record.conflict ? "读取服务器版本（替换本机草稿）" : record.pending ? "重试本次提交" : record.ready ? "重试同步" : "重新连接"}</button>}
      {record.attention && <button type="button" onClick={backup}>下载当前记录</button>}
    </div>
    <details data-record-options><summary className="cursor-pointer py-2">记录选项{record.history.length > 0 ? ` · ${record.history.length} 次提交` : ""}</summary>
      <div className="space-y-3 py-2">
        {!record.attention && <><p>需要离线副本时，可以导出备份。日常学习会自动保存。</p><button type="button" onClick={backup}>下载当前记录</button></>}
        {children}
        {record.history.length > 0 && <details><summary className="cursor-pointer py-2">查看提交历史</summary><ol className="mt-2 space-y-3">{record.history.map(item => <li key={item.id}><strong>{new Date(item.created_at).toLocaleString()} · 已保存，未评阅</strong>{item.body.answers.map(a => <p className="whitespace-pre-wrap" key={a.question_id}>{a.question}：{a.answer}</p>)}</li>)}</ol></details>}
      </div>
    </details>
  </div>
}
