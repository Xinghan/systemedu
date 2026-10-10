"use client"

import Link from "next/link"
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ArrowRight, ChevronLeft, ChevronRight, FileCheck2, List } from "lucide-react"
import type { GuidedCourse } from "@/lib/project-lines/guided-course"
import type { CourseRecord } from "@/lib/project-lines/guided-progress"
import { MISSION_STATUS_LABEL, ROVER_BRIEFS, missionNodeHref, missionNodeStatus } from "@/lib/project-lines/rover-mission"
import { ROVER_CAMPUS_POINTS, RoverCampusSurface } from "./rover-campus-surface"
import s from "./rover-campus-map.module.css"

export type RoverMapProps = { course: GuidedCourse; record: CourseRecord; loaded: boolean; failed: string[]; current?: string }
export function RoverCampusMap({ course, record, loaded, failed, current = "M01", children }: RoverMapProps & { children: ReactNode }) {
  const [selected, setSelected] = useState(current)
  const [imageState, setImageState] = useState("ready")
  const unavailable = useCallback(() => setImageState("error"), [])
  const manualSelection = useRef(false)
  const uid = useId().replace(/:/g, "")
  useEffect(() => { if (!manualSelection.current) setSelected(current) }, [current])
  const stops = ROVER_CAMPUS_POINTS.map(point => {
    const state = missionNodeStatus(record.nodes[point.id], loaded, failed.includes(point.id))
    return { ...point, label: ROVER_BRIEFS[point.id].place, state, statusLabel: MISSION_STATUS_LABEL[state] }
  })
  const index = Math.max(0, stops.findIndex(n => n.id === selected))
  const node = course.modules.find(n => n.module_id === stops[index].id)!
  const brief = ROVER_BRIEFS[node.module_id]
  const status = stops[index].state
  const stageIndex = course.stages.findIndex(stage => stage.stage_id === node.stage_id)
  function choose(id: string) { manualSelection.current = true; setSelected(id) }
  function select(i: number) { choose(stops[Math.max(0, Math.min(stops.length - 1, i))].id) }
  return <div className={s.campus} data-campus-map>
    <RoverCampusSurface stops={stops} selected={selected} current={current} onSelect={choose} onUnavailable={unavailable} title="晨光探测车研发基地" subtitle="8 个地点 · 一辆你亲手造的车" mapMotto="从想法，到第一辆实物车。" taskId={`${uid}-task`} />
    <div className={s.mapFooter}><span>拖动探索 · ＋ / − 缩放 · 点击地点查看任务</span><div><span><i className={s.submittedDot} />记录已提交</span><span><i className={s.draftDot} />有草稿</span><span><i className={s.currentDot} />当前任务</span></div></div>
    <section id={`${uid}-task`} className={s.task} aria-label="所选地点的任务" data-campus-task={node.module_id}>
      <div className={s.taskNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
      <div className={s.taskBody}>
        <p className={s.eyebrow}>阶段 {String(stageIndex + 1).padStart(2, "0")} / {course.stages[stageIndex]?.title} <span aria-live="polite">{MISSION_STATUS_LABEL[status]}</span></p>
        <h3>{brief.place}<span>{node.title}</span></h3>
        <p className={s.action}>{brief.action}</p>
        <div className={s.output}><FileCheck2 size={16} /><span><small>这次带回的作品</small>{node.output}</span></div>
      </div>
      <div className={s.taskActions}>
        <Link href={missionNodeHref(node.module_id)} data-campus-enter>{status === "submitted" ? "回看任务" : "进入任务"}<ArrowRight size={17} /></Link>
        <span>{node.estimated_minutes} 分钟目标 · 可分次完成</span>
        <div className={s.nextPrevious}><button aria-label="上一个地点" disabled={index === 0} onClick={() => select(index - 1)}><ChevronLeft size={16} /></button><small>{index + 1} / 8</small><button aria-label="下一个地点" disabled={index === 7} onClick={() => select(index + 1)}><ChevronRight size={16} /></button></div>
      </div>
    </section>
    <details key={imageState === "error" ? "fallback" : "directory"} className={s.directory} open={imageState === "error" || undefined}><summary><List size={16} />简洁目录 · 查看全部 8 个节点</summary>{children}</details>
    <p className={s.caption}>AI 生成的虚构研发基地，用来呈现学习路线。地图标记学习记录，作品验收以实际提交的材料为准。</p>
  </div>
}
