import { ce, dot, preference, softmax, sum } from '../algorithm-math'
import { C, coord, Equation, Label, mix, n, Pick, smooth, Text, type SceneProps } from './primitives'
import { Arrow, Axis, DragHandle, Sector } from './direct-manipulation'
const points=(values:number[][])=>values.map(p=>p.map(coord).join(',')).join(' ')

export function ChainScene(p:SceneProps){
  const {v,time}=p,prob=[.6,v.p,.9],mass=[1,.6,.6*v.p,.6*v.p*.9],nodes=[[70,280],[280,195],[490,145],[640,125]],fraction=smooth(time-Math.floor(time)),stage=Math.min(2,Math.floor(time))
  const selectedWidth=250*.6*.9,selectedHeight=280*v.p
  return <g data-representation="conditional-probability-tree">
    <Label x={35} y={38} title="一条回答，只占概率树中的一条路径" sub="边的粗细是前缀概率；右侧面积连续切分，保留同一个目标事件"/>
    {nodes.map(([x,y],i)=><g key={i}>
      {i<3&&<><path d={`M${x} ${y}Q${x+80} ${y} ${nodes[i+1][0]} ${nodes[i+1][1]}`} fill="none" stroke={C.gold} strokeWidth={3+mass[i+1]*20} strokeOpacity={time>=i?.8:.25}/><path d={`M${x} ${y}Q${x+50} ${y+80} ${x+125} ${y+125}`} fill="none" stroke={C.frozen} strokeWidth={3+(mass[i]-mass[i+1])*20} strokeOpacity=".28"/><Text x={x+120} y={y+153} size={12} anchor="middle" color={C.muted}>其它 {n(mass[i]-mass[i+1])}</Text><Text x={x+70} y={y-38} color={C.gold} size={17}>×{n(prob[i])}</Text></>}
      <Pick id={`token:${i}`} label={`路径位置 ${i}，前缀概率 ${n(mass[i])}`} p={p}><circle cx={x} cy={y} r={i?15:23} fill={i?C.gold:C.blue}/><Text x={x} y={y-28} anchor="middle" size={17}>{['输入','y₁','y₂','EOS'][i]}</Text></Pick>
    </g>)}
    {time<3&&<circle cx={coord((1-fraction)**2*nodes[stage][0]+2*(1-fraction)*fraction*(nodes[stage][0]+80)+fraction**2*nodes[stage+1][0])} cy={coord((1-fraction*fraction)*nodes[stage][1]+fraction*fraction*nodes[stage+1][1])} r="6" fill={C.ink}/>}
    <rect x="720" y="120" width="250" height="280" fill={C.frozen} fillOpacity=".1" stroke={C.frozen}/>
    <rect x="720" y="120" width="150" height="280" fill={C.blue} fillOpacity=".15" stroke={C.blue}/>
    <rect x="720" y="120" width="150" height={coord(selectedHeight)} fill={C.purple} fillOpacity=".18" stroke={C.purple}/>
    <Pick id="nll:1" label="目标路径的概率面积" p={p}><rect x="720" y="120" width={selectedWidth} height={coord(selectedHeight)} fill={C.gold} fillOpacity=".65"/><Text x={845} y={440} anchor="middle" color={C.gold} size={23}>{n(mass[3]*100)}% 的总面积</Text></Pick>
    <Text x={720} y={100} size={13} color={C.muted}>Ω：全部可能回答，面积=1</Text>
    <Axis x={70} y={455} w={510} min={0} max={1} label="直接拖动第二个分岔的条件概率 p₂"/>
    <DragHandle x={70+v.p*510} y={455} value={v.p} min={.05} max={.95} step={.05} label="拖动第二个条件概率" param="p" p={p} toValue={([x])=>(x-70)/510}/>
    <Equation parts={[{text:`p(path)=0.6 × ${n(v.p)} × 0.9 = ${n(mass[3])}`,color:C.gold},{text:`    NLL=${n(-Math.log(mass[3]))}`,color:C.ink}]}/>
  </g>
}

export function PreferenceScene(p:SceneProps){
  const {v,time}=p,ref=v.mode?v.reference:0,beta=v.mode?v.beta:1,d=preference(v.margin,ref,beta),sx=(x:number)=>80+(x+4)*55,shown=d.p,angle=-Math.PI/2+shown*Math.PI*2
  return <g data-representation="relative-preference-dial">
    <Label x={35} y={38} title="先移动参照系，再判断哪条回答更被偏好" sub={v.mode?'DPO 比较相对于 reference 的改变；相同差值会在相减时抵消':'BT 奖励模型直接比较两条回答的标量奖励差'}/>
    <Text x={80} y={118} color={C.blue} size={18}>当前：chosen − rejected</Text>
    <Axis x={80} y={160} w={440} min={-4} max={4}/>
    <DragHandle x={sx(v.margin)} y={160} value={v.margin} min={-4} max={4} step={.25} label="拖动当前偏好差" param="margin" p={p} toValue={([x])=>(x-80)/55-4} color={C.blue}/>
    <Text x={550} y={166} color={C.blue} size={23}>{n(v.margin)}</Text>
    <Text x={80} y={239} color={C.frozen} size={18}>{v.mode?'参考：chosen − rejected':'BT 不减参考差值'}</Text>
    <Axis x={80} y={280} w={440} min={-4} max={4}/>
    {v.mode?<DragHandle x={sx(ref)} y={280} value={ref} min={-4} max={4} step={.25} label="拖动参考偏好差" param="reference" p={p} toValue={([x])=>(x-80)/55-4} color={C.frozen}/>:<circle cx={sx(0)} cy="280" r="5" fill={C.frozen}/>}
    <path d={`M${coord(sx(v.margin))} 185V355H${coord(sx(ref))}V305`} fill="none" stroke={C.gold} strokeDasharray="5 5"/>
    <Text x={80} y={400} color={C.gold} size={27}>z = {n(beta)} × ({n(v.margin)} − {n(ref)})</Text>
    <Text x={80} y={442} size={16} color={C.muted}>负差值支持 rejected；正差值支持 chosen</Text>
    <Sector cx={805} cy={255} r={130} start={-Math.PI/2} end={angle} color={C.teal} opacity={.75}/>
    <Sector cx={805} cy={255} r={130} start={angle} end={Math.PI*1.5} color={C.pink} opacity={.35}/>
    <circle cx={coord(805+130*Math.cos(-Math.PI/2+shown*Math.PI*2*smooth(time)))} cy={coord(255+130*Math.sin(-Math.PI/2+shown*Math.PI*2*smooth(time)))} r="5" fill={C.ink}/><circle cx="805" cy="255" r="91" fill="var(--scene-bg,#0b1320)"/>
    <Pick id="preference-loss" label={`偏好 chosen 的概率 ${n(shown)}`} p={p}><circle cx="805" cy="255" r="90" fill="transparent"/><Text x={805} y={248} anchor="middle" size={43} color={C.teal}>{n(shown*100)}%</Text><Text x={805} y={279} anchor="middle" size={15}>σ(z) · chosen</Text></Pick>
    <Text x={805} y={435} anchor="middle" color={C.pink} size={17}>L = −log σ(z) = {n(d.loss)}</Text>
    <Equation parts={[{text:`dL/dmargin = ${n(d.gradient)}`,color:C.pink},{text:'    梯度下降 → 增大 chosen 的相对优势'}]}/>
  </g>
}

export function PolicyScene(p:SceneProps){
  const {v,time}=p,rewards=v.group===0?[0,0,1,1]:Array(4).fill(v.group===1?1:0),mean=sum(rewards)/4,sd=Math.sqrt(sum(rewards.map(r=>(r-mean)**2))/4),adv=rewards.map(r=>(r-mean)/(sd+1e-8)),a=adv[v.sample]
  const sx=(r:number)=>300+(r-.4)/1.2*650,sy=(j:number)=>300-j*90,clipped=(r:number)=>Math.max(1-v.epsilon,Math.min(1+v.epsilon,r)),objective=(r:number,sign:number)=>Math.min(r*sign,clipped(r)*sign)
  return <g data-representation="clipped-policy-terrain">
    <Label x={35} y={38} title={time<3?'奖励给出方向，裁剪决定哪里停止获益':'参考约束检查完整分布的偏移'} sub="点选一个回答，再沿概率比的横轴移动探针"/>
    {rewards.map((reward,i)=><Pick key={i} id={`sample:${i}`} label={`回答 ${i}，奖励 ${reward}，优势 ${n(adv[i])}`} p={p}><circle cx="105" cy={140+i*85} r={i===v.sample?29:23} fill={adv[i]<0?C.pink:C.teal} fillOpacity={i===v.sample?.8:.2} stroke={i===v.sample?C.gold:C.frozen}/><Text x={105} y={146+i*85} anchor="middle" size={20}>{reward}</Text><Text x={148} y={144+i*85} size={16} color={adv[i]<0?C.pink:C.teal}>A{i}={n(adv[i])}</Text></Pick>)}
    {time<3?<>
      <rect x={coord(sx(1-v.epsilon))} y="110" width={coord(sx(1+v.epsilon)-sx(1-v.epsilon))} height="325" fill={C.gold} fillOpacity=".1"/>
      <path d={`M${sx(1-v.epsilon)} 110V435M${sx(1+v.epsilon)} 110V435`} stroke={C.gold} strokeDasharray="6 5"/>
      {[1,-1].map(sign=><g key={sign}><polyline points={points(Array.from({length:61},(_,i)=>{const r=.4+i*.02;return[sx(r),sy(objective(r,sign))]}))} stroke={sign>0?C.teal:C.pink} strokeWidth={a*sign>0?5:2} opacity={a*sign>0?1:.3} fill="none"/><Text x={950} y={sy(objective(1.6,sign))-12} color={sign>0?C.teal:C.pink} anchor="end">A={sign}: {sign>0?'右侧停止增益':'左侧停止增益'}</Text></g>)}
      <path d={`M300 ${sy(0)}H950`} stroke={C.frozen}/><path d={`M${sx(v.ratio)} 110V435`} stroke={C.gold}/><circle cx={coord(sx(v.ratio))} cy={coord(sy(objective(v.ratio,a)))} r="8" fill={C.gold}/>
      <Axis x={300} y={455} w={650} min={.4} max={1.6} label="ρ = πθ / πold · 拖动探针比较两个符号的裁剪方向"/>
      <DragHandle x={sx(v.ratio)} y={455} value={v.ratio} min={.4} max={1.6} step={.05} label="拖动策略概率比" param="ratio" p={p} toValue={([x])=>.4+(x-300)/650*1.2}/>
    </>:<>
      <Text x={330} y={120} color={C.muted}>完整二行动概率分布 · 面积总和始终为 1</Text>
      {[.5,.5*v.ratio].map((prob,i)=><g key={i}><Sector cx={440+i*350} cy={265} r={110} start={-Math.PI/2} end={-Math.PI/2+prob*Math.PI*2} color={C.blue} opacity={.7}/><Sector cx={440+i*350} cy={265} r={110} start={-Math.PI/2+prob*Math.PI*2} end={Math.PI*1.5} color={C.purple} opacity={.5}/><Text x={440+i*350} y={415} anchor="middle" size={20}>{i?'current':'reference'}: [{n(prob)}, {n(1-prob)}]</Text></g>)}
      <Text x={620} y={470} anchor="middle" color={C.gold} size={25}>KL = {n(.5*v.ratio*Math.log(v.ratio)+(1-.5*v.ratio)*Math.log(2-v.ratio))}</Text>
    </>}
    <Equation parts={[{text:time<3?`Jclip = min(ρA, clip(ρ)A) = ${n(objective(v.ratio,a))}`:'KL = Σ pθ log(pθ / pref)',color:C.gold}]}/>
  </g>
}

export function AttentionScene(p:SceneProps){
  const {v,time}=p,q=[1,1,2,1],k=[1,0,1,2],val=[1,2,3,4],names=['P₀','P₁','A','EOS'],r=v.query,prob=softmax(k.map((key,j)=>v.causal&&j>r?-Infinity:q[r]*key)),x=(i:number)=>170+i*225
  const focus=p.focus.split(':'),selected=focus[0]==='attention'?Number(focus[2]):-1
  return <g data-representation="token-context-ribbons">
    <Label x={35} y={38} title="把阅读位置放回句子，看它真正读取了谁" sub="点击 token 移动 query；弧线 ∝ p，色带 ∝ p×V（满刻度4）。P 是 prompt，A 是回答。"/>
    {!!v.causal&&r<3&&<g><rect x={x(r)+82} y="80" width={Math.max(1,1000-x(r)-82)} height="330" fill={C.frozen} fillOpacity=".08"/><Text x={x(r)+95} y={105} color={C.frozen} size={13}>未来区域 · 不可读取</Text></g>}
    {prob.map((weight,j)=>{const begin=x(r),end=x(j),height=80+Math.abs(r-j)*33,fraction=(time+j*.17)%1,cx=mix(begin,end,fraction),cy=245-4*height*fraction*(1-fraction);return <g key={j}>
      {j!==r?<path d={`M${begin} 245 Q${(begin+end)/2} ${245-height*2} ${end} 245`} stroke={j===selected?C.gold:C.blue} strokeWidth={1+weight*19} strokeOpacity={weight? .65:.12} strokeDasharray={weight?undefined:'4 7'} fill="none"/>:<path d={`M${begin-20} 245C${begin-85} 125 ${begin+85} 125 ${begin+20} 245`} stroke={C.blue} strokeWidth={1+weight*19} fill="none" opacity=".7"/>}
      {time<3&&weight>0&&j!==r&&<circle cx={coord(cx)} cy={coord(cy)} r="5" fill={C.gold}/>}
      <Pick id={`attention:${r}:${j}`} label={`query ${r} 读取 ${names[j]}，概率 ${n(weight)}`} p={p}><circle cx={x(j)} cy="175" r="25" fill="var(--scene-bg,#0b1320)" stroke={weight?C.blue:C.frozen}/><Text x={x(j)} y={180} size={14} anchor="middle" color={weight?C.blue:C.frozen}>{n(weight)}</Text></Pick>
    </g>})}
    <path d="M85 286H960" stroke={C.frozen} strokeWidth="2"/>
    {names.map((name,i)=><Pick key={name} id={`query:${i}`} label={`阅读位置 ${i} ${name}`} p={p}><rect x={x(i)-58} y="245" width="116" height="80" rx="40" fill={i===r?C.gold:'var(--scene-bg,#0b1320)'} stroke={i===r?C.gold:C.frozen} strokeWidth="2"/><Text x={x(i)} y={277} anchor="middle" size={26} color={i===r?'var(--scene-bg,#0b1320)':C.ink}>{name}</Text><Text x={x(i)} y={305} anchor="middle" size={12} color={i===r?'var(--scene-bg,#0b1320)':C.muted}>Q={q[i]} K={k[i]}</Text></Pick>)}
    <Text x={60} y={373} size={13} color={C.muted}>读取 V</Text>
    {prob.map((weight,j)=><g key={j}><rect x={x(j)-75} y="350" width={150*weight*val[j]/4} height="35" fill={C.blue} fillOpacity=".5"/><Text x={x(j)} y={411} anchor="middle" color={C.blue} size={15}>{n(weight)} × {val[j]} = {n(weight*val[j])}</Text></g>)}
    <Text x={65} y={470} color={C.teal} size={24}>h(query {r}) = {n(dot(prob,val))}</Text>
    <Text x={455} y={462} size={13} color={C.muted}>下一 token 监督（与上方注意力独立）</Text>
    <Text x={455} y={491} color={C.gold} size={17}>P₀ → {v.prompt?'P₁':'−100'}　 P₁ → A　 A → EOS</Text>
    <Equation parts={[{text:'attention = softmax(QKᵀ + causal mask)',color:C.blue}]}/>
  </g>
}

export function SoftmaxScene(p:SceneProps){
  const {v,time}=p,z=[v.z,1,0],initial=softmax(z),gradient=initial.map((x,i)=>x-Number(i===v.target)),after=z.map((x,i)=>x-v.lr*gradient[i]),current=z.map((x,i)=>mix(x,after[i],smooth(time-3))),prob=softmax(current),vertices=[[450,95],[225,425],[675,425]],at=(ps:number[])=>[sum(ps.map((x,i)=>x*vertices[i][0])),sum(ps.map((x,i)=>x*vertices[i][1]))],position=at(prob),start=at(initial),end=at(softmax(after)),colors=[C.blue,C.gold,C.purple]
  return <g data-representation="probability-simplex">
    <Label x={35} y={38} title="三个概率相加为 1，所以预测只能在三角形内部移动" sub="顶点表示某一类概率为 1；点击顶点更换目标，观察梯度更新的方向"/>
    <polygon points={points(vertices)} fill={C.blue} fillOpacity=".04" stroke={C.frozen} strokeWidth="2"/>
    {[.25,.5,.75].map(f=>vertices.map((vertex,i)=>{const a=vertices[(i+1)%3],b=vertices[(i+2)%3];return <path key={`${i}:${f}`} d={`M${points([[mix(vertex[0],a[0],f),mix(vertex[1],a[1],f)]])}L${points([[mix(vertex[0],b[0],f),mix(vertex[1],b[1],f)]])}`} stroke={C.grid} fill="none"/>}))}
    {vertices.map(([x,y],i)=><Pick key={i} id={`target:${i}`} label={`将目标设为类别 ${i}`} p={p}><circle cx={x} cy={y} r={i===v.target?21:13} fill={colors[i]} fillOpacity={i===v.target?.9:.3} stroke={colors[i]} strokeWidth="2"/><Text x={x+(i===0?0:i===1?-20:20)} y={y+(i===0?-28:34)} anchor="middle" size={18} color={colors[i]}>p{i}=1 {i===v.target?'目标':''}</Text></Pick>)}
    <Arrow from={start} to={end} color={C.pink} width={3}/>
    <Pick id="loss" label={`当前概率点，loss ${n(ce(current,v.target))}`} p={p}><circle cx={coord(position[0])} cy={coord(position[1])} r="12" fill={C.ink}/><circle cx={coord(position[0])} cy={coord(position[1])} r="22" fill="none" stroke={C.ink} strokeDasharray="3 5"/></Pick>
    <Text x={790} y={115} size={16} color={C.muted}>预测的重心坐标</Text>
    {prob.map((value,i)=><Pick key={i} id={`prob:${i}`} label={`类别 ${i}，概率 ${n(value)}`} p={p}><Text x={790} y={170+i*73} color={colors[i]} size={32}>{n(value*100)}%</Text><Text x={790} y={196+i*73} size={12} color={C.muted}>p{i} · 更新前梯度 {n(gradient[i])}</Text></Pick>)}
    <Text x={790} y={420} size={20} color={C.pink}>CE = {n(ce(current,v.target))}</Text>
    <Axis x={65} y={510} w={580} min={-3} max={5}/>
    <DragHandle x={65+(v.z+3)/8*580} y={510} value={v.z} min={-3} max={5} step={.25} label="拖动初始类别0 logit" param="z" p={p} toValue={([x])=>(x-65)/580*8-3} color={C.blue}/>
    <Text x={730} y={480} color={C.muted} size={13}>下方拖动 z₀，其余初始 logits 固定</Text>
    <Text x={790} y={512} color={C.pink} size={18}>z′ = z − η(p − y)</Text>
  </g>
}
