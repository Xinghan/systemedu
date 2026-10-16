"use client"
/* eslint-disable @next/next/no-img-element -- Compressed mission artwork. */
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowRight, ArrowUpRight, FileCheck2, Radio, Compass } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { useMissionOperations } from "@/lib/hooks/use-mission-operations"
import { taskState, duration } from "@/lib/project-lines/mission-operations-core"
import { BIO_GROUPS, BIO_FOUNDATIONS, bioGroupFor, bioSourceHref, bioNextTask, BIO_CAMPUS_POINTS, BIO_STATIONS, BIO_ENGINE, BIO_STEPS, BIO_TASKS, BIO_HOME, bioStation, bioNode, bioLessonHref, bioCenterHref } from "@/lib/project-lines/biomed-mission"
import { RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { nodeProgressLabel } from "@/lib/project-lines/space-mission-progress"
import { biomedControlConfig } from "./biomed-mission-control"
import { BiomedFoundationDownload } from "./biomed-foundation-download"
import { BiomedBriefing } from "./biomed-briefing"
import s from "./biomed-journey.module.css"
import g from "./biomed-task-context.module.css"
export function BiomedJourney(){const {owner}=useLearningIdentity();return <Journey key={owner}/>}
function Journey(){
 const model=useMissionOperations(BIO_ENGINE),{ops,record}=model,query=useSearchParams(),router=useRouter()
 const [source,setSource]=useState(biomedControlConfig.initialProgress)
 useEffect(()=>{let active=true;void biomedControlConfig.readProgress(record.identity.token,record.identity.owner,(id,state)=>{if(active)setSource(p=>({...p,[id]:state}))});return()=>{active=false}},[record.identity.token,record.identity.owner])
 const next=bioNextTask(ops)
 const station=bioStation(query.get("station")||"")||bioStation(next.station)!,total=ops?BIO_ENGINE.mainProgress(ops):{done:0,total:BIO_STEPS.length}
 const tasks=BIO_TASKS.filter(t=>t.station===station.id&&t.role!=="support")
 const stops:CampusStop[]=BIO_STATIONS.map((st,i)=>{const ids=st.steps.length?st.steps:BIO_TASKS.filter(t=>t.station===st.id).map(t=>t.id),done=ops?ids.filter(id=>taskState(ops,id).status==="done").length:0;return {...BIO_CAMPUS_POINTS[i],id:st.id,label:st.place,state:!record.ready?"loading":(st.steps.length?done===ids.length:done>0)?"submitted":done?"draft":"new",statusLabel:st.steps.length?`自检 ${done}/${ids.length}`:done?"已启程 · 体验任选一个":"任选一个体验启程"}})
 const select=(id:string)=>router.replace(`${BIO_HOME}?station=${id}#journey-map`,{scroll:false})
 return <main className={s.page} data-biomed-journey>
 <header className={s.nav}><Link href="/library?view=lines">← 项目线</Link><span><Radio size={14}/> 分子寻药 · 任务站</span><Link href={bioCenterHref(next.id)}>任务中心 <ArrowUpRight size={15}/></Link></header>
 <section className={s.hero}><img className={s.heroImage} src="/mission/biomedicine/stations/observation-v2-1536.webp" srcSet="/mission/biomedicine/stations/observation-v2-960.webp 960w, /mission/biomedicine/stations/observation-v2-1536.webp 1536w" sizes="100vw" alt="无人的分子发现科研实验室，AI 场景示意" fetchPriority="high"/>
 <div className={s.heroCopy}><p className={s.kicker}>MOLECULAR DISCOVERY / 研究委托 002</p><h1>为一个分子，<br/>找到值得相信的证据。</h1><p>从第一张观察卡出发，一步步建立筛选器、检验 AI、研究真实数据。最后，把你的候选清单交给另一位研究者复核。</p><div className={s.heroActions}><Link className={s.primary} href={bioLessonHref(next.id)}>{next.role==="micro"?"从 3 分钟观察开始":"继续我的研究"}<ArrowRight size={18}/></Link><Link href={bioCenterHref(next.id)}>进入任务中心<ArrowUpRight size={17}/></Link></div><BiomedBriefing stationId={station.id} auto={record.ready}/></div><small className={s.sceneNote}>陈澄 · 虚构研究导师 / AI 场景示意</small></section>
 <div className={s.body}><section className={s.metrics}><div><span>主线任务</span><strong>{record.ready?total.done:"—"}<small> / {BIO_STEPS.length} 步自检</small></strong></div><div><span>研究用时</span><strong>{record.ready?duration(Object.values(ops?.time.totals||{}).reduce((a,b)=>a+b,0)):"读取中"}</strong></div><div><span>你最终交付</span><strong>可复跑的候选研究档案</strong></div></section>
 <section className={s.intro}><div><p className={s.kicker}>YOUR FIRST ASSIGNMENT</p><h2>先做一条观察，<br/>再追问一个问题。</h2></div><div><p>从研究问题开始，沿着同一条证据链调用已有课程：立项、整理数据、筛选、预测、连接系统、评价与交付。112 个课堂节点组成 22 个任务段，每一段都接住前一段的作品。</p><p>只需电脑与浏览器即可出发。后半程代码复现需按原课准备 Python 环境；教学练习、性质建模与正式靶点研究各自保留数据和版本，迁移方法时重新核对，不能直接混用结果。</p><small>自检是个人进度；课堂提交单独保存。候选不代表药效或安全性，不安排化学品实验或用药。</small></div></section>
 <section id="journey-map" className={s.mapSection}><div className={s.sectionHeading}><div><p className={s.kicker}>THE DISCOVERY CAMPUS</p><h2>一座基地，八个研究现场。</h2></div><Link href={bioCenterHref(next.id,"map")}><Compass size={17}/>在任务中心管理进度</Link></div><RoverCampusSurface stops={stops} current={next.station} selected={station.id} onSelect={select} title="分子寻药 · 研究基地地图" subtitle="沿证据链前进，每一站都有作品交接" mapMotto="观察 → 立项 → 数据 → 筛选 → 预测 → 系统 → 评价 → 交付" taskId="bio-station" imageSrc="/mission/biomedicine/campus-map-v1.webp" imageAlt="分子发现研究基地鸟瞰图，八个建筑围绕中央广场，由步道相连。"/>
 <div className={s.stationTabs}>{BIO_STATIONS.map(st=><button key={st.id} aria-pressed={st.id===station.id} onClick={()=>select(st.id)}>{st.code} {st.place}</button>)}</div>
 <article className={s.station} id="bio-station"><div><p className={s.kicker}>{station.code} / CURRENT ASSIGNMENT</p><h2>{station.place}</h2><p>{station.message}</p><dl><dt>带来</dt><dd>{station.input}</dd><dt>带走</dt><dd>{station.handoff}</dd><dt>交接标准</dt><dd>{station.gate}</dd></dl><Link className={s.primary} href={bioCenterHref(tasks[0].id)}>打开本站任务单<ArrowRight size={17}/></Link></div><div className={s.steps}>{station.steps.length?BIO_GROUPS.filter(group=>group.station===station.id).map(group=><details className={g.group} key={group.id+station.id} open={group.steps.includes(next.id)} data-journey-group={group.id}><summary><span>{String(BIO_GROUPS.indexOf(group)+1).padStart(2,"0")}</span><strong>{group.title}</strong><small>{group.steps.length} 步</small></summary><p>本段交付：{group.output}</p>{group.steps.map(id=>{const n=bioNode(id)!;return <Link key={id} href={bioLessonHref(id)}><span>{n.module}</span><strong>{n.title}</strong><small>{nodeProgressLabel(source[id])} · {ops&&taskState(ops,id).status==="done"?"已自检":"待自检"}</small></Link>})}</details>):tasks.map(t=><Link key={t.id} href={bioLessonHref(t.id)}><div><strong>{t.title}</strong><small>任选一个体验 · 约 3 分钟</small></div><ArrowUpRight size={14}/></Link>)}</div></article></section>
 <section className={s.final}><FileCheck2 size={30}/><div><p className={s.kicker}>RESEARCH HANDOVER</p><h2>交付结论，也交付结论的来处。</h2><p>研究协议 → 数据与版本 → 首次评价 → 候选理由 → 复现步骤与限制。</p><Link className={s.primary} href={bioCenterHref(BIO_STEPS.at(-1)!,"dossier")}>整理我的研究档案<ArrowRight size={16}/></Link></div></section>
 <details className={s.support} data-biomed-source-index><summary>原课程节点与新任务对照 · {BIO_STEPS.length} 个节点完整保留</summary><p>原课堂的内容、媒体、作业、记录标识与独立入口均保留。这里改变的是调用顺序：相近内容分别承担观察、练习、正式研究或复核的任务。</p><p>原先在补给中的 47 个节点已纳入主线，主线自检总数因此变为 112；已完成的状态和用时原样保留，不会自动补齐其他节点。</p>{[...new Set(BIO_TASKS.filter(t=>t.role==="lesson").map(t=>bioNode(t.id)!.project))].map(project=><details key={project}><summary>{project}</summary><table className={g.sourceTable}><thead><tr><th>原课堂</th><th>现在参与的任务段</th><th>独立入口</th></tr></thead><tbody>{BIO_TASKS.filter(t=>bioNode(t.id)?.project===project).sort((a,b)=>bioNode(a.id)!.module.localeCompare(bioNode(b.id)!.module)).map(t=><tr key={t.id}><td>{bioNode(t.id)!.module} · {t.title}</td><td><Link href={bioLessonHref(t.id)}>{bioGroupFor(t.id)!.title}</Link></td><td><Link href={bioSourceHref(t.id)}>原课程 ↗</Link></td></tr>)}</tbody></table></details>)}<details><summary>11 份基础桥原文 · 沿用原课程访问权限</summary>{BIO_FOUNDATIONS.map(f=><p key={f.id}>{f.title} · <code>{f.path}</code><br/><BiomedFoundationDownload id={f.id}/></p>)}</details></details>
 </div></main>
}
