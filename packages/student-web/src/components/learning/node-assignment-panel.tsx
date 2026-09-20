"use client"

import { useEffect, useState } from "react"
import { myProjects } from "@/lib/api"
import { AssignmentView } from "./assignment-view"
import type { KnodeInfo } from "@/lib/types/api"

export function NodeAssignmentPanel({ projectName, knode }: { projectName: string; knode?: KnodeInfo | null }) {
  const [content, setContent] = useState("")
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const moduleId = knode?.module_id
  useEffect(() => {
    let active = true
    if (!moduleId) return
    myProjects.getKnode(projectName, moduleId).then(data => { if (active) { setContent(data.assignment_md || ""); setError(false) } }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [projectName, moduleId, attempt])
  if (error) return <p className="p-6 text-sm">作业内容暂未读取。<button onClick={() => setAttempt(n => n + 1)}>重试</button></p>
  if (!content) return null
  return <section className="mx-auto max-w-4xl px-6 py-8" data-node-assignment><h2 className="text-xl mb-4">本节作业与学习记录</h2><AssignmentView content={content} knode={knode} projectName={projectName} /></section>
}
