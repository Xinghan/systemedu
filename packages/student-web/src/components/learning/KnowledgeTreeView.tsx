"use client"

/**
 * spec 035: 项目知识树视图.
 *
 * 一次只看 1 棵学科子树 (顶部 chip 切换). 默认选点亮最多的学科.
 * 节点按 depth_level (K1-K13) 横向分层, 同 level 节点纵向排.
 * 点亮节点 coral 实色 + 未点亮 hairline 灰. hover 显示 "本项目 M_X 教了这个".
 */

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { ChevronRight, LayoutGrid, Orbit, Share2 } from "lucide-react"
import { subdomainName } from "@/lib/subdomain-names"
import { KnowledgeRadialTree } from "./KnowledgeRadialTree"
import { useT } from "@/lib/i18n/use-t"

// three.js 依赖 window, 必须 ssr:false 懒加载 (也避免 600KB 进首屏 bundle)
const KnowledgeGalaxy3D = dynamic(() => import("./KnowledgeGalaxy3D"), {
  ssr: false,
  loading: () => {
    const t = useT()
    return (
      <div
        className="rounded-2xl border border-[var(--border)]"
        style={{ height: 540, display: "grid", placeItems: "center", background: "#1e1a2b", color: "#c7b2cc" }}
      >
        {t("ktree.generating_galaxy")}
      </div>
    )
  },
})

import type {
  DepthLevel,
  LitNodeEntry,
  PlatformSubject,
  PlatformTreeNode,
  ProjectKnowledgeTree,
  PlatformTree,
  UserKnowledgeTreeResponse,
  UserLitNodeEntry,
} from "@/lib/api"

const DEPTH_ORDER: DepthLevel[] = ["K1", "K3", "K5", "K7", "K9", "K11", "K13"]

const DEPTH_LABEL_KEY: Record<DepthLevel, string> = {
  K1: "ktree.depth.k1",
  K3: "ktree.depth.k3",
  K5: "ktree.depth.k5",
  K7: "ktree.depth.k7",
  K9: "ktree.depth.k9",
  K11: "ktree.depth.k11",
  K13: "ktree.depth.k13",
}

// Unified internal lit info shape (兼容 project + user 两种数据)
interface UnifiedLitInfo {
  /** project mode: ["M05", ...]  /  user mode: ["purpleair·M05", "ai-ant·M12", ...] */
  sources: string[]
  /** 详细信息字符串, hover/click 显示 */
  detail: string
}

interface Props {
  platformTree: PlatformTree
  /** project mode: 项目级数据 */
  projectTree?: ProjectKnowledgeTree
  /** user mode: 用户级聚合数据 */
  userTree?: UserKnowledgeTreeResponse
  mode?: "project" | "user"
  onNodeClick?: (knodeId: string, slug?: string) => void
}

export function KnowledgeTreeView({
  platformTree,
  projectTree,
  userTree,
  mode = "project",
  onNodeClick,
}: Props) {
  const t = useT()
  // 统一构造 litByNodeId map
  const litByNodeId = useMemo(() => {
    const map = new Map<string, UnifiedLitInfo>()
    if (mode === "user" && userTree) {
      for (const n of userTree.lit_nodes) {
        const sources = n.lit_by_projects.flatMap((p) =>
          p.lit_by_knodes.map((k) => `${p.slug}·${k}`),
        )
        const detail = n.lit_by_projects
          .map((p) => `${p.slug} ${p.lit_by_knodes.join(",")}`)
          .join(" · ")
        map.set(n.node_id, { sources, detail })
      }
      // spec 039: 生长节点中点亮的, 并进 litByNodeId
      for (const g of userTree.grown_nodes || []) {
        if (g.lit) map.set(g.node_id, { sources: [], detail: t("ktree.grown_detail") })
      }
    } else if (projectTree) {
      for (const n of projectTree.lit_nodes) {
        map.set(n.node_id, {
          sources: n.lit_by,
          detail: `${n.lit_by.join(", ")} · ${n.reason}`,
        })
      }
    }
    return map
  }, [mode, projectTree, userTree])

  // spec 039: 生长节点按 parent_id 索引 (三视图挂任意深度子节点用)
  const grownByParent = useMemo(() => {
    const map = new Map<string, { node_id: string; name_zh: string; depth: number; lit: boolean }[]>()
    for (const g of userTree?.grown_nodes || []) {
      if (!map.has(g.parent_id)) map.set(g.parent_id, [])
      map.get(g.parent_id)!.push({ node_id: g.node_id, name_zh: g.name_zh, depth: g.depth, lit: g.lit })
    }
    return map
  }, [userTree])

  // 学科 chip
  const subjectChips = useMemo(() => {
    if (mode === "user" && userTree) {
      // 显示所有学科 (含 0 点亮的) — 让用户看到整片待探索的学科大陆 (灰树地图感)
      return userTree.subjects_summary
        .map((s) => ({
          id: s.subject_id,
          name_zh: s.subject_name_zh,
          lit: s.lit_count,
          total: s.total_count,
          color: s.color,
        }))
        .sort((a, b) => b.lit - a.lit)
    }
    if (!projectTree) return []
    return projectTree.subjects_used
      .map((sid) => {
        const s = platformTree.subjects.find((x) => x.id === sid)
        if (!s) return null
        const litCount = s.nodes.filter((n) => litByNodeId.has(n.id)).length
        return { id: sid, name_zh: s.name_zh, lit: litCount, total: s.nodes.length, color: s.color }
      })
      .filter((x): x is { id: string; name_zh: string; lit: number; total: number; color: string } => x !== null)
      .sort((a, b) => b.lit - a.lit)
  }, [mode, projectTree, userTree, platformTree.subjects, litByNodeId])

  const [activeSubject, setActiveSubject] = useState<string>(
    subjectChips[0]?.id || "",
  )
  const [viewMode, setViewMode] = useState<"2d" | "tree" | "3d">("2d")

  const activeSubjectData = useMemo(
    () => platformTree.subjects.find((s) => s.id === activeSubject) || null,
    [platformTree.subjects, activeSubject],
  )

  // user 模式: 即使 0 点亮也铺出整棵灰树 (地图感 — 看到全部待探索的学科大陆)。
  // project 模式: 没跑映射 = 真无数据, 保留空态。
  const hasAnyLit = (mode === "user" ? userTree?.lit_nodes : projectTree?.lit_nodes)?.length || 0
  if (mode !== "user" && hasAnyLit === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--sub)]">{t("ktree.no_mapping")}</p>
      </div>
    )
  }

  if (!activeSubjectData) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--sub)]">{t("ktree.no_subject_data")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 2D / 3D 视图切换 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            display: "inline-flex", gap: 2, padding: 3,
            border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--card)",
          }}
        >
          {([
            { m: "2d", icon: <LayoutGrid size={13} strokeWidth={1.6} />, label: t("ktree.view.layered") },
            { m: "tree", icon: <Share2 size={13} strokeWidth={1.6} />, label: t("ktree.view.tree") },
            { m: "3d", icon: <Orbit size={13} strokeWidth={1.6} />, label: t("ktree.view.galaxy") },
          ] as const).map((o) => (
            <button
              key={o.m}
              type="button"
              onClick={() => setViewMode(o.m)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                border: 0, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                fontSize: 12.5, fontWeight: 500,
                background: viewMode === o.m ? "var(--ink)" : "transparent",
                color: viewMode === o.m ? "#fff" : "var(--sub)",
                transition: "background var(--t-fast), color var(--t-fast)",
              }}
            >
              {o.icon}{o.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "3d" ? (
        <KnowledgeGalaxy3D platformTree={platformTree} litByNodeId={litByNodeId} grownByParent={grownByParent} onNodeClick={onNodeClick} />
      ) : (
        <>
          {/* Chips: 学科切换 */}
          <div className="flex flex-wrap gap-2">
            {subjectChips.map((s) => {
              const active = s.id === activeSubject
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSubject(s.id)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-ink)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:border-[var(--border-2)]"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.name_zh}</span>
                  <span className="text-xs text-[var(--sub)]">{s.lit}/{s.total}</span>
                </button>
              )
            })}
          </div>

          {viewMode === "tree" ? (
            <KnowledgeRadialTree
              subject={activeSubjectData}
              litByNodeId={litByNodeId}
              grownByParent={grownByParent}
              onNodeClick={onNodeClick}
            />
          ) : (
            <SubjectGroupedView
              subject={activeSubjectData}
              litByNodeId={litByNodeId}
              grownByParent={grownByParent}
              onNodeClick={onNodeClick}
            />
          )}
        </>
      )}
    </div>
  )
}

type GrownChild = { node_id: string; name_zh: string; depth: number; lit: boolean }

interface GroupedProps {
  subject: PlatformSubject
  litByNodeId: Map<string, UnifiedLitInfo>
  grownByParent: Map<string, GrownChild[]>
  onNodeClick?: (knodeId: string, slug?: string) => void
}

/** 子域分组视图: 学科 → 子域 (可折叠) → 概念叶 → 生长子节点 (任意深度)。 */
function SubjectGroupedView({ subject, litByNodeId, grownByParent, onNodeClick }: GroupedProps) {
  // 按 id 第 2 段 (子域) 分组
  const groups = useMemo(() => {
    const map = new Map<string, PlatformTreeNode[]>()
    for (const n of subject.nodes) {
      const parts = n.id.split(".")
      const sub = parts.length >= 3 ? parts[1] : "_"
      if (!map.has(sub)) map.set(sub, [])
      map.get(sub)!.push(n)
    }
    // 按点亮数降序 (有进展的子域排前)
    return [...map.entries()]
      .map(([sub, nodes]) => ({
        sub,
        nodes,
        lit: nodes.filter((n) => litByNodeId.has(n.id)).length,
        total: nodes.length,
      }))
      .sort((a, b) => b.lit - a.lit || b.total - a.total)
  }, [subject.nodes, litByNodeId])

  // 默认展开有点亮的子域 (让用户先看到自己的进展); 其余折叠
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (const g of groups) if (g.lit > 0) s.add(g.sub)
    return s
  })

  // 数据异步到达后 (初始 state 算时 litByNodeId 可能为空), 把有点亮的子域并入展开。
  // 幂等且只增不减 — 不覆盖用户手动折叠的其它子域。
  const litSubKey = groups.filter((g) => g.lit > 0).map((g) => g.sub).join(",")
  useEffect(() => {
    const litSubs = litSubKey ? litSubKey.split(",") : []
    if (!litSubs.length) return
    setExpanded((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const sub of litSubs) if (!next.has(sub)) { next.add(sub); changed = true }
      return changed ? next : prev
    })
  }, [litSubKey])

  function toggle(sub: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(sub) ? next.delete(sub) : next.add(sub)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => {
        const open = expanded.has(g.sub)
        const pct = g.total ? Math.round((g.lit * 100) / g.total) : 0
        return (
          <div
            key={g.sub}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            {/* 子域 header (可折叠) */}
            <button
              type="button"
              onClick={() => toggle(g.sub)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              style={{ cursor: "pointer", background: "transparent", border: 0 }}
            >
              <ChevronRight
                size={15}
                strokeWidth={1.8}
                style={{
                  transition: "transform 150ms",
                  transform: open ? "rotate(90deg)" : "none",
                  color: "var(--sub-2)",
                  flexShrink: 0,
                }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: g.lit > 0 ? subject.color : "var(--border-2)" }}
              />
              <span style={{ fontWeight: 600, fontSize: 14.5, color: "var(--ink)" }}>
                {subdomainName(subject.id, g.sub)}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--sub)", marginLeft: "auto" }}>
                {g.lit}/{g.total}
              </span>
              {/* 进度条 */}
              <span style={{ width: 56, height: 4, borderRadius: 999, background: "var(--paper-2)", overflow: "hidden", flexShrink: 0 }}>
                <span style={{ display: "block", height: "100%", width: `${pct}%`, background: subject.color, borderRadius: 999 }} />
              </span>
            </button>

            {/* 概念叶 (展开时) */}
            {open && (
              <div
                className="flex flex-wrap gap-2 px-4 pb-4 pt-1"
                style={{ borderTop: "1px solid var(--hairline)" }}
              >
                {g.nodes.map((n) => {
                  const lit = litByNodeId.get(n.id)
                  const isLit = !!lit
                  const onLeafClick = () => {
                    if (isLit && lit!.sources[0] && onNodeClick) {
                      const src = lit!.sources[0]
                      const [a, b] = src.includes("·") ? src.split("·") : [undefined, src]
                      onNodeClick(b || src, a)
                    }
                  }
                  const children = grownByParent.get(n.id)
                  // 有生长子节点 → 概念叶 + 其生长子链整组占一行 (纵向)
                  if (children && children.length) {
                    return (
                      <div key={n.id} style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                        <ConceptChip name={n.name_zh} isLit={isLit} color={subject.color} onClick={onLeafClick} />
                        <GrownChain parentId={n.id} grownByParent={grownByParent} color={subject.color} depth={1} />
                      </div>
                    )
                  }
                  return <ConceptChip key={n.id} name={n.name_zh} isLit={isLit} color={subject.color} onClick={onLeafClick} />
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** 概念叶 chip (平台树第三层) */
function ConceptChip({ name, isLit, color, onClick }: { name: string; isLit: boolean; color: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 11px", borderRadius: 8, fontSize: 12.5,
        cursor: isLit ? "pointer" : "default", border: "1px solid",
        borderColor: isLit ? color : "var(--border)",
        background: isLit ? `${color}1a` : "var(--paper)",
        color: isLit ? "var(--ink)" : "var(--sub-2)", fontWeight: isLit ? 500 : 400,
        alignSelf: "flex-start",
      }}
    >
      {name}
    </button>
  )
}

/** 生长子链 (递归): 个人生长节点, 虚线边区分平台审定; 任意深度缩进。 */
function GrownChain({
  parentId, grownByParent, color, depth,
}: { parentId: string; grownByParent: Map<string, GrownChild[]>; color: string; depth: number }) {
  const t = useT()
  const children = grownByParent.get(parentId)
  if (!children || !children.length) return null
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginLeft: depth * 16, alignItems: "flex-start" }}>
      {children.map((c) => (
        <div key={c.node_id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            title={c.lit ? t("ktree.grown_detail") : t("ktree.grown_pending")}
            style={{
              padding: "5px 10px", borderRadius: 8, fontSize: 12,
              border: "1px dashed", // 虚线 = 个人生长 (区分平台审定的实线)
              borderColor: c.lit ? color : "var(--border-2)",
              background: c.lit ? `${color}14` : "transparent",
              color: c.lit ? "var(--ink-2)" : "var(--sub-2)",
              alignSelf: "flex-start",
            }}
          >
            {c.name_zh}
          </span>
          <GrownChain parentId={c.node_id} grownByParent={grownByParent} color={color} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

interface SubjectTreeProps {
  subject: PlatformSubject
  litByNodeId: Map<string, UnifiedLitInfo>
  onNodeClick?: (knodeId: string, slug?: string) => void
}

function SubjectTreeSvg({ subject, litByNodeId, onNodeClick }: SubjectTreeProps) {
  const t = useT()
  // 按 depth_level 分组
  const nodesByDepth = useMemo(() => {
    const map = new Map<DepthLevel, PlatformTreeNode[]>()
    for (const d of DEPTH_ORDER) map.set(d, [])
    for (const n of subject.nodes) {
      map.get(n.depth_level)?.push(n)
    }
    return map
  }, [subject.nodes])

  // 列宽 200px, 行高 50px, 节点 box 160x32
  const COL_WIDTH = 220
  const ROW_HEIGHT = 56
  const NODE_W = 180
  const NODE_H = 38
  const PAD = 24

  // 计算每列起始位置
  const cols = DEPTH_ORDER.filter((d) => (nodesByDepth.get(d)?.length || 0) > 0)
  const maxRows = Math.max(...cols.map((d) => nodesByDepth.get(d)?.length || 0), 1)
  const width = PAD * 2 + cols.length * COL_WIDTH
  const height = PAD * 2 + maxRows * ROW_HEIGHT + 30

  // 节点位置 lookup
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    cols.forEach((d, colIdx) => {
      const nodes = nodesByDepth.get(d) || []
      const colX = PAD + colIdx * COL_WIDTH
      // 居中纵向
      const startY = PAD + 30 + (maxRows - nodes.length) * (ROW_HEIGHT / 2)
      nodes.forEach((n, rowIdx) => {
        map.set(n.id, { x: colX + (COL_WIDTH - NODE_W) / 2, y: startY + rowIdx * ROW_HEIGHT })
      })
    })
    return map
  }, [cols, nodesByDepth, maxRows])

  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2">
      <svg width={width} height={height} className="block">
        {/* 列标题 (depth_level) */}
        {cols.map((d, idx) => (
          <text
            key={d}
            x={PAD + idx * COL_WIDTH + COL_WIDTH / 2}
            y={PAD + 14}
            textAnchor="middle"
            className="fill-[var(--sub)] font-mono"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {t(DEPTH_LABEL_KEY[d])}
          </text>
        ))}

        {/* prereq 连线 */}
        {subject.nodes.map((n) =>
          n.prerequisites.map((pid) => {
            const from = positions.get(pid)
            const to = positions.get(n.id)
            if (!from || !to) return null
            return (
              <line
                key={`${pid}-${n.id}`}
                x1={from.x + NODE_W}
                y1={from.y + NODE_H / 2}
                x2={to.x}
                y2={to.y + NODE_H / 2}
                stroke="var(--border-2)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )
          }),
        )}

        {/* 节点 */}
        {subject.nodes.map((n) => {
          const pos = positions.get(n.id)
          if (!pos) return null
          const lit = litByNodeId.get(n.id)
          const isLit = !!lit
          const isHovered = hovered === n.id
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                if (lit && lit.sources[0] && onNodeClick) {
                  // user mode: "purpleair·M05" → 拆 slug + knodeId
                  const src = lit.sources[0]
                  if (src.includes("·")) {
                    const [slug, knodeId] = src.split("·")
                    onNodeClick(knodeId, slug)
                  } else {
                    onNodeClick(src)
                  }
                }
              }}
              style={{ cursor: isLit ? "pointer" : "default" }}
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={isLit ? "var(--primary)" : "var(--paper-2)"}
                stroke={
                  isHovered
                    ? "var(--primary-ink)"
                    : isLit
                      ? "var(--primary-ink)"
                      : "var(--border)"
                }
                strokeWidth={isHovered ? 2 : 1}
              />
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + NODE_H / 2 + 4}
                textAnchor="middle"
                fill={isLit ? "#FFFFFF" : "var(--sub)"}
                style={{ fontSize: 12, fontWeight: 500, pointerEvents: "none" }}
              >
                {n.name_zh}
              </text>
            </g>
          )
        })}

        {/* tooltip (hover) */}
        {hovered && (() => {
          const n = subject.nodes.find((x) => x.id === hovered)
          const pos = positions.get(hovered)
          if (!n || !pos) return null
          const lit = litByNodeId.get(n.id)
          const tipText = lit
            ? lit.sources.length > 1
              ? t("ktree.tip_multi", { sources: lit.sources.slice(0, 3).join(" / ") })
              : t("ktree.tip_single", { source: lit.sources[0] })
            : t("ktree.tip_none")
          const tipY = pos.y - 8
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={pos.x}
                y={tipY - 18}
                width={Math.max(120, tipText.length * 11)}
                height={22}
                rx={4}
                fill="var(--ink)"
                opacity={0.92}
              />
              <text
                x={pos.x + 8}
                y={tipY - 4}
                fill="#FFFFFF"
                style={{ fontSize: 11 }}
              >
                {tipText}
              </text>
            </g>
          )
        })()}
      </svg>

      {/* 节点详情 (固定底部, 显示 hover/focus 节点信息) */}
      {hovered && (() => {
        const n = subject.nodes.find((x) => x.id === hovered)
        if (!n) return null
        const lit = litByNodeId.get(n.id)
        return (
          <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-3 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-[var(--ink)]">{n.name_zh}</span>
              <span className="text-xs text-[var(--sub)]">{n.name_en} · {t(DEPTH_LABEL_KEY[n.depth_level])}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--sub)]">{n.description}</p>
            {lit && (
              <p className="mt-2 text-xs text-[var(--primary-ink)]">
                {lit.detail}
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}
