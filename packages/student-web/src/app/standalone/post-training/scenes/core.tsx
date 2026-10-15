import { ce, dot, lora, NF4, quantize, softmax } from '../algorithm-math'
import { C, Equation, Label, Matrix, mix, n, Node, Panel, Pick, smooth, Text, Wire, type SceneProps } from './primitives'

export function LoraScene(p:SceneProps){
 const {v,time:t}=p,d=lora(v.rank,v.alpha,[1,2,v.x]),phase=Math.floor(t),[kind,r,c]=p.focus.split(':'),row=Math.max(0,Number((kind==='B'?c:r)??0)||0)%v.rank
 const result=d.base.map((x,i)=>x+d.delta[i]*smooth(t-2))
 return <><Label x={35} y={35} title="两条路径，一个输出" sub="冻结分支保留知识；可训练分支只学习增量"/><Text x={1005} y={35} anchor="end" color={C.gold} size={15}>r = {v.rank} · α/r = {n(v.alpha/v.rank)}</Text>
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
 <Equation parts={[{text:'h = ',color:C.teal},{text:'W₀x',color:C.frozen},{text:' + '},{text:'(α/r) B',color:C.gold},{text:' A x',color:C.blue}]}/><Text x={1005} y={525} anchor="end" size={13} color={C.muted}>点击任意矩阵单元，追踪它的贡献</Text></>
}

export function LoraGeometry(p:SceneProps){
 const {v,time:t}=p,d=lora(v.rank,v.alpha,[1,2,v.x]),yaw=p.yaw*Math.PI/180,pitch=p.pitch*Math.PI/180
 const vectors=d.B[0].map((_,i)=>d.B.map(row=>row[i])),size=Math.max(4,...d.delta.map(Math.abs)),scale=210/size
 const project=(a:number[])=>{const xx=a[0]*Math.cos(yaw)-a[2]*Math.sin(yaw),zz=a[0]*Math.sin(yaw)+a[2]*Math.cos(yaw);return [610+xx*scale,285-(a[1]*Math.cos(pitch)-zz*Math.sin(pitch))*scale]}
 const origin=project([0,0,0]),points=(vs:number[][])=>vs.map(a=>project(a).join(',')).join(' '),arrow=(a:number[],color:string,title:string,id:string)=>{const end=project(a),dx=end[0]-origin[0],dy=end[1]-origin[1],length=Math.hypot(dx,dy),ux=dx/(length||1),uy=dy/(length||1),component=id.startsWith('component');return <Pick id={id} label={title} p={p}><path d={`M${origin} L${end}`} stroke={color} strokeWidth={component?1.5:3} strokeDasharray={component?'4 4':undefined}/>{length>8?<polygon points={`${end} ${end[0]-ux*11-uy*4},${end[1]-uy*11+ux*4} ${end[0]-ux*11+uy*4},${end[1]-uy*11-ux*4}`} fill={color}/>:<circle cx={end[0]} cy={end[1]} r="4" fill={color}/>}<Text x={end[0]+10} y={end[1]+(id==='basis:1'?19:id.startsWith('delta')?-22:-8)} color={color} size={15}>{component?'':title}</Text></Pick>}
 const extent=size*.4,b1=vectors[0],b2=vectors[1]??[0,0,0],plane=[[-extent,-extent],[extent,-extent],[extent,extent],[-extent,extent]].map(([a,b])=>b1.map((x,i)=>x*a+b2[i]*b))
 return <><Label x={35} y={35} title="低秩更新能到达哪里？" sub="真实三维投影 · 拖动画布旋转 · 轴代表输出坐标，不是语义标签"/>
 <Panel x={35} y={90} w={245} h={350} label="COORDINATES IN THE ADAPTER"><Text x={55} y={145} color={C.blue} size={19}>u = Ax</Text>{d.u.map((u,i)=><g key={i}><Text x={55} y={190+i*60} color={i?C.purple:C.blue}>u{i+1} = {n(u)}</Text><Text x={55} y={212+i*60} size={12} color={C.muted}>沿 b{i+1} 方向的系数</Text></g>)}<Text x={55} y={345} size={15} color={C.gold}>Δh = {n(v.alpha/v.rank)} × Σ uₖbₖ</Text><Text x={55} y={372} size={12} color={C.gold}>Δh = [{d.delta.map(n).join(", ")}]</Text><Text x={55} y={410} size={13} color={C.muted}>{v.rank===1?'r=1：所有增量落在一条线上':'r=2：所有增量落在一个平面内'}</Text></Panel>
 {Array.from({length:11},(_,i)=>i-5).map(i=><g key={i}><polyline points={points([[i*size/5,0,-size],[i*size/5,0,size]])} fill="none" stroke={C.grid}/><polyline points={points([[-size,0,i*size/5],[size,0,i*size/5]])} fill="none" stroke={C.grid}/></g>)}
 {v.rank===2?<polygon points={points(plane)} fill={C.purple} fillOpacity=".12" stroke={C.purple} strokeOpacity=".45"/>:<polyline points={points([b1.map(x=>-extent*x),b1.map(x=>extent*x)])} stroke={C.blue} strokeWidth="15" opacity=".13"/>}
 {[[size,0,0],[0,size,0],[0,0,size]].map((a,i)=><g key={i}><polyline points={points([[0,0,0],a])} stroke={C.frozen} strokeDasharray="4 5" fill="none"/><Text x={project(a)[0]+6} y={project(a)[1]+5} size={12} color={C.muted}>h{i+1}</Text></g>)}
 {arrow(b1,C.blue,'b₁','basis:0')}{v.rank===2&&arrow(b2,C.purple,'b₂','basis:1')}
 {t>1&&vectors.map((b,k)=>{const component=b.map(x=>x*d.u[k]*v.alpha/v.rank*smooth(t-1));return <g key={k}>{arrow(component,k?C.purple:C.blue,`${n(v.alpha/v.rank*d.u[k])} · b${k+1}`,'component:'+k)}</g>})}
 {arrow(d.delta.map(x=>x*smooth(t-1)),C.gold,'Δh','delta:0:0')}
 <Equation parts={[{text:'rank(BA) ≤ r',color:C.gold},{text:'   ·   '},{text:'W₀ 不受此约束',color:C.frozen}]}/></>
}

export function AttentionScene(p:SceneProps){
 const {v,time:t}=p,q=[1,1,2,1],k=[1,0,1,2],val=[1,2,3,4],names=['P₀','P₁','A','EOS'],weights=q.map((x,i)=>softmax(k.map((key,j)=>v.causal&&j>i?-Infinity:x*key))),r=v.query,c=Number(p.focus.split(':')[2]??0),activeCol=Math.min(3,c),probs=weights[r],phase=Math.floor(t)
 return <><Label x={35} y={35} title="让一个 query 读取它的上下文" sub="点选 token 或注意力单元 · 线宽对应实际注意力概率"/>
 <Text x={70} y={100} color={C.blue}>query 位置</Text>{names.map((name,i)=><g key={name} onClick={()=>p.setValue('query',i)}><Node x={55} y={125+i*70} w={95} h={45} title={`${i} · ${name}`} color={i===r?C.gold:C.frozen} id={`query:${i}`} p={p}/><Wire from={[150,147+i*70]} to={[365,145+i*50]} t={t} active={i===r} color={C.blue}/></g>)}
 <Matrix x={235} y={120} data={q.map(x=>[x])} title="Q" id="Q" p={p} cell={35} activeRow={r}/>
 <Matrix x={365} y={120} data={phase===0?q.map(x=>k.map(key=>x*key)):weights} title={phase===0?'QKᵀ':'softmax(QKᵀ + mask)'} sub="" id="attention" p={p} cell={50} activeRow={r} activeCol={activeCol} masked={(i,j)=>!!v.causal&&j>i&&phase>=1}/>
 {k.map((value,i)=><Text key={i} x={390+i*50} y={106} anchor="middle" size={11} color={C.muted}>K={value}</Text>)}
 {names.map((name,i)=><Text key={name} x={390+i*50} y={345} color={C.muted} size={13} anchor="middle">{name}</Text>)}
 <Matrix x={680} y={120} data={val.map(x=>[x])} title="V" sub="4×1" id="V" p={p} cell={45}/>
 {probs.map((w,j)=><Wire key={j} from={[565,145+r*50]} to={[680,142+j*45]} t={t+j/8} width={1+w*7} active={w>0&&phase>=2} color={j===activeCol?C.gold:C.teal}/>)}
 <Wire from={[725,210]} to={[880,210]} t={t} active={phase>=2} color={C.teal} label="Σ aⱼVⱼ"/>
 <Node x={880} y={178} w={100} h={64} title="h(query)" value={n(dot(probs,val))} id="attention-output" color={C.teal} p={p}/>
 <Panel x={210} y={390} w={770} h={115} label="NEXT-TOKEN SUPERVISION · 标签掩码不改变上方注意力"><Text x={230} y={448} color={C.muted} size={13}>logit位置</Text>{names.map((name,i)=><g key={name}><Text x={420+i*145} y={445} anchor="middle" size={13} color={C.blue}>{i} · {name}</Text>{i<3&&<><Wire from={[420+i*145,455]} to={[420+i*145,475]} t={t} active={phase===3&&(i>0||!!v.prompt)} color={C.gold}/><Text x={420+i*145} y={496} anchor="middle" color={i===0&&!v.prompt?C.frozen:C.gold} size={14}>{i===0&&!v.prompt?'−100':names[i+1]}</Text></>}</g>)}</Panel>
 <Equation parts={[{text:'h = ',color:C.teal},{text:'softmax(QKᵀ + M)',color:C.blue},{text:' V',color:C.gold}]}/></>
}

export function SoftmaxScene(p:SceneProps){
 const {v,time:t}=p,z=[v.z,1,0],before=softmax(z),g=before.map((x,i)=>x-Number(i===v.target)),znext=z.map((x,i)=>x-v.lr*g[i]),current=z.map((x,i)=>mix(x,znext[i],smooth(t-3))),m=Math.max(...current),e=current.map(x=>Math.exp(x-m)),den=e.reduce((a,b)=>a+b,0),prob=softmax(current),phase=Math.floor(t)
 return <><Label x={35} y={35} title="一个目标，怎样改变整个概率分布" sub="蓝色是预测；金色是目标；反向箭头给出每个 logit 的调整方向"/>
 <Label x={75} y={100} title="logits z" color={C.blue}/><Label x={310} y={100} title="exp(z − max z)" color={C.blue}/><Label x={655} y={100} title="p = e / Σe" color={C.teal}/>
 {z.map((x,i)=>{const y=135+i*94,updated=mix(x,znext[i],smooth(t-3));return <g key={i}><Node x={65} y={y} w={125} h={63} title={`类别 ${i}`} value={n(updated)} id={`logit:${i}`} p={p} color={i===v.target?C.gold:C.blue}/><Wire from={[190,y+31]} to={[320,y+31]} t={t} active={phase===0} label={`−${n(m)} → exp`}/><Node x={320} y={y} w={115} h={63} title={`e${i}`} value={n(e[i])} id={`exp:${i}`} p={p}/><Wire from={[435,y+31]} to={[525,270]} t={t+i/6} active={phase<=1}/><Wire from={[550,270]} to={[665,y+31]} t={t+i/6} active={phase===1} color={C.teal}/><Node x={665} y={y} w={125} h={63} title={`p${i}`} value={`${n(prob[i]*100)}%`} id={`prob:${i}`} color={i===v.target?C.gold:C.teal} p={p}/>{i===v.target&&<Wire from={[790,y+31]} to={[895,270]} t={t} active={phase>=2} color={C.gold} label="−log"/>}{phase>=3&&<><Wire from={[700,y+70]} to={[125,y+70]} bend={45} t={t} active color={C.pink} label={`g${i} = p${i}(更新前) − ${i===v.target?1:0} = ${n(g[i])}`}/></>}</g>})}
 <circle cx={535} cy={270} r="36" fill="#112431" stroke={C.blue}/><Text x={535} y={264} anchor="middle" color={C.blue} size={15}>Σ e</Text><Text x={535} y={287} anchor="middle" size={15}>{n(den)}</Text>
 <Node x={895} y={235} w={110} h={70} title="Loss" value={n(ce(current,v.target))} color={C.gold} id="loss" p={p}/>
 <Equation parts={[{text:phase>=3?'∂L/∂z = ':'L = ',color:C.gold},{text:phase>=3?'p − one_hot(y)':'−zᵧ + log Σ exp(z)',color:C.ink}]}/><Text x={1005} y={525} anchor="end" size={13} color={C.pink}>{phase===4?'梯度下降：z ← z − ηg':'点击目标类别，检查它与其它类别的耦合'}</Text></>
}

export function QuantizationScene(p:SceneProps){
 const {v,time:t}=p,w=[-.7,-.3,-.1,0,.2,.4,.6,v.outlier],d=quantize(w,!!v.uniform),i=v.index,book=v.uniform?Array.from({length:16},(_,j)=>-1+2*j/15):NF4,selected=d.normalized[i],quant=book[d.codes[i]],sx=(x:number)=>430+(x+1)*265,phase=Math.floor(t)
 const point=mix(selected,quant,smooth(t-1))
 return <><Label x={35} y={35} title="量化，就是让连续的权重落在有限的格点上" sub="点击一个权重，看归一化 → 最近邻编码 → 反量化的完整路径"/>
 <Label x={55} y={100} title="一块冻结权重" sub="8个值共享 absmax scale" color={C.frozen}/>
 {w.map((x,j)=><g key={j} onClick={()=>p.setValue('index',j)}><Node x={55+(j%2)*105} y={132+Math.floor(j/2)*65} w={92} h={51} title={`w${j}`} value={n(x)} color={j===i?C.gold:C.frozen} id={`weight:${j}`} p={p}/></g>)}
 <Wire from={[260,250]} to={[325,250]} t={t} active={phase===0} color={C.blue}/><Node x={300} y={220} w={85} h={60} title={`÷ ${n(d.scale)}`} value={n(selected)} color={C.blue} id="scale" p={p}/>
 <Label x={430} y={110} title={v.uniform?'均匀 16 级码本':'NF4 · 16 个非均匀格点'} sub="码字编号 0–15 · 每个权重只保存4个bit" color={C.blue}/>
 <path d="M430 245H960" stroke={C.frozen}/>{book.map((x,j)=><Pick key={j} id={`code:${j}`} label={`码字 ${j}，值 ${n(x)}`} p={p}><path d={`M${sx(x)} 225V265`} stroke={j===d.codes[i]?C.gold:C.blue} strokeWidth={j===d.codes[i]?3:1}/><circle cx={sx(x)} cy={245} r={j===d.codes[i]?7:3} fill={j===d.codes[i]?C.gold:C.blue}/><Text x={sx(x)} y={282+(j%2)*16} anchor="middle" size={10} color={C.muted}>{j}</Text></Pick>)}
 <path d={`M${sx(selected)} 170V219`} stroke={C.blue} strokeDasharray="4 5"/><Text x={sx(selected)} y={154} anchor="middle" color={C.blue} size={14}>u = {n(selected)}</Text>
 <circle cx={sx(point)} cy={211} r="8" fill={C.gold}/><path d={`M${sx(point)} 218V235`} stroke={C.gold}/>
 <Text x={430} y={328} size={13} color={C.muted}>−1</Text><Text x={960} y={328} anchor="end" size={13} color={C.muted}>+1</Text>
 <Wire from={[sx(quant),300]} to={[590,405]} t={t} active={phase>=1} color={C.gold}/><Node x={535} y={390} w={120} title="4bit code" value={d.codes[i].toString(2).padStart(4,'0')} color={C.gold} id="selected-code" p={p}/>
 <Wire from={[655,420]} to={[795,420]} t={t} active={phase>=2} color={C.teal} label={`c[q] × ${n(d.scale)}`}/><Node x={795} y={390} w={160} title="恢复的权重 ŵ" value={n(d.restored[i])} color={C.teal} id="restored" p={p}/>
 <Equation parts={[{text:`w = ${n(w[i])}`,color:C.blue},{text:'   →   '},{text:`ŵ = ${n(d.restored[i])}`,color:C.teal},{text:`   ε = ${n(d.errors[i])}`,color:C.pink}]}/></>
}
