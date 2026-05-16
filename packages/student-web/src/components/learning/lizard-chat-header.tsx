"use client"

/** spec 027: LizardChatHeader 在学生端 stub。原版 2D 蜥蜴老师。spec 028 启用。 */

export function LizardChatHeader({ height = 260 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 text-xs text-muted-foreground"
    >
      AI 助教 (spec 028)
    </div>
  )
}
