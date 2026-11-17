'use client'
import { useState } from 'react'
import type { NativeExplorer, NativeSnapshot } from '@/lib/algorithm-viz/explorer'
import s from './native-controls.module.css'

export function NativeControls({controller,snapshot}:{controller:NativeExplorer|null;snapshot:NativeSnapshot}){
  const [node,setNode]=useState(''),[row,setRow]=useState(0),[col,setCol]=useState(0),[value,setValue]=useState(5)
  const current=snapshot.nodes.find(n=>n.id===node)??snapshot.nodes.at(-1),e=snapshot.explanation
  return <>
    <div className={s.toolbar}>
      <div className={s.signature}><i/>LOCAL ALGORITHM ENGINE <small>自主计算 · 自主场景</small></div>
      <div className={s.modes} aria-label='选择算法示例'><button disabled={!controller} aria-pressed={snapshot.mode==='transformer'} onClick={()=>controller?.mode('transformer')}>Transformer</button><button disabled={!controller} aria-pressed={snapshot.mode==='convolution'} onClick={()=>controller?.mode('convolution')}>二维卷积</button></div>
    </div>
    <div className={s.inspect}>
      {snapshot.mode==='convolution'?<label>修改输入中心值<input aria-label='卷积输入中心值' type='range' min={-9} max={9} step={1} value={value} onChange={ev=>{const v=Number(ev.target.value);setValue(v);controller?.convolution(v)}}/><b>{value}</b></label>:<span>点击 3D 格子，或精确定位一个元素</span>}
      <div><select aria-label='检查张量' value={current?.id??''} disabled={!controller} onChange={ev=>{setNode(ev.target.value);setRow(0);setCol(0)}}>{snapshot.nodes.map(n=><option key={n.id} value={n.id}>{n.label} · {n.shape.join('×')}</option>)}</select><label>行<input aria-label='张量行索引' type='number' min={0} max={(current?.shape[0]??1)-1} value={Math.min(row,(current?.shape[0]??1)-1)} onChange={ev=>setRow(Math.max(0,Math.floor(Number(ev.target.value)||0)))}/></label><label>列<input aria-label='张量列索引' type='number' min={0} max={(current?.shape[1]??1)-1} value={Math.min(col,(current?.shape[1]??1)-1)} onChange={ev=>setCol(Math.max(0,Math.floor(Number(ev.target.value)||0)))}/></label><button disabled={!controller||!current} onClick={()=>current&&controller?.select({node:current.id,row:Math.min(row,current.shape[0]-1),col:Math.min(col,current.shape[1]-1)})}>追踪此格</button></div>
    </div>
    <div className={s.trace} aria-live='polite'>
      <span>{snapshot.mode==='convolution'?'跨算法验证 / 同一渲染器':'数值驱动的计算追踪'} · {snapshot.stepTitle}</span>
      {e?<><b>{e.formula}</b><small>索引 [{e.cell.row}, {e.cell.col}] · {e.inputs.length} 个输入引用。{e.note}</small>{snapshot.sources?.length>0&&<div className={s.sources}><span>继续向上游追踪</span>{snapshot.sources.map(src=><button key={src.cell.node} onClick={()=>controller?.follow(src.cell)}>{src.label} ↗</button>)}</div>}{e.terms.length>0&&<details><summary>展开 {e.terms.length} 项乘加</summary><p>{e.terms.join(' + ')}</p></details>}</>:<><b>{snapshot.mode==='convolution'?'移动 2×2 核，逐格计算 3×3 输出':'每个色块都来自本次前向计算'}</b><small>播放会依次追踪运算输出；绿色点是可见来源，金色点是当前结果。矩阵显示最多 8×12 个元素，精确定位会移动窗口；完整形状保留。虚线跨过折叠的中间运算。</small></>}
    </div>
  </>
}
