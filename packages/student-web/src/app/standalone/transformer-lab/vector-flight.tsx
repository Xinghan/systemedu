'use client'
import { useEffect, useRef, useState } from 'react'
import { pocketForward, words, type Settings } from './pocket-model'
import c from './reader.module.css'

const stops = [['x','词元与位置'],['u','加回注意力更新'],['y','加回前馈更新'],['final','最终归一化']] as const
const colors = ['#71819a','#4767b2','#c77449','#688a66']
type Point = [number,number]

export function VectorFlight({settings}:{settings:Settings}) {
  const [row,setRow] = useState(1), [phase,setPhase] = useState(0), [playing,setPlaying] = useState(false)
  const [camera,setCamera] = useState({ yaw:-0.52, pitch:0.35 })
  const drag = useRef<Point|null>(null)
  const trace = pocketForward(settings)
  const values = stops.map(([key])=>trace[key][row])
  const step = Math.min(2,Math.floor(phase))
  const v = values[step].map((x,j)=>x+(values[step+1][j]-x)*(phase-step))
  const extent = Math.max(2,...values.flat().map(Math.abs)) + 0.25
  const project = ([x,y,z]:number[]):Point => {
    const { yaw,pitch } = camera
    const horizontal = x*Math.cos(yaw)+z*Math.sin(yaw)
    const depth = -x*Math.sin(yaw)+z*Math.cos(yaw)
    return [210+horizontal*72/extent,104-(y*Math.cos(pitch)-depth*Math.sin(pitch))*72/extent]
  }
  const projected = (v:number[])=>project(v).join(',')
  useEffect(()=>{
    if (!playing) return
    let frame:number, start:number|undefined
    const tick = (now:number)=>{
      if (start===undefined) start=now
      const next=Math.min(3,(now-start)/1250)
      setPhase(next)
      if (next===3) setPlaying(false)
      else frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(frame)
  },[playing])
  const active=Math.min(3,Math.round(phase))
  return <section className={c.experiment}><h3>把一行向量放进三维空间</h3><p>沿三根轴分别量出三个坐标，就能找到代表这个词的点。点「播放向量轨迹」，看同一个词怎样随计算移动。每个停靠点都取自本节计算台。</p>
    <div className={c.vectorPlane}><svg viewBox="0 0 420 208" role="img" aria-label={`三维向量，位置 ${row}，当前坐标 ${v.map(n=>n.toFixed(3)).join('，')}`}
      onPointerDown={e=>{drag.current=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerMove={e=>{const p=drag.current;if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];drag.current=[e.clientX,e.clientY];setCamera(a=>({yaw:a.yaw+dx*.012,pitch:Math.max(-1.45,Math.min(1.45,a.pitch-dy*.012))}))}}
      onPointerUp={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}>
      {Array.from({length:5},(_,i)=>(i-2)*extent/2).map(n=><g key={n} stroke="#d7dee7" strokeWidth=".7"><polyline points={[[-extent,0,n],[extent,0,n]].map(projected).join(' ')}/><polyline points={[[n,0,-extent],[n,0,extent]].map(projected).join(' ')}/></g>)}
      {[0,1,2].map((dim)=>{const axis=[0,0,0];axis[dim]=extent*1.18;const [x,y]=project(axis);return <g key={dim}><polyline points={'210,104 '+x+','+y} stroke="#8795a7"/><text x={x+2} y={y-2}>{['x','y','z'][dim]}</text></g>})}
      <polyline points={values.map(projected).join(' ')} fill="none" stroke="#a3afbe" strokeWidth="1.5" strokeDasharray="4 3"/>
      {values.map((val,i)=><circle key={i} cx={project(val)[0]} cy={project(val)[1]} r="4" fill={colors[i]}/>)}
      <polyline points={'210,104 '+projected(v)} stroke="#243a66" strokeWidth="2.4"/><circle cx={project(v)[0]} cy={project(v)[1]} r="6" fill="#243a66" stroke="white" strokeWidth="1.5"/>
    </svg></div>
    <div className={c.choices}>{settings.tokens.map((t,i)=><button key={i} aria-pressed={row===i} onClick={()=>setRow(i)}>位置 {i} · {words[t]}</button>)}</div>
    <div className={c.choices}><button aria-pressed={playing} onClick={()=>{if(!playing)setPhase(0);setPlaying(!playing)}}>{playing?'暂停轨迹':'播放向量轨迹'}</button><button onClick={()=>setCamera(a=>({...a,yaw:a.yaw+Math.PI/6}))}>转动视角</button></div>
    <div className={c.choices}>{stops.map(([,label],i)=><button key={label} aria-pressed={!playing&&phase===i} onClick={()=>{setPlaying(false);setPhase(i)}}>{label}</button>)}</div>
    <p aria-live={playing?'off':'polite'}>{playing?'演示中':stops[active][1]} · ({v.map(n=>n.toFixed(3)).join(', ')})。拖动画面可从另一侧观察。</p>
  </section>
}
