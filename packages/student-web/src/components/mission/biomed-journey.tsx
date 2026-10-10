"use client"
/* eslint-disable @next/next/no-img-element -- Compressed mission artwork. */
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowRight, ArrowUpRight, FileCheck2, Radio, Compass } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { useMissionOperations } from "@/lib/hooks/use-mission-operations"
import { taskState, duration } from "@/lib/project-lines/mission-operations-core"
import { BIO_CAMPUS_POINTS, BIO_STATIONS, BIO_ENGINE, BIO_STEPS, BIO_TASKS, BIO_HOME, bioStation, bioNode, bioLessonHref, bioCenterHref } from "@/lib/project-lines/biomed-mission"
import { RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { nodeProgressLabel } from "@/lib/project-lines/space-mission-progress"
import { biomedControlConfig } from "./biomed-mission-control"
import { BiomedBriefing } from "./biomed-briefing"
import s from "./biomed-journey.module.css"
export function BiomedJourney(){const {owner}=useLearningIdentity();return <Journey key={owner}/>}
function Journey(){
 const model=useMissionOperations(BIO_ENGINE),{ops,record}=model,query=useSearchParams(),router=useRouter()
 const [source,setSource]=useState(biomedControlConfig.initialProgress)
 useEffect(()=>{let active=true;void biomedControlConfig.readProgress(record.identity.token,record.identity.owner,(id,state)=>{if(active)setSource(p=>({...p,[id]:state}))});return()=>{active=false}},[record.identity.token,record.identity.owner])
 const started=ops&&BIO_TASKS.some(t=>t.role==="micro"&&taskState(ops,t.id).status==="done")
 const next=ops?BIO_TASKS.find(t=>taskState(ops,t.id).status==="active")||(!started&&!BIO_STEPS.some(id=>taskState(ops,id).status==="done")?BIO_TASKS[0]:BIO_TASKS.find(t=>t.role==="lesson"&&taskState(ops,t.id).status!=="done"))||BIO_TASKS.find(t=>t.id===BIO_STEPS.at(-1))!:BIO_TASKS[0]
 const station=bioStation(query.get("station")||"")||bioStation(next.station)!,total=ops?BIO_ENGINE.mainProgress(ops):{done:0,total:BIO_STEPS.length}
 const tasks=BIO_TASKS.filter(t=>t.station===station.id&&t.role!=="support")
 const stops:CampusStop[]=BIO_STATIONS.map((st,i)=>{const ids=st.steps.length?st.steps:BIO_TASKS.filter(t=>t.station===st.id).map(t=>t.id),done=ops?ids.filter(id=>taskState(ops,id).status==="done").length:0;return {...BIO_CAMPUS_POINTS[i],id:st.id,label:st.place,state:!record.ready?"loading":done===ids.length?"submitted":done?"draft":"new",statusLabel:`自检 ${done}/${ids.length}`}})
 const select=(id:string)=>router.replace(`${BIO_HOME}?station=${id}#journey-map`,{scroll:false})
 return <main className={s.page} data-biomed-journey>
 <header className={s.nav}><Link href="/library?view=lines">← 项目线</Link><span><Radio size={14}/> 分子寻药 · 任务站</span><Link href={bioCenterHref(next.id)}>任务中心 <ArrowUpRight size={15}/></Link></header>
 <section className={s.hero}><img className={s.heroImage} src="/mission/biomedicine/stations/observation-v2-1536.webp" srcSet="/mission/biomedicine/stations/observation-v2-960.webp 960w, /mission/biomedicine/stations/observation-v2-1536.webp 1536w" sizes="100vw" alt="无人的分子发现科研实验室，AI 场景示意" fetchPriority="high"/>
 <div className={s.heroCopy}><p className={s.kicker}>MOLECULAR DISCOVERY / 研究委托 002</p><h1>为一个分子，<br/>找到值得相信的证据。</h1><p>从第一张观察卡出发，一步步建立筛选器、检验 AI、研究真实数据。最后，把你的候选清单交给另一位研究者复核。</p><div className={s.heroActions}><Link className={s.primary} href={bioLessonHref(next.id)}>{next.role==="micro"?"从 3 分钟观察开始":"继续我的研究"}<ArrowRight size={18}/></Link><Link href={bioCenterHref(next.id)}>进入任务中心<ArrowUpRight size={17}/></Link></div><BiomedBriefing stationId={station.id} auto={record.ready}/></div><small className={s.sceneNote}>陈澄 · 虚构研究导师 / AI 场景示意</small></section>
 <div className={s.body}><section className={s.metrics}><div><span>主线任务</span><strong>{record.ready?total.done:"—"}<small> / 65 步自检</small></strong></div><div><span>研究用时</span><strong>{record.ready?duration(Object.values(ops?.time.totals||{}).reduce((a,b)=>a+b,0)):"读取中"}</strong></div><div><span>你最终交付</span><strong>可复跑的候选研究档案</strong></div></section>
 <section className={s.intro}><div><p className={s.kicker}>YOUR FIRST ASSIGNMENT</p><h2>先做一条观察，<br/>再追问一个问题。</h2></div><div><p>前四站用教学数据练习研究方法。第五站开始围绕真实靶点重新立项，进入 TeachOpenCADD 的完整研究流程。</p><p>只需电脑与浏览器即可出发。后半程代码复现需按原课准备 Python 环境；不会的知识可以从补给材料中随用随学。</p><small>自检是个人进度；课堂提交单独保存。候选不代表药效或安全性，不安排化学品实验或用药。</small></div></section>
 <section id="journey-map" className={s.mapSection}><div className={s.sectionHeading}><div><p className={s.kicker}>THE DISCOVERY CAMPUS</p><h2>一座基地，八个研究现场。</h2></div><Link href={bioCenterHref(next.id,"map")}><Compass size={17}/>在任务中心管理进度</Link></div><RoverCampusSurface stops={stops} current={next.station} selected={station.id} onSelect={select} title="分子寻药 · 研究基地地图" subtitle="沿证据链前进，每一站都有作品交接" mapMotto="观察 → 筛选 → 检验 → 系统 → 真实研究" taskId="bio-station" imageSrc="/mission/biomedicine/campus-map-v1.webp" imageAlt="分子发现研究基地鸟瞰图，八个建筑围绕中央广场，由步道相连。"/>
 <div className={s.stationTabs}>{BIO_STATIONS.map(st=><button key={st.id} aria-pressed={st.id===station.id} onClick={()=>select(st.id)}>{st.code} {st.place}</button>)}</div>
 <article className={s.station} id="bio-station"><div><p className={s.kicker}>{station.code} / CURRENT ASSIGNMENT</p><h2>{station.place}</h2><p>{station.message}</p><dl><dt>带来</dt><dd>{station.input}</dd><dt>带走</dt><dd>{station.handoff}</dd><dt>交接标准</dt><dd>{station.gate}</dd></dl><Link className={s.primary} href={bioCenterHref(tasks[0].id)}>打开本站任务单<ArrowRight size={17}/></Link></div><div className={s.steps}>{tasks.map((t,i)=><Link key={t.id} href={bioLessonHref(t.id)}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{t.title}</strong><small>{t.role==="micro"?"任选体验 · 约 3 分钟":nodeProgressLabel(source[t.id])} · {ops&&taskState(ops,t.id).status==="done"?"已自检":"待自检"}</small></div><ArrowUpRight size={14}/></Link>)}</div></article></section>
 <section className={s.final}><FileCheck2 size={30}/><div><p className={s.kicker}>RESEARCH HANDOVER</p><h2>交付结论，也交付结论的来处。</h2><p>研究协议 → 数据与版本 → 首次评价 → 候选理由 → 复现步骤与限制。</p><Link className={s.primary} href={bioCenterHref(BIO_STEPS.at(-1)!,"dossier")}>整理我的研究档案<ArrowRight size={16}/></Link></div></section>
 <details className={s.support}><summary>基础补给与原课程 · 47 个按需节点</summary><p>如果原理或代码挡住了你，按需要补一小步，再回到主任务。不必重新做另一套完整工程。</p>{BIO_STATIONS.map(st=>{const refs=BIO_TASKS.filter(t=>t.station===st.id&&t.role==="support");return refs.length?<details key={st.id}><summary>{st.place} · {refs.length} 个补给</summary>{refs.map(t=><Link key={t.id} href={bioLessonHref(t.id)}>{bioNode(t.id)?.module} · {t.title}<ArrowUpRight size={13}/></Link>)}</details>:null})}</details>
 </div></main>
}
