"use client"

/**
 * 12wave-inspired loading spinner.
 * Childlike illustration style: thick black outlines, bright orange/yellow/blue,
 * rounded shapes, space theme with scattered geometric elements.
 */

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  label?: string
}

const SIZES = {
  sm: { wrapper: 48, planet: 14, rocket: 10, orbit: 18, dots: true },
  md: { wrapper: 80, planet: 22, rocket: 16, orbit: 28, dots: true },
  lg: { wrapper: 120, planet: 34, rocket: 24, orbit: 44, dots: true },
}

export function LoadingSpinner({ size = "md", label }: LoadingSpinnerProps) {
  const s = SIZES[size]
  const cx = s.wrapper / 2
  const cy = s.wrapper / 2
  const strokeW = size === "sm" ? 1.5 : 2.5

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={s.wrapper}
        height={s.wrapper}
        viewBox={`0 0 ${s.wrapper} ${s.wrapper}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Scattered geometric dots */}
        {s.dots && (
          <>
            <circle cx={cx - s.orbit - 4} cy={cy - s.orbit + 2} r={size === "sm" ? 1 : 2} fill="#F97316" className="animate-[loading-twinkle_2s_ease-in-out_infinite]" />
            <circle cx={cx + s.orbit + 2} cy={cy + s.orbit - 6} r={size === "sm" ? 1.5 : 2.5} fill="#3B82F6" className="animate-[loading-twinkle_2s_ease-in-out_0.7s_infinite]" />
            <rect
              x={cx + s.orbit - 2}
              y={cy - s.orbit + 1}
              width={size === "sm" ? 2.5 : 4}
              height={size === "sm" ? 2.5 : 4}
              fill="#FBBF24"
              transform={`rotate(45 ${cx + s.orbit} ${cy - s.orbit + 3})`}
              className="animate-[loading-twinkle_2s_ease-in-out_1.3s_infinite]"
            />
            <polygon
              points={trianglePoints(cx - s.orbit + 3, cy + s.orbit - 2, size === "sm" ? 3 : 5)}
              fill="#3B82F6"
              className="animate-[loading-twinkle_2s_ease-in-out_0.4s_infinite]"
            />
          </>
        )}

        {/* Planet (yellow/orange) with thick outline */}
        <circle
          cx={cx}
          cy={cy}
          r={s.planet}
          fill="#FBBF24"
          stroke="#1a1a1a"
          strokeWidth={strokeW}
        />
        {/* Planet spots */}
        <circle cx={cx - s.planet * 0.3} cy={cy + s.planet * 0.2} r={s.planet * 0.18} fill="#F97316" opacity={0.6} />
        <circle cx={cx + s.planet * 0.25} cy={cy - s.planet * 0.3} r={s.planet * 0.12} fill="#F97316" opacity={0.4} />

        {/* Orbit path (dotted) */}
        <circle
          cx={cx}
          cy={cy}
          r={s.orbit}
          stroke="#1a1a1a"
          strokeWidth={size === "sm" ? 0.5 : 1}
          strokeDasharray={size === "sm" ? "2 3" : "3 5"}
          opacity={0.15}
        />

        {/* Rocket orbiting */}
        <g className="animate-[loading-orbit_2s_linear_infinite]" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <g transform={`translate(${cx + s.orbit}, ${cy})`}>
            {/* Rocket body */}
            <g transform={`rotate(90) translate(${-s.rocket / 2}, ${-s.rocket / 3})`}>
              {/* Body */}
              <rect
                x={0}
                y={0}
                width={s.rocket * 0.65}
                height={s.rocket}
                rx={s.rocket * 0.3}
                fill="white"
                stroke="#1a1a1a"
                strokeWidth={strokeW * 0.8}
              />
              {/* Window */}
              <circle
                cx={s.rocket * 0.325}
                cy={s.rocket * 0.35}
                r={s.rocket * 0.13}
                fill="#3B82F6"
                stroke="#1a1a1a"
                strokeWidth={strokeW * 0.5}
              />
              {/* Flame */}
              <path
                d={`M${s.rocket * 0.1},${s.rocket} L${s.rocket * 0.325},${s.rocket * 1.35} L${s.rocket * 0.55},${s.rocket}`}
                fill="#F97316"
                stroke="#1a1a1a"
                strokeWidth={strokeW * 0.5}
                strokeLinejoin="round"
                className="animate-[loading-flame_0.3s_ease-in-out_infinite_alternate]"
              />
            </g>
          </g>
        </g>
      </svg>

      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

function trianglePoints(cx: number, cy: number, size: number): string {
  const h = size * Math.sqrt(3) / 2
  return `${cx},${cy - h * 0.67} ${cx - size / 2},${cy + h * 0.33} ${cx + size / 2},${cy + h * 0.33}`
}
