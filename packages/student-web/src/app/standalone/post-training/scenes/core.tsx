import { lora } from '../algorithm-math'
import { C, Equation, Label, Matrix, mix, n, Panel, Pick, smooth, Text, Wire, type SceneProps } from './primitives'

export function LoraScene(p:SceneProps){
 const {v,time:t}=p,d=lora(v.rank,v.alpha,[1,2,v.x]),phase=Math.floor(t),[kind,r,c]=p.focus.split(':'),row=Math.max(0,Number((kind==='B'?c:r)??0)||0)%v.rank
 const result=d.base.map((x,i)=>x+d.delta[i]*smooth(t-2))
 return <g data-representation="low-rank-matrix-factorization"><Label x={35} y={35} title="两条路径，一个输出" sub="冻结分支保留知识；可训练分支只学习增量"/><Text x={1005} y={35} anchor="end" color={C.gold} size={15}>r = {v.rank} · α/r = {n(v.alpha/v.rank)}</Text>
 <Wire from={[104,250]} to={[245,145]} t={t} active={phase===0} color={C.frozen} label="冻结分支"/>
 <Wire from={[104,250]} to={[245,350]} t={t} active={phase<=1} label="同一个 x"/>
 <Wire from={[359,145]} to={[590,145]} t={t} active={phase===0||phase===3} color={C.frozen} label="W₀x"/>
 <Wire from={[359,350]} to={[445,350]} t={t} active={phase===1} label="点积"/>
 <Wire from={[485,350]} to={[570,350]} t={t} active={phase===2} color={C.gold}/>
 <Wire from={[570+38*v.rank,350]} to={[770,350]} t={t} active={phase===2} color={C.gold} label="× α/r"/>
 <Wire from={[630,145]} to={[875,250]} t={t} active={phase===3} color={C.frozen}/>
 <Wire from={[808,350]} to={[875,250]} t={t} active={phase===3} color={C.gold}/>
 <Wire from={[896,250]} to={[945,250]} t={t} active={phase===3} color={C.teal}/>
 <Matrix x={65} y={195} data={[[1],[2],[v.x]]} title="x" sub="输入 · 3×1" id="x" p={p} cell={38}/>
 <Matrix x={245} y={108} data={d.W} title="W₀  ⛓" sub="3×3 · FROZEN" id="W" p={p} color={C.frozen}/>
 <Matrix x={590} y={108} data={d.base.map(x=>[x])} title="W₀x" sub="原输出" id="base" p={p} color={C.frozen}/>
 <Matrix x={245} y={320} data={d.A} title="A" id="A" p={p} activeRow={phase===1?row:-1}/>
 <Matrix x={445} y={320} data={d.u.map(x=>[x])} title="u = Ax" id="u" p={p} color={C.blue} activeRow={row}/>
 <Matrix x={570} y={320} data={d.B} title="B" id="B" p={p} color={C.gold} activeCol={phase===2?row:-1}/>
 <Matrix x={770} y={320} data={d.delta.map(x=>[x])} title="Δh" sub="缩放后的增量" id="delta" p={p} color={C.gold}/>
 <circle cx={875} cy={250} r="21" fill="#12202e" stroke={C.teal}/><Text x={875} y={257} anchor="middle" size={25} color={C.teal}>+</Text>
 <Matrix x={945} y={195} data={result.map(x=>[x])} title="h" sub="最终输出" id="output" p={p} color={C.teal}/>
 {phase===1&&d.A[row].map((a,i)=><g key={i} transform={`translate(${mix(260+i*38,460,smooth(t-1))} ${mix(335+row*38,470,smooth(t-1))})`}><rect x="-30" y="-14" width="60" height="28" rx="4" fill="#15283d" stroke={C.blue}/><Text x={0} y={5} size={12} anchor="middle" color={C.blue}>{n(a)}×{n([1,2,v.x][i])}</Text></g>)}
 <Equation parts={[{text:'h = ',color:C.teal},{text:'W₀x',color:C.frozen},{text:' + '},{text:'(α/r) B',color:C.gold},{text:' A x',color:C.blue}]}/><Text x={1005} y={525} anchor="end" size={13} color={C.muted}>点击任意矩阵单元，追踪它的贡献</Text></g>
}

export function LoraGeometry(p:SceneProps){
 const {v,time:t}=p,d=lora(v.rank,v.alpha,[1,2,v.x]),yaw=p.yaw*Math.PI/180,pitch=p.pitch*Math.PI/180
 const vectors=d.B[0].map((_,i)=>d.B.map(row=>row[i])),size=Math.max(4,...d.delta.map(Math.abs)),scale=210/size
 const project=(a:number[])=>{const xx=a[0]*Math.cos(yaw)-a[2]*Math.sin(yaw),zz=a[0]*Math.sin(yaw)+a[2]*Math.cos(yaw);return [610+xx*scale,285-(a[1]*Math.cos(pitch)-zz*Math.sin(pitch))*scale]}
 const origin=project([0,0,0]),points=(vs:number[][])=>vs.map(a=>project(a).join(',')).join(' '),arrow=(a:number[],color:string,title:string,id:string)=>{const end=project(a),dx=end[0]-origin[0],dy=end[1]-origin[1],length=Math.hypot(dx,dy),ux=dx/(length||1),uy=dy/(length||1),component=id.startsWith('component');return <Pick id={id} label={title} p={p}><path d={`M${origin} L${end}`} stroke={color} strokeWidth={component?1.5:3} strokeDasharray={component?'4 4':undefined}/>{length>8?<polygon points={`${end} ${end[0]-ux*11-uy*4},${end[1]-uy*11+ux*4} ${end[0]-ux*11+uy*4},${end[1]-uy*11-ux*4}`} fill={color}/>:<circle cx={end[0]} cy={end[1]} r="4" fill={color}/>}<Text x={end[0]+10} y={end[1]+(id==='basis:1'?19:id.startsWith('delta')?-22:-8)} color={color} size={15}>{component?'':title}</Text></Pick>}
 const extent=size*.4,b1=vectors[0],b2=vectors[1]??[0,0,0],plane=[[-extent,-extent],[extent,-extent],[extent,extent],[-extent,extent]].map(([a,b])=>b1.map((x,i)=>x*a+b2[i]*b))
 return <g data-representation="low-rank-output-subspace"><Label x={35} y={35} title="低秩更新能到达哪里？" sub="真实三维投影 · 拖动画布旋转 · 轴代表输出坐标，不是语义标签"/>
 <Panel x={35} y={90} w={245} h={350} label="COORDINATES IN THE ADAPTER"><Text x={55} y={145} color={C.blue} size={19}>u = Ax</Text>{d.u.map((u,i)=><g key={i}><Text x={55} y={190+i*60} color={i?C.purple:C.blue}>u{i+1} = {n(u)}</Text><Text x={55} y={212+i*60} size={12} color={C.muted}>沿 b{i+1} 方向的系数</Text></g>)}<Text x={55} y={345} size={15} color={C.gold}>Δh = {n(v.alpha/v.rank)} × Σ uₖbₖ</Text><Text x={55} y={372} size={12} color={C.gold}>Δh = [{d.delta.map(n).join(", ")}]</Text><Text x={55} y={410} size={13} color={C.muted}>{v.rank===1?'r=1：所有增量落在一条线上':'r=2：所有增量落在一个平面内'}</Text></Panel>
 {Array.from({length:11},(_,i)=>i-5).map(i=><g key={i}><polyline points={points([[i*size/5,0,-size],[i*size/5,0,size]])} fill="none" stroke={C.grid}/><polyline points={points([[-size,0,i*size/5],[size,0,i*size/5]])} fill="none" stroke={C.grid}/></g>)}
 {v.rank===2?<polygon points={points(plane)} fill={C.purple} fillOpacity=".12" stroke={C.purple} strokeOpacity=".45"/>:<polyline points={points([b1.map(x=>-extent*x),b1.map(x=>extent*x)])} stroke={C.blue} strokeWidth="15" opacity=".13"/>}
 {[[size,0,0],[0,size,0],[0,0,size]].map((a,i)=><g key={i}><polyline points={points([[0,0,0],a])} stroke={C.frozen} strokeDasharray="4 5" fill="none"/><Text x={project(a)[0]+6} y={project(a)[1]+5} size={12} color={C.muted}>h{i+1}</Text></g>)}
 {arrow(b1,C.blue,'b₁','basis:0')}{v.rank===2&&arrow(b2,C.purple,'b₂','basis:1')}
 {t>1&&vectors.map((b,k)=>{const component=b.map(x=>x*d.u[k]*v.alpha/v.rank*smooth(t-1));return <g key={k}>{arrow(component,k?C.purple:C.blue,`${n(v.alpha/v.rank*d.u[k])} · b${k+1}`,'component:'+k)}</g>})}
 {arrow(d.delta.map(x=>x*smooth(t-1)),C.gold,'Δh','delta:0:0')}
 <Equation parts={[{text:'rank(BA) ≤ r',color:C.gold},{text:'   ·   '},{text:'W₀ 不受此约束',color:C.frozen}]}/></g>
}
