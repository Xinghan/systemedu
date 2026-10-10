"use client"
/* eslint-disable @next/next/no-img-element -- Responsive precompressed narrative scenes. */
import { useEffect, useRef, useState } from "react"
import { Pause, Play, X, ArrowRight } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { bioStation } from "@/lib/project-lines/biomed-mission"
import s from "./biomed-journey.module.css"
export function BiomedBriefing({stationId,auto=true}:{stationId:string;auto?:boolean}) {
 const {owner}=useLearningIdentity()
 return <BriefingSession key={`${owner}:${stationId}`} stationId={stationId} owner={owner} auto={auto}/>
}
function BriefingSession({stationId,owner,auto}:{stationId:string;owner:string;auto:boolean}){
 const station=bioStation(stationId)!,dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null)
 const [open,setOpen]=useState(false),[frame,setFrame]=useState(0),[playing,setPlaying]=useState(false)
 const key=`systemedu:biomed-briefing:1:${owner}:${stationId}`
 const frames=[{label:"任务联络 · 陈澄 / 计算药物研究员（虚构角色）",title:station.message,text:stationId==="observation"?"欢迎来到分子发现基地。我是陈澄。我们要为一个候选分子建立值得信任的研究证据。先从你的第一条观察开始。":`你现在来到${station.place}。${station.input}。`},{label:"这一站的工作",title:"带回一件可以检查的作品",text:station.handoff},{label:"交接前的检查",title:"让下一位研究者看懂你的证据",text:station.gate}]
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active||!auto)return;try{if(localStorage.getItem(key))return}catch{/* Still allow the mission without persistent storage. */}setOpen(true);setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches)});return()=>{active=false}},[auto,key])
 useEffect(()=>{if(!open)return;const el=dialog.current;if(!el)return;el.showModal();return()=>el.close()},[open])
 useEffect(()=>{if(!open||!playing)return;const timer=setInterval(()=>{if(document.hidden)return;setFrame(n=>Math.min(2,n+1))},8000);return()=>clearInterval(timer)},[open,playing])
 useEffect(()=>{const motion=matchMedia("(prefers-reduced-motion: reduce)");const stop=()=>{if(motion.matches)setPlaying(false)};motion.addEventListener("change",stop);return()=>motion.removeEventListener("change",stop)},[])
 const close=()=>{try{localStorage.setItem(key,"seen")}catch{}setOpen(false);setPlaying(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}))}
 return <><button ref={trigger} className={s.textButton} data-biomed-briefing-replay onClick={()=>{setFrame(0);setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches);setOpen(true)}}><Play size={15}/>阶段场景简报</button>
 {open&&<dialog ref={dialog} className={s.film} aria-labelledby="bio-briefing-title" onCancel={e=>{e.preventDefault();close()}} data-biomed-briefing>
 <div className={s.filmScene} data-playing={playing} key={frame}><img src={`/mission/biomedicine/stations/${station.id}-v1-1536.webp`} alt={`${station.place}的科研场景示意`} onError={e=>{e.currentTarget.style.opacity="0"}}/></div>
 <div className={s.filmTop}><span>MOLECULAR DISCOVERY / {station.code}</span><button autoFocus onClick={close} aria-label="关闭简报"><X size={20}/></button></div>
 <div className={s.filmCopy} key={`copy-${frame}`}><p>{frames[frame].label}</p><h2 id="bio-briefing-title">{frames[frame].title}</h2><div>{frames[frame].text}</div></div>
 <div className={s.filmControls}><button onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?"暂停":"播放"}</button><div className={s.frames}>{frames.map((_,i)=><button key={i} aria-label={`简报第 ${i+1} 幕`} aria-current={frame===i?"step":undefined} onClick={()=>{setPlaying(false);setFrame(i)}}>{i+1}</button>)}</div><button onClick={close}>{frame===2?"开始本站任务":"跳过，进入任务"}<ArrowRight size={16}/></button></div><small className={s.filmNote}>图片动态简报 · AI 场景示意 · 无需打开声音</small>
 </dialog>}</>
}
