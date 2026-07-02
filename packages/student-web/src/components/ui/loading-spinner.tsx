"use client"

/** 全局 loading 图标 — 轨道绕行 (科技感 + 可爱)。
 *  中心核心点呼吸缩放, 卫星沿椭圆轨道绕行, 呼应 SystemEdu 工业项目
 *  (卫星/原子/电路)的产品意象。暖色系(--primary 珊瑚)。
 *  size="xs" 用于嵌入文字行内的极小指示器, 只留单轨道单卫星。
 */

interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg"
  label?: string
  /** 内联模式: 不做整体居中的 flex 包裹, 用于嵌进一行文字/按钮里 */
  inline?: boolean
}

const SIZES = {
  xs: { box: 14, core: 1.8, sat1: 1.6, sat2: 0 },
  sm: { box: 28, core: 3, sat1: 2.4, sat2: 1.8 },
  md: { box: 44, core: 4.5, sat1: 3.4, sat2: 2.6 },
  lg: { box: 64, core: 6, sat1: 4.6, sat2: 3.4 },
}

export function LoadingSpinner({ size = "md", label, inline = false }: LoadingSpinnerProps) {
  const s = SIZES[size]
  const cx = s.box / 2
  const cy = s.box / 2
  const single = size === "xs"

  const icon = (
    <svg
      width={s.box}
      height={s.box}
      viewBox={`0 0 ${s.box} ${s.box}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 轨道 1 (外, 扁椭圆) */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={s.box * 0.46}
        ry={s.box * 0.22}
        stroke="var(--primary)"
        strokeOpacity="0.16"
        strokeWidth={single ? 1 : 1.5}
      />
      {!single && (
        /* 轨道 2 (内, 竖椭圆, 与轨道1交叉出十字观感) */
        <ellipse
          cx={cx}
          cy={cy}
          rx={s.box * 0.22}
          ry={s.box * 0.42}
          stroke="var(--primary)"
          strokeOpacity="0.16"
          strokeWidth="1.5"
        />
      )}

      {/* 核心: 呼吸缩放 */}
      <circle
        cx={cx}
        cy={cy}
        r={s.core}
        fill="var(--primary)"
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: "loading-core-pulse 1.4s ease-in-out infinite",
        }}
      />

      {/* 卫星 1: 沿外轨道(扁椭圆)绕行 */}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "loading-orbit-1 1.6s linear infinite" }}>
        <circle cx={cx + s.box * 0.46} cy={cy} r={s.sat1} fill="var(--primary)" />
      </g>

      {!single && (
        /* 卫星 2: 沿内轨道(竖椭圆)绕行, 反方向+不同速度 */
        <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "loading-orbit-2 2.3s linear infinite reverse" }}>
          <circle cx={cx} cy={cy - s.box * 0.42} r={s.sat2} fill="var(--primary-ink)" fillOpacity="0.85" />
        </g>
      )}
    </svg>
  )

  const keyframes = (
    <style jsx>{`
      @keyframes loading-core-pulse {
        0%, 100% { transform: scale(0.85); opacity: 0.75; }
        50% { transform: scale(1.15); opacity: 1; }
      }
      @keyframes loading-orbit-1 {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes loading-orbit-2 {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes loading-label-pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
    `}</style>
  )

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 align-middle">
        {icon}
        {label && <span style={{ color: "var(--sub)" }}>{label}</span>}
        {keyframes}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {icon}
      {label && (
        <span
          className="text-sm"
          style={{ color: "var(--sub)", animation: "loading-label-pulse 1.6s ease-in-out infinite" }}
        >
          {label}
        </span>
      )}
      {keyframes}
    </div>
  )
}
