import { Camera, CheckCircle2, Flag, Focus, PackageCheck, ScanLine, UserRound } from 'lucide-react'
import type { CourseLesson } from '../content'
import type { ReactNode } from 'react'

export interface CrewIdentity { name: string; role: string; duty: string; avatar: string }
declare global { interface Window { __systemeduCrew?: CrewIdentity } }
export function currentCrew(): CrewIdentity | undefined {
  const value = window.__systemeduCrew
  if (!value || typeof value.name !== 'string' || typeof value.role !== 'string' || typeof value.avatar !== 'string') return undefined
  if (!(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.avatar) && value.avatar.length < 150000) && !/^\/mission\/space\/expedition-v2\/crew\/(observer|engineer|navigator)\.png$/.test(value.avatar)) return undefined
  return {name:value.name.slice(0,20),role:value.role.slice(0,30),duty:String(value.duty ?? '').slice(0,100),avatar:value.avatar}
}
export function CrewPortrait({crew, size = 'normal'}: {crew?: CrewIdentity; size?: 'normal' | 'small'}) {
  return crew ? <img className={'mission-crew-portrait '+size} src={crew.avatar} alt={`${crew.name}的卡通形象`}/> : <UserRound size={30}/>
}
export function MissionTaskIntro({lesson, crew, entry}: {lesson: CourseLesson; crew?: CrewIdentity; entry?: ReactNode}) {
  const mission = lesson.expedition
  if (!mission) return null
  const icons = mission.chapterId === 'first-contact' ? [Focus, ScanLine, Camera] : [Focus, ScanLine, PackageCheck]
  return <section className="mission-task-intro" aria-label="本章任务说明">
    <div className="mission-scene"><img src={mission.image} alt={`${mission.chapterTitle}的任务场景`}/><div><span>{mission.act} / 第 {mission.chapterNumber} 章</span><h1>{mission.chapterTitle}</h1><p>{mission.arrival}</p></div></div>
    <div className="mission-owner"><CrewPortrait crew={crew}/><div><strong>{crew ? `${crew.name}，这是你的任务` : '这是你的任务'}</strong><p>{crew ? `${crew.role} · ${crew.duty}` : '把自己的观察和操作留在作品中'}</p></div><span className="mission-step-count">步骤 {mission.step} / {mission.total}</span></div>
    <ol className="mission-action-steps">{mission.actions.map((text,index) => {const Icon=icons[index % icons.length];return <li key={text}><Icon size={21}/><span><small>0{index+1}</small>{text}</span></li>})}</ol>
    <div className="mission-outcome"><Flag size={20}/><span>本章带走<strong>{mission.outcome}</strong></span></div>
    {entry && <div className="mission-intro-entry">{entry}</div>}
  </section>
}
export function MissionOperationBar({crew, title, saved}: {crew?: CrewIdentity; title: string; saved?: boolean}) {
  return <div className={'mission-operation-bar'+(saved ? ' is-saved' : '')} aria-label="队员操作席">
    <CrewPortrait crew={crew} size="small"/><div><strong>{crew ? `${crew.name}的操作席` : '你的操作席'}</strong><span>{saved ? '作品已保存，返回课堂后可整理本章成果。' : title}</span></div>
    {saved && <CheckCircle2 size={22} aria-label="作品已保存"/>}
  </div>
}
