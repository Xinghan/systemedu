"use client"
/* eslint-disable @next/next/no-img-element -- Compressed mission artwork. */
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowRight, ArrowUpRight, FileCheck2, Radio, Compass } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { useMissionOperations } from "@/lib/hooks/use-mission-operations"
import { taskState, duration } from "@/lib/project-lines/mission-operations-core"
import { ENERGY_CAMPUS_POINTS, ENERGY_STATIONS, ENERGY_ENGINE, ENERGY_STEPS, ENERGY_TASKS, ENERGY_HOME, energyStation, energyNode, energyLessonHref, energyCenterHref } from "@/lib/project-lines/energy-mission"
import { RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { nodeProgressLabel } from "@/lib/project-lines/space-mission-progress"
import { energyControlConfig } from "./energy-mission-control"
import { EnergyBriefing } from "./energy-briefing"
import s from "./energy-journey.module.css"
export function EnergyJourney(){const {owner}=useLearningIdentity();return <Journey key={owner}/>}
function Journey(){
 const model=useMissionOperations(ENERGY_ENGINE),{ops,record}=model,query=useSearchParams(),router=useRouter()
 const [source,setSource]=useState(energyControlConfig.initialProgress)
 useEffect(()=>{let active=true;void energyControlConfig.readProgress(record.identity.token,record.identity.owner,(id,state)=>{if(active)setSource(p=>({...p,[id]:state}))});return()=>{active=false}},[record.identity.token,record.identity.owner])
 const started=ops&&ENERGY_TASKS.some(t=>t.role==="micro"&&taskState(ops,t.id).status==="done")
 const next=ops?ENERGY_TASKS.find(t=>taskState(ops,t.id).status==="active")||(!started&&!ENERGY_STEPS.some(id=>taskState(ops,id).status==="done")?ENERGY_TASKS[0]:ENERGY_TASKS.find(t=>t.role==="lesson"&&taskState(ops,t.id).status!=="done"))||ENERGY_TASKS.find(t=>t.id===ENERGY_STEPS.at(-1))!:ENERGY_TASKS[0]
 const station=energyStation(query.get("station")||"")||energyStation(next.station)!,total=ops?ENERGY_ENGINE.mainProgress(ops):{done:0,total:ENERGY_STEPS.length}
 const tasks=ENERGY_TASKS.filter(t=>t.station===station.id&&t.role!=="support")
 const stops:CampusStop[]=ENERGY_STATIONS.map((st,i)=>{const ids=st.steps.length?st.steps:ENERGY_TASKS.filter(t=>t.station===st.id).map(t=>t.id),done=ops?ids.filter(id=>taskState(ops,id).status==="done").length:0;return {...ENERGY_CAMPUS_POINTS[i],id:st.id,label:st.place,state:!record.ready?"loading":done===ids.length?"submitted":done?"draft":"new",statusLabel:`自检 ${done}/${ids.length}`}})
 const select=(id:string)=>router.replace(`${ENERGY_HOME}?station=${id}#journey-map`,{scroll:false})
 return <main className={s.page} data-energy-journey>
 <header className={s.nav}><Link href="/library?view=lines">← 项目线</Link><span><Radio size={14}/> 未来能源 · 任务站</span><Link href={energyCenterHref(next.id)}>任务中心 <ArrowUpRight size={15}/></Link></header>
 <section className={s.hero}><img className={s.heroImage} src="/mission/energy/stations/discovery-v1-1536.webp" srcSet="/mission/energy/stations/discovery-v1-960.webp 960w, /mission/energy/stations/discovery-v1-1536.webp 1536w" sizes="100vw" alt="无人能源工程实验室，实验台上的光伏、风轮与测量仪器，AI 场景示意" fetchPriority="high"/>
 <div className={s.heroCopy}><p className={s.kicker}>RENEWABLE ENERGY / 工程任务 003</p><h1>为一座观测站，<br/>把明天的能量准备好。</h1><p>从接住一束光开始，制造风光储装置、写出调度规则，再用真实测量检验功率预报。把能运行、能解释、能复查的能源站交给下一位工程师。</p><div className={s.heroActions}><Link className={s.primary} href={energyLessonHref(next.id)}>{next.role==="micro"?"从 3 分钟体验开始":"继续我的任务"}<ArrowRight size={18}/></Link><Link href={energyCenterHref(next.id)}>进入任务中心<ArrowUpRight size={17}/></Link></div><EnergyBriefing stationId={station.id} auto={record.ready}/></div><small className={s.sceneNote}>能源工程实验室 / AI 场景示意 · 非必购设备清单</small></section>
 <div className={s.body}><section className={s.metrics}><div><span>主线任务</span><strong>{record.ready?total.done:"—"}<small> / {ENERGY_STEPS.length} 步自检</small></strong></div><div><span>主动工作用时</span><strong>{record.ready?duration(Object.values(ops?.time.totals||{}).reduce((a,b)=>a+b,0)):"读取中"}</strong></div><div><span>你最终交付</span><strong>可复跑的能源工程档案</strong></div></section>
 <section className={s.intro}><div><p className={s.kicker}>YOUR FIRST ASSIGNMENT</p><h2>先让信号灯亮起，<br/>再让它可靠地工作。</h2></div><div><p>前三站认识光、风、储能与调度，第四站打印、装配、联调自己的能源站。第五站进入 pvlib 完整课程，重新校准、建立模型，再面对尚未发生的天气。</p><p>浏览器即可出发。数字原型可以先完成；实物阶段需低压器材、3D 打印或代打印及成人协助。进入真实预报后，按原课准备 Python 与采集环境。</p><small>自检、课堂提交和实物验收分别记录。实验室图片用于任务场景，实际器材按课堂清单准备；模拟与公开数据不冒充本人实测。</small></div></section>
 <section id="journey-map" className={s.mapSection}><div className={s.sectionHeading}><div><p className={s.kicker}>THE ENERGY LABORATORIES</p><h2>一座实验室，八站工程任务。</h2></div><Link href={energyCenterHref(next.id,"map")}><Compass size={17}/>在任务中心管理进度</Link></div><RoverCampusSurface stops={stops} current={next.station} selected={station.id} onSelect={select} title="未来能源 · 实验室任务地图" subtitle="沿实验室路线前进，每一站都有作品交接" mapMotto="采集 → 储能 → 联调 → 测量 → 预报 → 验证" taskId="energy-station" imageSrc="/mission/energy/campus-map-v1.webp" imageAlt="能源研发实验室室内剖视图，八个实验区沿中央走廊连接。"/>
 <div className={s.stationTabs}>{ENERGY_STATIONS.map(st=><button key={st.id} aria-pressed={st.id===station.id} onClick={()=>select(st.id)}>{st.code} {st.place}</button>)}</div>
 <article className={s.station} id="energy-station"><div><p className={s.kicker}>{station.code} / CURRENT ASSIGNMENT</p><h2>{station.place}</h2><p>{station.message}</p><dl><dt>带来</dt><dd>{station.input}</dd><dt>带走</dt><dd>{station.handoff}</dd><dt>交接标准</dt><dd>{station.gate}</dd></dl><Link className={s.primary} href={energyCenterHref(tasks[0].id)}>打开本站任务单<ArrowRight size={17}/></Link></div><div className={s.steps}>{tasks.map((t,i)=><Link key={t.id} href={energyLessonHref(t.id)}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{t.title}</strong><small>{t.role==="micro"?"任选体验 · 约 3 分钟":nodeProgressLabel(source[t.id])} · {ops&&taskState(ops,t.id).status==="done"?"已自检":"待自检"}</small></div><ArrowUpRight size={14}/></Link>)}</div></article></section>
 <section className={s.final}><FileCheck2 size={30}/><div><p className={s.kicker}>ENGINEERING HANDOVER</p><h2>交付装置，也交付它为何可信。</h2><p>打印与装配 → 校准与原始测量 → 封存的预报 → 首次验证 → 可复跑的交付包。</p><Link className={s.primary} href={energyCenterHref(ENERGY_STEPS.at(-1)!,"dossier")}>整理我的工程档案<ArrowRight size={16}/></Link></div></section>
 <details className={s.support}><summary>机构与测量补给 · 14 个按需节点</summary><p>需要时回到发电对照、打印传动与基础装配，补一小步再继续。这些是方法补给，不代替能源站自己的测试。</p>{ENERGY_STATIONS.map(st=>{const refs=ENERGY_TASKS.filter(t=>t.station===st.id&&t.role==="support");return refs.length?<details key={st.id}><summary>{st.place} · {refs.length} 个补给</summary>{refs.map(t=><Link key={t.id} href={energyLessonHref(t.id)}>{energyNode(t.id)?.module} · {t.title}<ArrowUpRight size={13}/></Link>)}</details>:null})}</details>
 </div></main>
}
