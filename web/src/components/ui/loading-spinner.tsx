"use client"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  label?: string
}

const SIZES = {
  sm: { wrapper: 20, stroke: 2 },
  md: { wrapper: 32, stroke: 3 },
  lg: { wrapper: 48, stroke: 3.5 },
}

export function LoadingSpinner({ size = "md", label }: LoadingSpinnerProps) {
  const s = SIZES[size]
  const r = (s.wrapper - s.stroke) / 2
  const cx = s.wrapper / 2
  const cy = s.wrapper / 2
  const circumference = 2 * Math.PI * r

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={s.wrapper}
        height={s.wrapper}
        viewBox={`0 0 ${s.wrapper} ${s.wrapper}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="animate-[loading-spin_0.8s_linear_infinite]"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="currentColor"
          strokeWidth={s.stroke}
          className="text-primary/15"
        />
        {/* Arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="currentColor"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
          className="text-primary"
        />
      </svg>

      {label && (
        <span className="text-sm text-muted-foreground animate-[loading-pulse_1.5s_ease-in-out_infinite]">
          {label}
        </span>
      )}
    </div>
  )
}
