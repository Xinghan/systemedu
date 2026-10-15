"use client"
import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react"
import { ALGORITHMS, settings, type ExperimentState } from "./algorithm-catalog"
import s from "./algorithm-lab.module.css"
const number=(x:number)=>Number.isInteger(x)?String(x):x.toFixed(4)
export function AlgorithmLab({id,state,update}:{id:string;state?:ExperimentState;update:(next:ExperimentState)=>void}) {
  const spec=ALGORITHMS[id],values=settings(id,state),frames=spec.frames(values)
  const step=Math.max(0,Math.min(frames.length-1,state?.step??0)),frame=frames[step]
  const [playing,setPlaying]=useState(false)
  const root=useRef<HTMLElement>(null)
  const latest=useRef({step,values,update})
  useEffect(()=>{latest.current={step,values,update}},[step,values,update])
  useEffect(()=>{
    if(!playing)return
    const timer=setInterval(()=>{
      if(document.hidden)return
      const box=root.current?.getBoundingClientRect()
      if(box&&(box.bottom<0||box.top>window.innerHeight))return
      const now=latest.current
      if(now.step>=frames.length-1){setPlaying(false);return}
      now.update({values:now.values,step:now.step+1})
    },2000)
    return()=>clearInterval(timer)
  },[playing,frames.length])
  const go=(next:number)=>{setPlaying(false);update({values,step:Math.max(0,Math.min(frames.length-1,next))})}
  const max=Math.max(...frame.values.map(Math.abs),1e-9)
  const points=frame.points
  const bounds=points?{xmin:Math.min(...points.map(p=>p[0])),xmax:Math.max(...points.map(p=>p[0])),ymin:Math.min(0,...points.map(p=>p[1])),ymax:Math.max(1,...points.map(p=>p[1]))}:null
  const xy=(p:number[])=>bounds?[40+(p[0]-bounds.xmin)/(bounds.xmax-bounds.xmin||1)*500,155-(p[1]-bounds.ymin)/(bounds.ymax-bounds.ymin||1)*130]:[0,0]
  return <section ref={root} id={`lab-${id}`} className={s.lab} aria-label={spec.title} data-algorithm={id}>
    <header className={s.heading}><span>{spec.kicker}</span><span>可交互计算 · {frames.length} 步</span></header>
    <h3>{spec.title}</h3><p className={s.question}>{spec.question}</p>
    <div className={s.controls}>{spec.controls.map(c=><label key={c.key}><span>{c.label}<output>{c.options?c.options[Math.round((values[c.key]-c.min)/c.step)]:number(values[c.key])}</output></span>{c.options?<select aria-label={c.label} value={values[c.key]} onChange={e=>{setPlaying(false);update({step:0,values:{...values,[c.key]:Number(e.target.value)}})}}>{c.options.map((label,i)=><option key={label} value={c.min+i*c.step}>{label}</option>)}</select>:<input aria-label={c.label} type="range" min={c.min} max={c.max} step={c.step} value={values[c.key]} onChange={e=>{setPlaying(false);update({step:0,values:{...values,[c.key]:Number(e.target.value)}})}}/>}</label>)}</div>
    <ol className={s.steps} aria-label="计算步骤">{frames.map((f,i)=><li key={i}><button aria-current={step===i?"step":undefined} onClick={()=>go(i)}><span>{String(i+1).padStart(2,"0")}</span>{f.title}</button></li>)}</ol>
    <div className={s.frame}>
      <div className={s.frameIntro} aria-live={playing?"off":"polite"}><span>STEP {step+1} / {frames.length}</span><h4>{frame.title}</h4><p>{frame.explain}</p><code>{frame.formula}</code></div>
      <div className={s.bars} aria-label="当前步骤数值">{frame.values.map((value,i)=><div className={s.barRow} key={frame.labels[i]}><span>{frame.labels[i]}</span><div className={s.barTrack}><i className={value<0?s.negative:""} style={{width:`${Math.max(0,Math.abs(value)/max*100)}%`}} /></div><output>{number(value)}</output></div>)}</div>
      {frame.matrix&&<div className={s.tableWrap}><table><caption>中间张量 · 行列与数值</caption><thead><tr><th scope="col"> </th>{frame.columns?.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{frame.matrix.map((row,i)=><tr key={i}><th scope="row">{frame.rows?.[i]??i}</th>{row.map((x,j)=><td key={j} className={x===0?s.zero:x<0?s.negativeCell:s.positiveCell}>{number(x)}</td>)}</tr>)}</tbody></table></div>}
      {points&&bounds&&<figure className={s.plot}><svg viewBox="0 0 580 190" role="img" aria-label={frame.axis}><path d="M40 20 V155 H550" fill="none" stroke="currentColor" opacity=".35"/>{bounds.ymin<0&&<path d={`M40 ${xy([0,0])[1]} H550`} stroke="currentColor" opacity=".2"/>}<polyline points={points.map(p=>xy(p).join(",")).join(" ")} fill="none" stroke="#087f68" strokeWidth="2"/>{points.map((p,i)=><circle key={i} cx={xy(p)[0]} cy={xy(p)[1]} r={3} fill="#087f68"><title>{p.map(number).join(", ")}</title></circle>)}<text x="40" y="178">{number(bounds.xmin)}</text><text x="520" y="178">{number(bounds.xmax)}</text><text x="3" y="28">{number(bounds.ymax)}</text></svg><figcaption>{frame.axis}</figcaption></figure>}
    </div>
    <div className={s.transport}><button onClick={()=>{if(step===frames.length-1)update({values,step:0});setPlaying(p=>!p)}}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?"暂停":"播放计算"}</button><button disabled={step===0} onClick={()=>go(step-1)} aria-label="上一步"><ChevronLeft size={16}/></button><button disabled={step===frames.length-1} onClick={()=>go(step+1)} aria-label="下一步"><ChevronRight size={16}/></button><span>{step+1} / {frames.length}</span><button className={s.reset} onClick={()=>{setPlaying(false);update({step:0,values:settings(id)})}}><RotateCcw size={14}/>重置</button></div>
    <div className={s.challenge}><strong>动手验证</strong><p>{spec.challenge}</p></div><p className={s.boundary}><strong>模型边界</strong> {spec.boundary}</p>
  </section>
}
