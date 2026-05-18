"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Bot,
  ChevronRight,
  CirclePlay,
  ExternalLink,
  GitBranch,
  Network,
  Plus,
  X,
} from "lucide-react"

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface TreeModule {
  module_id: string
  title: string
  stage_id?: string
  sequence_order?: number
  summary?: string
  depends_on?: string[]
  core_question?: string
}

export interface TreeStage {
  stage_id: string
  title: string
}

interface KnowledgeTreeModalProps {
  slug: string
  projectTitle?: string
  stages: TreeStage[]
  modules: TreeModule[]
  lastModuleId?: string | null
  pulled?: boolean
  onClose: () => void
}

type NodeStatus = "mastered" | "active" | "available" | "locked"

interface PositionedNode {
  m: TreeModule
  stageIdx: number
  rowInStage: number
  x: number
  y: number
  w: number
  h: number
  status: NodeStatus
}

const COL_WIDTH = 200
const COL_GAP = 0
const NODE_W = 150
const NODE_H = 32
const ROW_HEIGHT = 56
const CANVAS_TOP_PAD = 80
const CANVAS_SIDE_PAD = 40

// ──────────────────────────────────────────────────────────────────────────
// Modal
// ──────────────────────────────────────────────────────────────────────────

export function KnowledgeTreeModal({
  slug,
  projectTitle,
  stages,
  modules,
  lastModuleId,
  pulled,
  onClose,
}: KnowledgeTreeModalProps) {
  const [selected, setSelected] = useState<string | null>(lastModuleId || modules[0]?.module_id || null)
  const [statusFilter, setStatusFilter] = useState<NodeStatus | "all">("all")

  // 计算 status
  const statusOf = useMemo(() => {
    const orderedModules = [...modules].sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
    )
    const lastIdx = lastModuleId
      ? orderedModules.findIndex((m) => m.module_id === lastModuleId)
      : -1
    const result: Record<string, NodeStatus> = {}
    orderedModules.forEach((m, i) => {
      if (!pulled) {
        result[m.module_id] = "locked"
        return
      }
      if (lastIdx < 0) {
        result[m.module_id] = i === 0 ? "active" : "available"
        return
      }
      if (i < lastIdx) result[m.module_id] = "mastered"
      else if (i === lastIdx) result[m.module_id] = "active"
      else if (i === lastIdx + 1) result[m.module_id] = "available"
      else result[m.module_id] = "available" // 都已 pulled, 都能学
    })
    return result
  }, [modules, lastModuleId, pulled])

  // 按 stage 分列布局
  const positioned = useMemo<PositionedNode[]>(() => {
    const out: PositionedNode[] = []
    stages.forEach((s, si) => {
      const stageMods = modules
        .filter((m) => m.stage_id === s.stage_id)
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      stageMods.forEach((m, ri) => {
        const x = CANVAS_SIDE_PAD + si * COL_WIDTH + NODE_W / 2 + COL_GAP
        const y = CANVAS_TOP_PAD + ri * ROW_HEIGHT + NODE_H / 2
        out.push({
          m,
          stageIdx: si,
          rowInStage: ri,
          x,
          y,
          w: NODE_W,
          h: NODE_H,
          status: statusOf[m.module_id] || "locked",
        })
      })
    })
    return out
  }, [stages, modules, statusOf])

  // 找节点 by id
  const nodeById = useMemo(() => {
    const m: Record<string, PositionedNode> = {}
    for (const p of positioned) m[p.m.module_id] = p
    return m
  }, [positioned])

  // edges 来自 depends_on
  const edges = useMemo(() => {
    const out: { a: PositionedNode; b: PositionedNode }[] = []
    for (const p of positioned) {
      for (const dep of p.m.depends_on || []) {
        const a = nodeById[dep]
        if (a) out.push({ a, b: p })
      }
    }
    return out
  }, [positioned, nodeById])

  const W = Math.max(
    1200,
    CANVAS_SIDE_PAD * 2 + stages.length * COL_WIDTH,
  )
  const H = Math.max(
    600,
    CANVAS_TOP_PAD +
      Math.max(
        ...stages.map(
          (s) => modules.filter((m) => m.stage_id === s.stage_id).length,
        ),
        1,
      ) *
        ROW_HEIGHT +
      40,
  )

  const counts = useMemo(() => {
    const c: Record<NodeStatus, number> = { mastered: 0, active: 0, available: 0, locked: 0 }
    for (const p of positioned) c[p.status]++
    return c
  }, [positioned])

  const selectedNode = selected ? nodeById[selected] : null

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,9,14,.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          background: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,.4)",
        }}
      >
        {/* CANVAS */}
        <section
          style={{
            position: "relative",
            overflow: "auto",
            background: `
              radial-gradient(circle, #E8E2D3 0.8px, transparent 1px) 0 0 / 18px 18px,
              var(--paper)
            `,
          }}
        >
          {/* top bar */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 4,
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background:
                "linear-gradient(180deg, var(--paper) 70%, transparent 100%)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 3 }}>
                <span className="dot" /> Knowledge tree
              </div>
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: "-.02em",
                  lineHeight: 1.1,
                  fontWeight: 600,
                }}
              >
                {projectTitle || slug}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Legend
                dot="var(--bio)"
                t={`${counts.mastered} mastered`}
                active={statusFilter === "mastered"}
                onClick={() =>
                  setStatusFilter((f) => (f === "mastered" ? "all" : "mastered"))
                }
              />
              <Legend
                dot="var(--primary)"
                t={`${counts.active} active`}
                active={statusFilter === "active"}
                onClick={() =>
                  setStatusFilter((f) => (f === "active" ? "all" : "active"))
                }
              />
              <Legend
                dot="var(--aerospace)"
                t={`${counts.available} available`}
                active={statusFilter === "available"}
                onClick={() =>
                  setStatusFilter((f) => (f === "available" ? "all" : "available"))
                }
              />
              <Legend
                dot="var(--sub-2)"
                t={`${counts.locked} locked`}
                active={statusFilter === "locked"}
                onClick={() =>
                  setStatusFilter((f) => (f === "locked" ? "all" : "locked"))
                }
              />
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 8, background: "var(--card)" }}
              >
                <X size={13} strokeWidth={1.5} /> Close
              </button>
            </div>
          </div>

          {/* graph */}
          <div style={{ position: "relative", width: W, minWidth: "100%", height: H }}>
            {/* stage column headers */}
            {stages.map((s, i) => {
              const x = CANVAS_SIDE_PAD + i * COL_WIDTH + NODE_W / 2 + COL_GAP
              return (
                <div
                  key={s.stage_id}
                  style={{
                    position: "absolute",
                    left: x - COL_WIDTH / 2,
                    top: 0,
                    width: COL_WIDTH,
                    textAlign: "center",
                    fontFamily: "var(--mono)",
                    fontSize: 10.5,
                    color: "var(--sub)",
                    letterSpacing: ".05em",
                    paddingTop: 4,
                  }}
                >
                  {s.stage_id} · {s.title}
                </div>
              )
            })}

            <svg
              width={W}
              height={H}
              style={{ position: "absolute", inset: 0, overflow: "visible" }}
            >
              <defs>
                <marker
                  id="kt-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0 0 L6 3 L0 6" fill="#999999" />
                </marker>
                <marker
                  id="kt-arrow-active"
                  markerWidth="6"
                  markerHeight="6"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0 0 L6 3 L0 6" fill="#D97757" />
                </marker>
              </defs>

              {/* vertical section dividers */}
              {stages.slice(1).map((_, i) => {
                const x = CANVAS_SIDE_PAD + (i + 1) * COL_WIDTH - COL_GAP / 2
                return (
                  <line
                    key={i}
                    x1={x}
                    x2={x}
                    y1={CANVAS_TOP_PAD - 30}
                    y2={H - 20}
                    stroke="#E8E2D3"
                    strokeDasharray="2 6"
                    strokeWidth="1"
                  />
                )
              })}

              {/* edges */}
              {edges.map(({ a, b }, i) => {
                const involvesSelected =
                  selected && (a.m.module_id === selected || b.m.module_id === selected)
                const isActive =
                  (a.status === "active" || b.status === "active") &&
                  a.status !== "locked" &&
                  b.status !== "locked"
                const dimmed =
                  statusFilter !== "all" &&
                  !(a.status === statusFilter || b.status === statusFilter) &&
                  !involvesSelected
                const dx = Math.abs(b.x - a.x) || 1
                const cx1 = a.x + dx * 0.4
                const cx2 = b.x - dx * 0.4
                return (
                  <path
                    key={i}
                    d={`M${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`}
                    fill="none"
                    stroke={
                      involvesSelected
                        ? "#D97757"
                        : isActive
                          ? "#ECB294"
                          : "#D8D4C8"
                    }
                    strokeWidth={involvesSelected ? 1.6 : 1}
                    opacity={dimmed ? 0.15 : 1}
                    markerEnd={
                      involvesSelected ? "url(#kt-arrow-active)" : "url(#kt-arrow)"
                    }
                  />
                )
              })}

              {/* nodes */}
              {positioned.map((p) => {
                const isSel = p.m.module_id === selected
                const dimmed =
                  statusFilter !== "all" && p.status !== statusFilter && !isSel
                return (
                  <TreeNode
                    key={p.m.module_id}
                    p={p}
                    selected={isSel}
                    dimmed={dimmed}
                    onClick={() => setSelected(p.m.module_id)}
                  />
                )
              })}
            </svg>
          </div>

          {/* bottom-left mini stats */}
          <div
            style={{
              position: "sticky",
              bottom: 16,
              marginLeft: 24,
              marginTop: 16,
              marginBottom: 8,
              display: "inline-flex",
              gap: 14,
              alignItems: "center",
              padding: "10px 14px",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--sub)",
              zIndex: 4,
            }}
          >
            <span>
              <Network
                size={12}
                strokeWidth={1.5}
                style={{ verticalAlign: -1, color: "var(--ink-2)", marginRight: 4 }}
              />
              {positioned.length} modules
            </span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>
              <GitBranch
                size={12}
                strokeWidth={1.5}
                style={{ verticalAlign: -1, color: "var(--ink-2)", marginRight: 4 }}
              />
              {edges.length} prerequisites
            </span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ color: "var(--emerald)" }}>{counts.mastered} mastered</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ color: "var(--violet)" }}>{counts.active} active</span>
          </div>
        </section>

        {/* DETAIL */}
        <aside
          style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--card)",
            overflowY: "auto",
          }}
        >
          {selectedNode ? (
            <ConceptDetail
              slug={slug}
              node={selectedNode}
              modules={modules}
              statusOf={statusOf}
              onJumpSelect={setSelected}
              onClose={onClose}
            />
          ) : (
            <div style={{ padding: 20, color: "var(--sub)", fontSize: 13 }}>
              点击左侧任意节点查看详情
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Node
// ──────────────────────────────────────────────────────────────────────────

function TreeNode({
  p,
  selected,
  dimmed,
  onClick,
}: {
  p: PositionedNode
  selected: boolean
  dimmed: boolean
  onClick: () => void
}) {
  const colors: Record<
    NodeStatus,
    { fill: string; stroke: string; ink: string }
  > = {
    mastered: { fill: "#EFE2D2", stroke: "#A67B5B", ink: "#5E412A" },
    active: { fill: "#fff", stroke: "#D97757", ink: "#9A4A2E" },
    available: { fill: "#fff", stroke: "#D97757", ink: "#7A3A1E" },
    locked: { fill: "#F0EEE7", stroke: "#999999", ink: "#9A9A9F" },
  }
  const c = colors[p.status]
  const w = p.w
  const h = p.h
  return (
    <g
      transform={`translate(${p.x - w / 2} ${p.y - h / 2})`}
      onClick={onClick}
      style={{ cursor: "pointer", opacity: dimmed ? 0.25 : 1, transition: "opacity 200ms" }}
    >
      {selected && (
        <rect
          x={-4}
          y={-4}
          width={w + 8}
          height={h + 8}
          rx="9"
          fill="none"
          stroke="#D97757"
          strokeWidth="1.4"
          strokeDasharray="3 3"
        />
      )}
      {p.status === "active" && (
        <rect
          x={-3}
          y={-3}
          width={w + 6}
          height={h + 6}
          rx="8"
          fill="none"
          stroke="#D97757"
          strokeOpacity=".25"
          strokeWidth="1"
        />
      )}
      <rect width={w} height={h} rx="6" fill={c.fill} stroke={c.stroke} strokeWidth="1" />
      <circle cx={10} cy={h / 2} r="3" fill={c.stroke} />
      <text
        x={20}
        y={h / 2 + 4}
        fontFamily="Inter, sans-serif"
        fontSize="11"
        fill={c.ink}
        fontWeight={selected ? 600 : 500}
      >
        {p.m.title.length > 16 ? p.m.title.slice(0, 16) + "…" : p.m.title}
      </text>
      <text
        x={w - 8}
        y={h / 2 + 4}
        textAnchor="end"
        fontFamily="JetBrains Mono"
        fontSize="9"
        fill={c.ink}
        opacity=".55"
      >
        {p.m.module_id}
      </text>
    </g>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Legend chip
// ──────────────────────────────────────────────────────────────────────────

function Legend({
  dot,
  t,
  active,
  onClick,
}: {
  dot: string
  t: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid var(--border-2)",
        background: active ? "var(--card)" : "transparent",
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        color: "var(--ink-2)",
        cursor: "pointer",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
      {t}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Detail panel
// ──────────────────────────────────────────────────────────────────────────

function ConceptDetail({
  slug,
  node,
  modules,
  statusOf,
  onJumpSelect,
  onClose,
}: {
  slug: string
  node: PositionedNode
  modules: TreeModule[]
  statusOf: Record<string, NodeStatus>
  onJumpSelect: (id: string) => void
  onClose: () => void
}) {
  const statusLabels: Record<NodeStatus, { t: string; pip: string; sub: string }> = {
    mastered: { t: "Mastered", pip: "ok", sub: "已学完" },
    active: { t: "In progress", pip: "run", sub: "你的当前进度" },
    available: { t: "Available", pip: "warn", sub: "前置都满足, 可以开始" },
    locked: { t: "Locked", pip: "idle", sub: "未 Pull 或前置未完成" },
  }
  const sl = statusLabels[node.status]

  const deps = (node.m.depends_on || [])
    .map((id) => modules.find((m) => m.module_id === id))
    .filter((m): m is TreeModule => !!m)

  // 反向找谁依赖当前 node
  const unlocks = modules.filter((m) =>
    (m.depends_on || []).includes(node.m.module_id),
  )

  return (
    <div>
      <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--border)" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--sub)" }}>
          {node.m.module_id} · module
        </div>
        <h2
          style={{
            fontSize: 20,
            lineHeight: 1.2,
            letterSpacing: "-.02em",
            marginTop: 6,
            fontWeight: 600,
          }}
        >
          {node.m.title}
        </h2>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`pip ${sl.pip}`}>{sl.t.toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--sub)" }}>
            {sl.sub}
          </span>
        </div>
      </div>

      {(node.m.summary || node.m.core_question) && (
        <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
          {node.m.summary && (
            <p className="body" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {node.m.summary}
            </p>
          )}
          {node.m.core_question && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "var(--violet-soft)",
                border: "1px solid var(--violet-line)",
                borderRadius: 8,
              }}
            >
              <div
                className="mono"
                style={{ fontSize: 10.5, color: "var(--violet-ink)", marginBottom: 4 }}
              >
                CORE QUESTION
              </div>
              <div style={{ fontSize: 13, color: "var(--violet-ink)" }}>
                {node.m.core_question}
              </div>
            </div>
          )}
        </div>
      )}

      <DetailBlock title="Prerequisites" count={deps.length}>
        {deps.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--sub-2)", padding: "8px 0" }}>
            无前置
          </div>
        ) : (
          deps.map((m) => (
            <DepRow
              key={m.module_id}
              t={m.title}
              code={m.module_id}
              status={statusOf[m.module_id] || "locked"}
              onClick={() => onJumpSelect(m.module_id)}
            />
          ))
        )}
      </DetailBlock>

      <DetailBlock title="Unlocks" count={unlocks.length}>
        {unlocks.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--sub-2)", padding: "8px 0" }}>
            无后续
          </div>
        ) : (
          unlocks.map((m) => (
            <DepRow
              key={m.module_id}
              t={m.title}
              code={m.module_id}
              status={statusOf[m.module_id] || "locked"}
              forward
              onClick={() => onJumpSelect(m.module_id)}
            />
          ))
        )}
      </DetailBlock>

      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(node.m.module_id)}`}
          className="btn btn-violet"
          style={{ justifyContent: "center" }}
          onClick={onClose}
        >
          <CirclePlay size={14} strokeWidth={1.5} /> 进入 {node.m.module_id} 学习
        </Link>
      </div>
    </div>
  )
}

function DetailBlock({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        style={{
          padding: "14px 22px 4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--sub)", letterSpacing: ".06em" }}
        >
          {title.toUpperCase()}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--sub-2)" }}>
          {count}
        </span>
      </div>
      <div style={{ padding: "0 22px 14px" }}>{children}</div>
    </div>
  )
}

function DepRow({
  t,
  code,
  status,
  forward,
  onClick,
}: {
  t: string
  code: string
  status: NodeStatus
  forward?: boolean
  onClick?: () => void
}) {
  const dot: Record<NodeStatus, string> = {
    mastered: "var(--emerald)",
    active: "var(--violet)",
    available: "var(--amber)",
    locked: "var(--sub-2)",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px dashed var(--border)",
        width: "100%",
        border: 0,
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 999, background: dot[status] }}
      />
      <span
        className="mono"
        style={{ fontSize: 10.5, color: "var(--sub-2)", width: 32 }}
      >
        {code}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: status === "locked" ? "var(--sub)" : "var(--ink-2)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {t}
      </span>
      {forward && (
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          style={{ color: "var(--sub-2)" }}
        />
      )}
    </button>
  )
}
