"use client"

/**
 * spec 027: TeacherSceneView 在学生端 stub。
 * 老 web 这里有 3D 数字人讲课模式 (依赖 components/dighuman/)。
 * 学生端先不要 — stub 让 CourseContentView 不爆。spec 028 + dighuman 迁移后再启用。
 */

interface TeacherSceneViewProps {
  knode: unknown
  projectName: string
  nodeId: number
  versionLabel: string | null
}

export function TeacherSceneView(_props: TeacherSceneViewProps) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 text-sm text-muted-foreground">
      <p>3D 老师场景 (spec 028 启用)</p>
    </div>
  )
}
