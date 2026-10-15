import { useRef, type PointerEvent } from 'react'
import { C, coord, Text, type SceneProps } from './primitives'

export function DragHandle({x,y,value,min,max,step,label,param,p,toValue,color=C.gold}:{x:number;y:number;value:number;min:number;max:number;step:number;label:string;param:string;p:SceneProps;toValue:(point:[number,number])=>number;color?:string}) {
  const held=useRef(false)
  const change=(value:number)=>p.setValue(param,coord(Math.max(min,Math.min(max,min+Math.round((value-min)/step)*step))))
  const move=(e:PointerEvent<SVGGElement>)=>{
    if(!held.current)return
    const svg=e.currentTarget.ownerSVGElement,matrix=svg?.getScreenCTM()
    if(!matrix)return
    const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse())
    change(toValue([point.x,point.y]))
  }
  return <g role="slider" tabIndex={0} data-direct-drag={param} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
    onPointerDown={e=>{e.stopPropagation();held.current=true;e.currentTarget.setPointerCapture(e.pointerId)}}
    onPointerMove={move} onPointerUp={()=>{held.current=false}} onPointerCancel={()=>{held.current=false}}
    onKeyDown={e=>{if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();change(e.key==='Home'?min:e.key==='End'?max:value+(['ArrowRight','ArrowUp'].includes(e.key)?step:-step))}}}
    style={{cursor:'grab',touchAction:'none'}}>
    <circle cx={coord(x)} cy={coord(y)} r="19" fill={color} fillOpacity=".09"/>
    <circle cx={coord(x)} cy={coord(y)} r="9" fill={color} stroke={C.ink} strokeWidth="1.5"/>
    <path d={`M${coord(x-4)} ${coord(y)}h8m-4 -4v8`} stroke="var(--scene-bg,#0b1320)" strokeWidth="1.5"/>
  </g>
}

export function Arrow({from,to,color=C.blue,width=2,dashed=false}:{from:number[];to:number[];color?:string;width?:number;dashed?:boolean}){
  const [x,y]=from,[a,b]=to,dx=a-x,dy=b-y,d=Math.hypot(dx,dy),ux=dx/(d||1),uy=dy/(d||1)
  return <g><path d={`M${coord(x)} ${coord(y)}L${coord(a)} ${coord(b)}`} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dashed?'5 5':undefined}/>{d>9&&<polygon points={`${coord(a)},${coord(b)} ${coord(a-ux*10-uy*4)},${coord(b-uy*10+ux*4)} ${coord(a-ux*10+uy*4)},${coord(b-uy*10-ux*4)}`} fill={color}/>}</g>
}

export function Axis({x,y,w,min,max,label}:{x:number;y:number;w:number;min:number;max:number;label?:string}){
  return <g><path d={`M${x} ${y}h${w}`} stroke={C.frozen}/>{Array.from({length:5},(_,i)=>{const px=x+i*w/4;return <g key={i}><path d={`M${px} ${y-4}v8`} stroke={C.frozen}/><Text x={px} y={y+23} size={12} anchor="middle" color={C.muted}>{coord(min+(max-min)*i/4)}</Text></g>})}{label&&<Text x={x+w/2} y={y+48} size={13} anchor="middle" color={C.muted}>{label}</Text>}</g>
}

export function Sector({cx,cy,r,start,end,color,opacity=1}:{cx:number;cy:number;r:number;start:number;end:number;color:string;opacity?:number}){
  const point=(a:number)=>[coord(cx+r*Math.cos(a)),coord(cy+r*Math.sin(a))]
  const sweep=Math.max(.00001,Math.min(Math.PI*2-.00001,end-start))
  return <path d={`M${cx},${cy}L${point(start)}A${r},${r} 0 ${sweep>Math.PI?1:0} 1 ${point(start+sweep)}Z`} fill={color} fillOpacity={opacity}/>
}
