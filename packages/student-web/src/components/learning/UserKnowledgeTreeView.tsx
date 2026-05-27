"use client"

/**
 * spec 036: 用户级跨项目知识图谱视图.
 *
 * - 顶部 summary: 你点亮了 X / 425 节点 (Y%)
 * - 复用 spec 035 KnowledgeTreeView (mode="user")
 * - 底部 RecommendNextProjects (推荐下 3 项目)
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  library,
  userKnowledgeTree,
  type PlatformTree,
  type UserKnowledgeTreeResponse,
} from "@/lib/api"
import { KnowledgeTreeView } from "./KnowledgeTreeView"
import { RecommendNextProjects } from "./RecommendNextProjects"

export function UserKnowledgeTreeView() {
  const router = useRouter()
  const [platformTree, setPlatformTree] = useState<PlatformTree | null>(null)
  const [userTree, setUserTree] = useState<UserKnowledgeTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([library.getPlatformKnowledgeTree(), userKnowledgeTree.get()])
      .then(([p, u]) => {
        if (cancelled) return
        setPlatformTree(p)
        setUserTree(u)
        setErr(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : "加载失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-[var(--sub)]">正在加载你的知识图谱...</p>
  }
  if (err) {
    return <p className="text-sm text-[var(--sub)]">{err}</p>
  }
  if (!platformTree || !userTree) return null

  const totalLit = userTree.total_lit
  const totalNodes = userTree.total_platform_nodes
  const percent = totalNodes
    ? Math.round((totalLit * 100) / totalNodes)
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Summary card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-2)] p-5">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-[var(--primary-ink)]">
            {totalLit}
          </span>
          <span className="text-base text-[var(--sub)]">
            / {totalNodes} 节点 · 平台覆盖 {percent}%
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--sub)]">
          每完成一个 knode, 它对应的平台知识树节点就会点亮. 切换学科 chip 看不同领域的覆盖.
        </p>
      </div>

      {/* SVG 树 */}
      <KnowledgeTreeView
        mode="user"
        platformTree={platformTree}
        userTree={userTree}
        onNodeClick={(knodeId, slug) => {
          if (slug) router.push(`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(knodeId)}`)
        }}
      />

      {/* 推荐 */}
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-[var(--ink)]">
          推荐你下一个项目
        </h3>
        <RecommendNextProjects limit={3} />
      </div>
    </div>
  )
}
