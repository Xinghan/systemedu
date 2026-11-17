"use client"
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw, ZoomIn, ZoomOut, Scan, MousePointer2 } from 'lucide-react'
import { ALGORITHMS, settings, type ExperimentState } from './algorithm-catalog'
import { AlgorithmScene, inspect } from './scenes'
import { PRESENTATIONS, type Presentation } from './algorithm-presentations'
import s from './algorithm-lab.module.css'
const num=(x:number)=>Number.isInteger(x)?String(x):x.toFixed(3)
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x))
export function AlgorithmLab({id,state,update}:{id:string;state?:ExperimentState;update:(next:ExperimentState)=>void}){
 const spec=ALGORITHMS[id],presentation=PRESENTATIONS[id],values=settings(id,state),frames=spec.frames(values)
 const saved=clamp(state?.view?.time??state?.step??0,0,frames.length-1)
 const [playhead,setPlayhead]=useState<number|null>(null),[speed,setSpeed]=useState(1),[expanded,setExpanded]=useState(false),[hover,setHover]=useState<string|null>(null)
 const [camera,setCamera]=useState({x:0,y:0,zoom:1,yaw:35,pitch:25}),[viewport,setViewport]=useState({width:1000,height:550})
 const playing=playhead!==null,time=playhead??saved,step=Math.min(frames.length-1,Math.floor(time)),frame=frames[step]
 const mode=id==='lora'?(state?.view?.mode??'geometry'):'graph',focus=hover??state?.view?.focus??'',detail=inspect(id,values,focus,time)
 const uid=`pt-${id}`,root=useRef<HTMLElement>(null),canvas=useRef<HTMLDivElement>(null),expandButton=useRef<HTMLButtonElement>(null)
 const drag=useRef<{x:number;y:number;camera:typeof camera}|null>(null)
 const latest=useRef({values,update,state,time})
 useEffect(()=>{latest.current={values,update,state,time}},[values,update,state,time])
 useEffect(()=>{
  const el=canvas.current;if(!el)return
  const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setViewport({width:Math.max(1,r.width),height:Math.max(1,r.height)})});observer.observe(el)
  return()=>observer.disconnect()
 },[])
 useEffect(()=>{
  if(!expanded)return
  const before=document.body.style.overflow,button=expandButton.current;document.body.style.overflow='hidden';root.current?.focus()
  return()=>{document.body.style.overflow=before;button?.focus()}
 },[expanded])
 useEffect(()=>{
  if(!playing)return
  let raf=0,last=0,cursor=latest.current.time,lastSaved=Math.floor(cursor)
  const tick=(now:number)=>{
   const dt=last?(now-last)/1000:0;last=now
   const rect=root.current?.getBoundingClientRect(),visible=rect&&rect.bottom>0&&rect.top<window.innerHeight
   if(!document.hidden&&visible){
    cursor=Math.min(frames.length-1,cursor+Math.min(dt,.1)*speed/4)
    setPlayhead(cursor)
    if(Math.floor(cursor)!==lastSaved||cursor===frames.length-1){
     const {values,update,state}=latest.current;lastSaved=Math.floor(cursor)
     update({values,step:lastSaved,view:{time:cursor,focus:state?.view?.focus??'',mode:state?.view?.mode??(id==='lora'?'geometry':'graph')}})
    }
    if(cursor===frames.length-1){setPlayhead(null);return}
   }
   raf=requestAnimationFrame(tick)
  };raf=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(raf)
 },[playing,speed,frames.length,id])
 const commit=(nextTime:number,patch:Partial<ExperimentState>={})=>{
  const at=clamp(nextTime,0,frames.length-1)
  setPlayhead(null)
  update({values,step:Math.floor(at),view:{time:at,focus:state?.view?.focus??'',mode},...patch})
 }
 const pick=(key:string)=>{
  const [kind,row]=key.split(':'),v={...values}
  if(id==='attention'&&(kind==='query'||kind==='attention'))v.query=Number(row)
  if(id==='nf4'&&kind==='weight')v.index=Number(row)
  if(id==='policy'&&kind==='sample')v.sample=Number(row)
  if(id==='softmax'&&kind==='target')v.target=Number(row)
  if(id==='backprop'&&kind==='detach-switch')v.detach=values.detach?0:1
  if(id==='loragrad'&&kind==='zero-origin')v.zero=1
  if(id==='metrics'&&kind==='prediction')v.prediction=Number(row)
  const at=id==='optimizer'&&kind==='optimizer-step'?Number(row):id==='checkpoint'&&kind==='execution'?Number(row):id==='loragrad'&&kind==='init-iteration'?(Number(row)===0?0:Number(row)*2-1):id==='loragrad'&&kind==='zero-origin'?0:id==='metrics'&&kind==='metric-class'?Number(row)+1:time
  commit(at,{values:v,view:{time:at,focus:key,mode}})
 }
 const change=(key:string,value:number)=>commit(time,{values:{...values,[key]:value}})
 const act=(action:Presentation['actions'][number])=>{
  const next=action.command==='sample'?{...values,seed:values.seed%20+1}:{...values,...action.values},at=action.command==='sample'?1:action.time??time
  setHover(null);commit(at,{values:next,view:{time:at,focus:'',mode}})
  if(action.command==='sample')setPlayhead(1)
 }
 const mobileScale=Math.max(1,850/viewport.width),zoom=clamp(camera.zoom*mobileScale,.5,7),viewWidth=Math.max(1040,550*viewport.width/viewport.height)/zoom,viewHeight=viewWidth*viewport.height/viewport.width
 const fit=()=>setCamera({x:0,y:0,zoom:1/mobileScale,yaw:35,pitch:25})
 const keyDown=(e:React.KeyboardEvent<HTMLElement>)=>{
  if(e.key==='Escape'&&expanded){e.preventDefault();setExpanded(false)}
  if(e.key==='Tab'&&expanded){const controls=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')??[]);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 }
 const parameters=<div className={s.parameters}><strong>实验参数</strong><div>{spec.controls.map(c=><label key={c.key}><span>{c.label}<output>{c.options?c.options[Math.round((values[c.key]-c.min)/c.step)]:num(values[c.key])}</output></span>{c.options?<select aria-label={c.label} value={values[c.key]} onChange={e=>change(c.key,Number(e.target.value))}>{c.options.map((label,i)=><option key={label} value={c.min+i*c.step}>{label}</option>)}</select>:<input aria-label={c.label} type="range" min={c.min} max={c.max} step={c.step} value={values[c.key]} onChange={e=>change(c.key,Number(e.target.value))}/>}</label>)}</div></div>
 return <section ref={root} tabIndex={-1} onKeyDown={keyDown} id={`lab-${id}`} className={`${s.lab} ${expanded?s.expanded:''}`} role={expanded?'dialog':undefined} aria-modal={expanded?true:undefined} aria-label={spec.title} data-algorithm={id} data-visualization="spatial-explainer" data-surface={presentation.surface} data-layout={presentation.layout}>
  <header className={s.header}><div><span>{presentation.name}</span><h3>{spec.title}</h3></div><button ref={expandButton} onClick={()=>setExpanded(x=>!x)} aria-label={expanded?'退出沉浸视图':'展开沉浸视图'}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}<span>{expanded?'收起':'展开'}</span></button></header>
  <p className={s.instruction}>{presentation.hint}</p>
  <div className={s.actions} aria-label="场景操作">{presentation.actions.map(action=><button key={action.label} onClick={()=>act(action)}>{action.label}</button>)}</div>
  <div className={s.stageLayout}>
   <div className={s.stageColumn}>
    <div className={s.sceneToolbar}><span><MousePointer2 size={13}/> {mode==='geometry'?'拖动旋转空间':(['chain','preference','policy','softmax','backprop','accumulation','nf4'].includes(id)?'拖动十字把手 · 点击图中元素':'点击图中元素 · 空白处平移')}</span><div>{id==='lora'&&<button onClick={()=>{const next=mode==='geometry'?'graph':'geometry';commit(time,{view:{time,focus:'',mode:next}});setCamera(c=>({...c,x:0,y:0}))}}>{mode==='geometry'?'查看计算图':'查看几何空间'}</button>}<button onClick={()=>setCamera(c=>({...c,zoom:clamp(c.zoom/1.25,.3,4)}))} aria-label="缩小画布"><ZoomOut size={15}/></button><button onClick={()=>setCamera(c=>({...c,zoom:clamp(c.zoom*1.25,.3,4)}))} aria-label="放大画布"><ZoomIn size={15}/></button><button onClick={fit} aria-label="适配完整画布"><Scan size={15}/></button></div></div>
    <div ref={canvas} className={s.canvas}>
     <svg className={s.svg} viewBox={`${camera.x+(mode==='geometry'&&viewWidth<850?610-viewWidth/2:520-viewWidth/2)} ${camera.y+(550-viewHeight)/2} ${viewWidth} ${viewHeight}`} role="group" aria-label={`${spec.title}：${presentation.name}`} onPointerDown={e=>{if((e.target as Element).closest('[data-pick], [data-direct-drag]'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,camera}}} onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;setCamera(mode==='geometry'?{...d.camera,yaw:d.camera.yaw+dx*.35,pitch:clamp(d.camera.pitch+dy*.25,-70,70)}:{...d.camera,x:clamp(d.camera.x-dx*viewWidth/viewport.width,-400,1000),y:clamp(d.camera.y-dy*viewHeight/viewport.height,-300,550)})}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
      {presentation.layout==='theater'&&<><defs><pattern id={`${uid}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--scene-grid,#263448)" strokeOpacity=".35" strokeWidth=".6"/></pattern></defs><rect x="-500" y="-400" width="2200" height="1500" fill={`url(#${uid}-grid)`}/></>}
      <AlgorithmScene id={id} v={values} time={time} focus={focus} onPick={pick} onHover={setHover} setValue={change} geometry={mode==='geometry'} yaw={camera.yaw} pitch={camera.pitch}/>
     </svg>
    </div>
    <div className={s.transport}><button className={s.play} onClick={()=>{if(playing)commit(time);else setPlayhead(saved>=frames.length-1?0:saved)}}>{playing?<Pause size={17}/>:<Play size={17}/>}<span>{playing?'暂停':presentation.play}</span></button><button onClick={()=>commit(Math.ceil(time)-1)} disabled={time<=0} aria-label="上一步"><ChevronLeft size={18}/></button><button onClick={()=>commit(Math.floor(time)+1)} disabled={time>=frames.length-1} aria-label="下一步"><ChevronRight size={18}/></button><label className={s.timeline}><span>推演时间轴</span><input type="range" aria-label="推演时间轴" min="0" max={frames.length-1} step="0.01" value={time} onChange={e=>commit(Number(e.target.value))}/></label><output>{step+1}/{frames.length}</output><select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option></select><button aria-label="重置算法实验" onClick={()=>{setHover(null);setCamera({x:0,y:0,zoom:1,yaw:35,pitch:25});commit(0,{values:settings(id),view:{time:0,focus:'',mode:id==='lora'?'geometry':'graph'}})}}><RotateCcw size={16}/></button></div>
    <ol className={s.chapters} aria-label="推演章节">{frames.map((f,i)=><li key={i}><button aria-current={step===i?'step':undefined} onClick={()=>commit(i)}><span>{String(i+1).padStart(2,'0')}</span>{f.title}</button></li>)}</ol>
   </div>
  </div>
  <div className={s.caption} aria-label="当前推演说明"><div><span className={s.eyebrow}>{focus?'选中元素':'正在发生什么'}</span><h4>{detail.title}</h4><code>{detail.expression}</code></div><p aria-live={playing?'off':'polite'}>{detail.explanation}</p></div>
  <details className={s.settings}><summary>调整实验参数 <span>{spec.controls.length} 项</span></summary>{parameters}</details>
  <div className={s.study}><p><strong>动手验证</strong>{spec.challenge}</p><details><summary>查看本步骤的完整数值与模型边界</summary><p>{frame.explain}</p><code>{frame.formula}</code><dl>{frame.labels.map((label,i)=><div key={label}><dt>{label}</dt><dd>{num(frame.values[i])}</dd></div>)}</dl><p>{spec.boundary}</p></details></div>
 </section>
}
