import { bootstrap, classification } from '../algorithm-math'
import { C, coord, Label, mix, n, Pick, smooth, Text, type SceneProps } from './primitives'

export function MetricsScene(p:SceneProps){
 const {v,time}=p,truth=[0,0,1,1,2,2],pred=[0,0,1,0,2,v.prediction],d=classification(truth,pred),names=['billing','account','bug','invalid'],colors=[C.blue,C.purple,C.teal,C.pink],selected=Math.min(2,Math.max(0,Math.floor(time)-1)),m=d.perClass[selected]
 const sets=[{name:'TP',ids:truth.map((a,i)=>a===selected&&pred[i]===selected?i:-1).filter(i=>i>=0),color:C.teal},{name:'FP',ids:truth.map((a,i)=>a!==selected&&pred[i]===selected?i:-1).filter(i=>i>=0),color:C.pink},{name:'FN',ids:truth.map((a,i)=>a===selected&&pred[i]!==selected?i:-1).filter(i=>i>=0),color:C.gold}]
 return <g data-representation="prediction-sorting-and-sets"><Label x={35} y={38} title="把预测分进篮子，再按一个类别重新圈出 TP / FP / FN" sub="圆点颜色表示真值，所在篮子表示预测。点击篮子，把最后一条 bug 样例放进去；invalid 也保留。"/>
 {names.map((name,j)=><Pick key={name} id={`prediction:${j===3?-1:j}`} label={`把样例5预测为 ${name}`} p={p}><path d={`M${80+j*240} 115v150q0 20 20 20h135q20 0 20-20V115`} stroke={colors[j]} fill={colors[j]} fillOpacity=".04" strokeWidth="2"/><Text x={167+j*240} y={108} anchor="middle" color={colors[j]} size={18}>{name}</Text><Text x={167+j*240} y={310} anchor="middle" color={C.muted} size={12}>{j===3?'无效输出也占一个位置':'点击改变 #5 的预测'}</Text></Pick>)}
 {truth.map((a,i)=>{const col=pred[i]<0?3:pred[i],slot=pred.slice(0,i).filter(x=>x===pred[i]).length,move=smooth(time-i*.045),x=mix(65+i*170,128+col*240+(slot%2)*60,move),y=mix(345,173+Math.floor(slot/2)*65,move),category=a===selected&&pred[i]===selected?'TP':a!==selected&&pred[i]===selected?'FP':a===selected?'FN':'';return <Pick key={i} id={`example:${i}`} label={`样例 ${i}，真值 ${names[a]}，预测 ${names[col]}${category?'，'+category:''}`} p={p}><circle cx={coord(x)} cy={coord(y)} r={i===5?23:19} fill={colors[a]} fillOpacity=".18" stroke={colors[a]} strokeWidth={i===5?3:1.5}/><Text x={x} y={y+5} anchor="middle" color={colors[a]} size={15}>#{i}</Text>{category&&time>=1&&<Text x={x} y={y+37} anchor="middle" size={11} color={category==='TP'?C.teal:category==='FP'?C.pink:C.gold}>{category}</Text>}</Pick>})}
 <Text x={40} y={382} size={13} color={C.muted}>切换观察的正类</Text>{names.slice(0,3).map((name,i)=><Pick key={name} id={`metric-class:${i}`} label={`观察 ${name} 的 TP FP FN`} p={p}><Text x={210+i*135} y={382} size={17} color={i===selected?colors[i]:C.frozen}>{i===selected?'● ':''}{name}</Text></Pick>)}
 {sets.map((set,i)=><g key={set.name}><ellipse cx={135+i*235} cy="460" rx="90" ry="46" fill={set.color} fillOpacity=".06" stroke={set.color}/><Text x={135+i*235} y={443} anchor="middle" color={set.color} size={17}>{set.name} = {set.ids.length}</Text><Text x={135+i*235} y={478} anchor="middle" size={15}>{set.ids.length?set.ids.map(j=>'#'+j).join('  '):'∅'}</Text></g>)}
 <Text x={800} y={440} size={14} color={C.muted}>F1 = 2TP / (2TP + FP + FN)</Text><Text x={800} y={480} size={30} color={C.gold}>{n(m.f1)}</Text><Text x={800} y={515} size={16} color={C.muted}>macro F1 = {n(d.macro)}</Text>
 </g>
}

export function BootstrapScene(p:SceneProps){
 const {v,time}=p,a=[1,1,0,1,0,1,0,0],b=[1,1,1,0,1,1,0,1],d=bootstrap(a,b,v.seed),sample=d.samples[Math.min(2,Math.max(0,Math.floor(time)-1))],count=time>=4?200:Math.max(0,Math.floor(Math.max(0,time-3)*200)),hist=Array.from({length:17},(_,i)=>d.samples.slice(0,count).filter(s=>s.delta===-1+i/8).length),max=Math.max(...hist,1),positions=a.map((_,i)=>[200+100*Math.cos(i*Math.PI/4),222+85*Math.sin(i*Math.PI/4)])
 const bead=(x:number,y:number,id:number,r=23)=><g><path d={`M${coord(x)} ${coord(y-r)}a${r} ${r} 0 0 0 0 ${r*2}Z`} fill={C.blue} fillOpacity={a[id]?.8:.12}/><path d={`M${coord(x)} ${coord(y-r)}a${r} ${r} 0 0 1 0 ${r*2}Z`} fill={C.teal} fillOpacity={b[id]?.8:.12}/><circle cx={coord(x)} cy={coord(y)} r={r} fill="none" stroke={C.frozen}/><Text x={x} y={y+5} anchor="middle" size={13}>#{id}</Text></g>
 return <g data-representation="paired-resampling-urn"><Label x={35} y={38} title="每次抽走一对结果，而不是给两个模型各抽一次" sub="左半蓝色=base，右半绿色=new；填满表示正确。带着同一个样例编号，有放回地抽8次。"/>
 <path d="M65 100Q30 350 200 360Q370 350 335 100" fill={C.blue} fillOpacity=".025" stroke={C.frozen} strokeWidth="2"/>
 {positions.map(([x,y],i)=><Pick key={i} id={`pair:${i}`} label={`原始配对 ${i}，base ${a[i]}，new ${b[i]}`} p={p}>{bead(x,y,i)}</Pick>)}
 <Text x={200} y={395} anchor="middle" color={C.muted} size={14}>8 个配对样例 · 抽完放回</Text>
 {sample.indices.map((source,i)=>{const dest=[435+(i%4)*153,150+Math.floor(i/4)*95],phase=smooth((time-Math.floor(time))*2.2-i*.16),draw=time>=1&&time<4?phase:time>=4?1:0,x=mix(positions[source][0],dest[0],draw),y=mix(positions[source][1],dest[1],draw);return <g key={i}><circle cx={dest[0]} cy={dest[1]} r="28" fill="none" stroke={C.grid} strokeDasharray="4 5"/><Text x={dest[0]} y={dest[1]+52} anchor="middle" color={C.muted} size={12}>抽取位置 {i+1}</Text>{time>=1&&<Pick id={`resample:${i}`} label={`抽样位置 ${i+1} 来自 ${source}`} p={p}>{bead(x,y,source,24)}</Pick>}</g>})}
 <Text x={435} y={342} color={C.purple} size={20}>本组均值 Δ* = {n(sample.delta)}</Text>
 <Text x={435} y={380} color={C.muted} size={13}>重采样分布 · {count}/200 次（每组有8个配对）</Text>
 <path d="M435 480H980" stroke={C.frozen}/>{hist.map((h,i)=><Pick key={i} id={`histogram:${i}`} label={`分差 ${n(-1+i/8)}，${h} 次`} p={p}><rect x={435+i*31} y={coord(480-h/max*80)} width="25" height={coord(Math.max(2,h/max*80))} fill={C.purple} fillOpacity={(-1+i/8)>=d.low&&(-1+i/8)<=d.high?.75:.25}/></Pick>)}
 <path d={`M${447.5+(d.observed+1)*8*31} 390V486`} stroke={C.gold} strokeWidth="2"/>
 <Text x={435} y={503} color={C.muted} size={12}>−1</Text><Text x={968} y={503} anchor="end" color={C.muted} size={12}>+1</Text><Text x={435} y={536} color={C.purple} size={16}>95% percentile 区间 [{n(d.low)}, {n(d.high)}]</Text>
 <Text x={200} y={465} anchor="middle" size={16} color={C.gold}>原始观测 Δ = {n(d.observed)}</Text><Text x={200} y={497} anchor="middle" size={13} color={C.muted}>重抽索引可以重复，配对不能拆开</Text>
 </g>
}
