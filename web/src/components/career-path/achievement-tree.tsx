"use client"

import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import type { CareerPathDetail } from "@/lib/api"
import type { TranslationKey } from "@/lib/i18n"

type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string

interface Props {
  detail: CareerPathDetail
  t: TFunc
}

// Fixed colors that work inside SVG (CSS variables don't resolve in SVG attrs)
const C = {
  trunk: "#7c3aed",        // purple-600
  trunkLight: "#a78bfa",   // purple-400
  branch: "#8b5cf6",       // purple-500
  earnedFill1: "#fbbf24",  // amber-400
  earnedFill2: "#f59e0b",  // amber-500
  earnedFill3: "#d97706",  // amber-600
  earnedStroke: "#f59e0b",
  earnedGlow: "#fbbf2480",
  lockedFill1: "#d1d5db",  // gray-300
  lockedFill2: "#9ca3af",  // gray-400
  lockedStroke: "#e5e7eb",  // gray-200
  textDark: "#1f2937",      // gray-800
  textMuted: "#9ca3af",     // gray-400
  iconWhite: "#ffffff",
  iconMuted: "#6b7280",     // gray-500
}

export function AchievementTree({ detail, t }: Props) {
  const stages = detail.stages
  const earnedSet = new Set(detail.earned_badges.map((b) => b.stage_order))

  const W = 800
  const H = 640
  const TX = W / 2
  const TT = 100   // trunk top
  const TB = H - 50 // trunk bottom

  const nodes = useMemo(() => {
    const n = stages.length
    if (n === 0) return []
    const yPad = 60
    const yRange = TB - TT - yPad * 2
    return stages.map((stage, i) => {
      const frac = n === 1 ? 0.5 : i / (n - 1)
      const y = TT + yPad + frac * yRange
      const isLeft = i % 2 === 0
      const spread = 180 + (1 - frac) * 60  // top branches wider
      const x = isLeft ? TX - spread : TX + spread
      return { stage, i, earned: earnedSet.has(stage.order), x, y, isLeft }
    })
  }, [stages, earnedSet])

  // Cubic bezier branch from trunk (TX, y) -> (node.x, node.y - 20)
  function branch(n: (typeof nodes)[0]) {
    const sy = n.y
    const ex = n.x
    const ey = n.y - 20
    const dx = Math.abs(ex - TX)
    const sign = n.isLeft ? -1 : 1
    const c1x = TX + sign * dx * 0.15
    const c1y = sy - 25
    const c2x = ex - sign * dx * 0.2
    const c2y = ey + 15
    return `M${TX},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`
  }

  // Small decorative sub-branches (twigs) off the main trunk
  const twigs = useMemo(() => {
    const result: string[] = []
    const count = 8
    for (let i = 0; i < count; i++) {
      const frac = (i + 0.5) / count
      const y = TT + frac * (TB - TT)
      const isLeft = i % 2 === 0
      const sign = isLeft ? -1 : 1
      const len = 25 + Math.random() * 30
      const ex = TX + sign * len
      const ey = y - 10 - Math.random() * 15
      result.push(`M${TX},${y} Q${TX + sign * len * 0.4},${y - 8} ${ex},${ey}`)
    }
    return result
  }, [])

  const activeFocus = nodes.find((n) => !n.earned)

  return (
    <div className="relative w-full bg-card/40 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-8 flex justify-between items-start z-10 pointer-events-none">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-1">
            {detail.path.title}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            {detail.path.description}
          </p>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold">
            {detail.earned_badges.length} {t("career.badges")}
          </span>
          {detail.progress.status !== "completed" && (
            <span className="px-3 py-1 bg-muted/50 text-muted-foreground border border-border/30 rounded-full text-xs font-bold">
              {stages.length - detail.earned_badges.length} {t("career.locked")}
            </span>
          )}
        </div>
      </div>

      {/* SVG Tree */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-6" style={{ minHeight: 420 }}>
        <defs>
          <linearGradient id="at-trunk" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.trunk} stopOpacity="0.06" />
            <stop offset="40%" stopColor={C.trunk} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.trunkLight} stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="at-earned" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor={C.earnedFill1} />
            <stop offset="55%" stopColor={C.earnedFill2} />
            <stop offset="100%" stopColor={C.earnedFill3} />
          </radialGradient>
          <radialGradient id="at-locked" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor={C.lockedFill1} />
            <stop offset="100%" stopColor={C.lockedFill2} />
          </radialGradient>
          <filter id="at-glow">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="at-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000020" />
          </filter>
        </defs>

        {/* Trunk */}
        <path
          d={`M${TX},${TB} C${TX - 6},${(TT + TB) / 2 + 30} ${TX + 6},${(TT + TB) / 2 - 30} ${TX},${TT}`}
          fill="none" stroke="url(#at-trunk)" strokeWidth="12" strokeLinecap="round"
        />
        {/* Trunk texture lines */}
        <path
          d={`M${TX - 2},${TB - 5} C${TX - 10},${(TT + TB) / 2 + 40} ${TX + 5},${(TT + TB) / 2 - 20} ${TX - 1},${TT + 15}`}
          fill="none" stroke={C.trunk} strokeWidth="1.5" opacity="0.08"
        />
        <path
          d={`M${TX + 2},${TB - 5} C${TX + 10},${(TT + TB) / 2 + 40} ${TX - 5},${(TT + TB) / 2 - 20} ${TX + 1},${TT + 15}`}
          fill="none" stroke={C.trunk} strokeWidth="1.5" opacity="0.08"
        />

        {/* Decorative twigs */}
        {twigs.map((d, i) => (
          <path key={`twig-${i}`} d={d} fill="none" stroke={C.trunk} strokeWidth="1.5" opacity="0.08" strokeLinecap="round" />
        ))}

        {/* Branches from trunk to nodes */}
        {nodes.map((node) => (
          <path
            key={`br-${node.i}`}
            d={branch(node)}
            fill="none"
            stroke={node.earned ? C.earnedStroke : C.branch}
            strokeWidth={node.earned ? 3 : 2}
            opacity={node.earned ? 0.6 : 0.15}
            strokeDasharray={node.earned ? "none" : "6 4"}
            strokeLinecap="round"
          />
        ))}

        {/* Badge nodes */}
        {nodes.map((node) => {
          const r = 34
          const cx = node.x
          const cy = node.y - 20

          return (
            <g key={`nd-${node.i}`} filter="url(#at-shadow)">
              {/* Glow ring for earned */}
              {node.earned && (
                <circle cx={cx} cy={cy} r={r + 8} fill="none"
                  stroke={C.earnedGlow} strokeWidth="3" filter="url(#at-glow)" />
              )}

              {/* Main circle */}
              <circle
                cx={cx} cy={cy} r={r}
                fill={node.earned ? "url(#at-earned)" : "url(#at-locked)"}
                stroke={node.earned ? C.earnedStroke : C.lockedStroke}
                strokeWidth={node.earned ? 2.5 : 1.5}
              />

              {/* Inner highlight arc (3D effect) */}
              <path
                d={`M${cx - r * 0.5},${cy - r * 0.6} A${r * 0.8},${r * 0.8} 0 0,1 ${cx + r * 0.5},${cy - r * 0.6}`}
                fill="none" stroke="white" strokeWidth="1.5"
                opacity={node.earned ? 0.4 : 0.15} strokeLinecap="round"
              />

              {/* Icon */}
              {node.earned ? (
                // Star icon (24x24 centered)
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 18.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
                  transform={`translate(${cx - 12},${cy - 12})`}
                  fill={C.iconWhite} opacity="0.9"
                />
              ) : (
                // Lock icon (24x24 centered)
                <g transform={`translate(${cx - 12},${cy - 12})`}>
                  <rect x="5" y="11" width="14" height="10" rx="2"
                    fill={C.iconMuted} opacity="0.5" />
                  <path d="M8 11V8a4 4 0 018 0v3" fill="none"
                    stroke={C.iconMuted} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
                </g>
              )}

              {/* Label */}
              <text
                x={cx} y={cy + r + 20}
                textAnchor="middle"
                fill={node.earned ? C.textDark : C.textMuted}
                fontSize="12" fontWeight="700" letterSpacing="0.02em"
              >
                {node.stage.badge?.name ?? `Stage ${node.stage.order}`}
              </text>
            </g>
          )
        })}

        {/* Root circle */}
        <circle cx={TX} cy={TB} r="6" fill={C.trunk} opacity="0.2"
          stroke={C.trunk} strokeWidth="2" strokeOpacity="0.15" />
        {/* Crown circle */}
        <circle cx={TX} cy={TT} r="4" fill={C.trunkLight} opacity="0.3" />
      </svg>

      {/* Active focus pill */}
      {activeFocus && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="px-5 py-3 bg-card/80 backdrop-blur-lg rounded-xl border border-border/40 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {t("career.in_progress")}
              </p>
              <p className="text-sm font-bold text-foreground">
                {activeFocus.stage.badge?.name ?? activeFocus.stage.project_name}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
