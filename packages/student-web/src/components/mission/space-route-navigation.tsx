import Link from "next/link"
import type { SpaceRoute } from "@/lib/project-lines/space-curriculum"
import s from "./space-transit-journey.module.css"

export function SpaceRouteNavigation({ route, control = false }: { route: SpaceRoute; control?: boolean }) {
  const base = control ? "/mission/space/control" : "/mission/space"
  return <nav className={s.routes} aria-label="星际远航研究路线">
    <Link href={`${base}?route=rover`} aria-current={route === "rover" ? "page" : undefined}><strong>火星地形观察远征</strong><span>8 个任务站 · 62 步 · 打印车与视觉控制</span></Link>
    <Link href={`${base}?route=transit`} aria-current={route === "transit" ? "page" : undefined}><strong>抓住行星的影子</strong><span>6 个任务站 · 32 步 · 真实数据与独立验证</span></Link>
  </nav>
}
