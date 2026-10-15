import { adamTrajectory, preference, sigmoid, sum } from '../algorithm-math'
import { C, Equation, Label, mix, n, Node, Panel, Pick, Plot, smooth, Text, Wire, type SceneProps } from './primitives'

export function ChainScene(p:SceneProps){
 const {v,time:t}=p,prob=[.6,v.p,.9],prefix=[1,.6,.6*v.p,.6*v.p*.9],names=['输入 x','y₁','y₂','EOS']
 return <><Label x={35} y={35} title="沿着一条回答路径，概率质量不断收缩" sub="训练读入真实前缀；每一步都在预测下一个目标"/>
 {names.map((name,i)=><g key={name}><Node x={55+i*245} y={110} w={120} h={65} title={name} value={i?`p=${n(prob[i-1])}`:'condition'} color={i===Math.ceil(t)?C.gold:C.blue} id={`token:${i}`} p={p}/>{i<3&&<><Wire from={[175+i*245,143]} to={[300+i*245,143]} t={t} active={t>=i} label={`× ${n(prob[i])}`}/><Wire from={[175+i*245,143]} to={[300+i*245,235]} t={t} active={false} color={C.frozen}/><Text x={300+i*245} y={253} size={12} color={C.frozen}>其它 token：{n(1-prob[i])}</Text></>}</g>)}
 <Panel x={55} y={300} w={930} h={170} label="同一条路径的两种记账方式"><Text x={75} y={360} color={C.muted} size={13}>概率空间</Text><rect x={195} y={340} width={740} height={35} rx="3" fill="#1b2a3d"/>{[0,1,2,3].map(i=><rect key={i} x={195} y={340} width={740*prefix[i]} height={35} rx="3" fill={[C.frozen,C.blue,C.purple,C.gold][i]} fillOpacity={i<=Math.ceil(t)?.35:0} stroke={i===Math.ceil(t)?C.gold:'none'}/>)}<Text x={950} y={363} anchor="end" color={C.gold} size={14}>{n(prefix[Math.min(3,Math.ceil(t))])}</Text>
 <Text x={75} y={430} color={C.muted} size={13}>负 log 空间</Text>{prob.map((x,i)=>{const offset=sum(prob.slice(0,i).map(x=>-Math.log(x))),width=-Math.log(x)*220;return <Pick key={i} id={`nll:${i}`} label={`token ${i+1} 的负对数概率 ${n(-Math.log(x))}`} p={p}><rect x={195+offset*220} y={400} width={width} height={42} fill={[C.blue,C.purple,C.gold][i]} fillOpacity={t>=i?.4:.08} stroke={[C.blue,C.purple,C.gold][i]}/><Text x={195+offset*220+width/2} y={width<45?460:427} anchor="middle" size={13}>{n(-Math.log(x))}</Text></Pick>})}</Panel>
 <Equation parts={[{text:'−log(p₁p₂p₃)',color:C.gold},{text:' = −log p₁ −log p₂ −log p₃'}]}/></>
}

export function PreferenceScene(p:SceneProps){
 const {v,time:t}=p,b=v.mode?v.beta:1,ref=v.mode?v.reference:0,d=preference(v.margin,ref,b),z=mix(0,d.z,smooth(t)),extent=Math.max(8,Math.abs(d.z)+2),px=(x:number)=>585+(x+extent)/(2*extent)*370,py=(x:number)=>350-x*205
 return <><Label x={35} y={35} title="把两条回答的相对优势送进一条 sigmoid 曲线" sub={v.mode?'DPO：先校正参考策略，再拟合偏好标签':'奖励模型：直接比较 chosen / rejected 的奖励差'}/>
 <Node x={60} y={115} w={170} title={v.mode?'策略 log 概率差':'奖励分数差'} value={n(v.margin)} color={C.teal} id="margin" p={p}/><Node x={60} y={250} w={170} title={v.mode?"参考 log 概率差":"无参考校正"} value={n(ref)} color={v.mode?C.frozen:C.grid} id="reference" p={p}/>
 <Wire from={[230,147]} to={[335,210]} t={t} active={t<1} color={C.teal} label="+"/><Wire from={[230,282]} to={[335,210]} t={t} active={t<1&&!!v.mode} color={C.pink} label="−"/>
 <circle cx={350} cy={210} r="22" fill="#132434" stroke={C.blue}/><Text x={350} y={216} anchor="middle" color={C.blue}>Δ</Text><Wire from={[372,210]} to={[445,210]} t={t} active={t>=0} label={`× ${n(b)}`}/><Node x={435} y={180} w={105} title="z" value={n(d.z)} id="z" p={p} color={C.gold}/>
 <Plot x={585} y={145} w={370} h={205} xmin={-extent} xmax={extent} ymin={0} ymax={1} points={Array.from({length:81},(_,i)=>[-extent+i*extent/40,sigmoid(-extent+i*extent/40)])} dot={[z,sigmoid(z)]} color={C.teal} xlabel="参考校正后的偏好差 z" ylabel="P(chosen ≻ rejected)"/>
 <path d={`M${px(z)-18} ${py(sigmoid(z))+18*205/370*2*extent*sigmoid(z)*(1-sigmoid(z))} L${px(z)+18} ${py(sigmoid(z))-18*205/370*2*extent*sigmoid(z)*(1-sigmoid(z))}`} stroke={C.gold} opacity={t>=3?1:0}/>
 <Node x={585} y={425} w={170} title="−log σ(z)" value={n(d.loss)} id="preference-loss" color={C.gold} p={p}/><Wire from={[755,456]} to={[955,456]} t={t} active={t>=3} color={C.pink} label={`∂L/∂margin=${n(d.gradient)}`}/>
 <Equation parts={[{text:'L = −log σ(',color:C.ink},{text:'β',color:C.gold},{text:' · ('},{text:'mθ',color:C.teal},{text:' − '},{text:'mref',color:C.frozen},{text:'))'}]}/></>
}

export function PolicyScene(p:SceneProps){
 const {v,time:t}=p,rewards=v.group===0?[0,0,1,1]:Array(4).fill(v.group===1?1:0),mean=sum(rewards)/4,sd=Math.sqrt(sum(rewards.map(r=>(r-mean)**2))/4),adv=rewards.map(r=>(r-mean)/(sd+1e-8)),a=adv[v.sample],clamp=(x:number)=>Math.max(1-v.epsilon,Math.min(1+v.epsilon,x)),fn=(x:number)=>Math.min(x*a,clamp(x)*a)
 return <><Label x={35} y={35} title="从组内奖励，到一个受约束的更新" sub="点选一个回答，追踪它的优势符号如何改变裁剪方向"/>
 {rewards.map((r,i)=><g key={i} onClick={()=>p.setValue('sample',i)}><Node x={50} y={115+i*80} w={130} h={58} title={`回答 ${i}`} value={`reward ${r}`} color={i===v.sample?C.gold:C.blue} id={`sample:${i}`} p={p}/><Wire from={[180,145+i*80]} to={[335,145+i*80]} t={t} active={t>=1} color={adv[i]<0?C.pink:C.teal} label="−均值；÷(σ+ε)"/><Node x={335} y={115+i*80} w={105} h={58} title={`A${i}`} value={n(adv[i])} color={adv[i]<0?C.pink:C.teal} id={`advantage:${i}`} p={p}/></g>)}
 {t<3?<><Plot x={560} y={145} w={390} h={250} xmin={.4} xmax={1.6} ymin={-1.7} ymax={1.7} points={Array.from({length:61},(_,i)=>{const x=.4+i*.02;return[x,fn(x)]})} dot={[v.ratio,fn(v.ratio)]} color={a<0?C.pink:C.teal} xlabel="ρ = πθ / πold" ylabel="Jclip（最大化）"/>
 <rect x={560+(1-v.epsilon-.4)/1.2*390} y={145} width={2*v.epsilon/1.2*390} height={250} fill={C.gold} opacity=".08"/><Text x={560} y={475} color={C.gold} size={15}>选中 A={n(a)} → surrogate={n(fn(v.ratio))}</Text>
 </>:<Panel x={510} y={105} w={480} h={375} label="KL(current ∥ reference) · 两个可能的行动">
 {['reference','current'].map((label,j)=>{const probs=j?[.5*v.ratio,1-.5*v.ratio]:[.5,.5];return <g key={label}><Text x={535} y={163+j*100} color={j?C.gold:C.frozen}>{label}</Text>{probs.map((value,k)=><g key={k}><rect x={535+(k?probs[0]*420:0)} y={180+j*100} width={value*420} height={38} fill={k?C.purple:C.blue} fillOpacity=".35" stroke={k?C.purple:C.blue}/><Text x={535+(k?probs[0]*420:0)+value*210} y={205+j*100} anchor="middle" size={14}>p{k}={n(value)}</Text></g>)}</g>})}
 <Text x={535} y={365} color={C.pink} size={16}>KL = Σ pθ log(pθ / pref)</Text><Text x={535} y={403} color={C.gold} size={23}>{n(.5*v.ratio*Math.log(v.ratio)+(1-.5*v.ratio)*Math.log(2-v.ratio))}</Text><Text x={535} y={449} color={C.muted} size={13}>对完整分布求和；单个 log 比值可以为负。</Text>
 </Panel>}
 <Equation parts={[{text:t<3?'min(ρA, clip(ρ)A)':'J = E[r] − β KL(πθ ∥ πref)',color:C.gold},{text:'   ·   '},{text:'old：采样 · ref：参考',color:C.frozen}]}/></>
}

export function BackpropScene(p:SceneProps){
 const {v,time:t}=p,h=v.a*2,y=v.b*h,e=y-4,da=v.detach?0:e*v.b*2,phase=Math.floor(t),positions=[60,245,440,635,835]
 return <><Label x={35} y={35} title="前向传值，反向传局部导数的乘积" sub="冻结 b 仍保留计算路径；detach 会切断整个上游梯度"/>
 {[0,1,2,3].map(i=><Wire key={i} from={[positions[i]+100,215]} to={[positions[i+1],215]} t={t} active={phase<2} color={i===2?C.frozen:C.blue}/>)}
 <Node x={60} y={180} w={100} title="输入 x" value="2" id="input" p={p}/><Node x={245} y={180} w={100} title="× a" value={n(v.a)} id="a" color={C.gold} p={p}/><Node x={440} y={180} w={100} title="h = ax" value={n(h)} id="h" p={p}/><Node x={635} y={180} w={100} title="× b ⛓" value={n(v.b)} color={C.frozen} id="b" p={p}/><Node x={835} y={180} w={135} title="ŷ → Loss" value={n(e*e/2)} color={C.pink} id="squared-loss" p={p}/>
 <Text x={900} y={285} anchor="middle" color={C.muted}>ŷ={n(y)} · target=4</Text>
 {phase>=2&&<><Wire from={[900,335]} to={[685,335]} t={t} active color={C.pink} label={`dL/dŷ = ${n(e)}`}/><Wire from={[685,335]} to={[490,335]} t={t} active={!v.detach} color={C.pink} label={`× b = ${n(v.b)}`}/><Wire from={[490,335]} to={[295,335]} t={t} active={!v.detach&&phase>=3} color={C.pink} label="× x = 2"/><Text x={295} y={380} anchor="middle" color={C.gold}>dL/da = {v.detach?'∅':n(da)}</Text></>}
 {!!v.detach&&<g><path d="M570 280l28 28m-28 0l28 -28" stroke={C.pink} strokeWidth="4"/><Text x={584} y={355} anchor="middle" color={C.pink} size={13}>detach</Text></g>}
 <Panel x={240} y={435} w={730} h={50}><Text x={265} y={467} color={C.pink}>链式法则</Text><Text x={405} y={467} size={20}>{n(e)} × {n(v.b)} × 2 = {v.detach?'无上游路径':n(da)}</Text></Panel>
 <Equation parts={[{text:'∂L/∂a = ',color:C.pink},{text:'(ŷ−t)',color:C.pink},{text:' · b',color:C.frozen},{text:' · x',color:C.blue}]}/></>
}

export function LoraGradientScene(p:SceneProps){
 const {v,time:t}=p,iteration=Math.min(2,Math.floor(t/2));let a=v.zero?0:.5,b=0
 for(let i=0;i<iteration;i++){const err=b*a*2-1,ga=err*b*2,gb=err*a*2;a-=v.lr*ga;b-=v.lr*gb}
 const err=b*a*2-1,ga=err*b*2,gb=err*a*2,amount=smooth(t%2),nextA=a-v.lr*ga,nextB=b-v.lr*gb,currentA=mix(a,nextA,amount),currentB=mix(b,nextB,amount)
 return <><Label x={35} y={35} title="零初始化为什么只放在一边" sub={`第 ${iteration+1} 次反向传播 · 金色权重会更新，冻结基座保持不变`}/>
 <Node x={55} y={180} w={95} title="输入 x" value="2" id="init-x" p={p}/><Wire from={[150,210]} to={[300,210]} t={t} active label="x"/>
 <Node x={300} y={180} w={110} title="A" value={n(currentA)} color={C.blue} id="init-A" p={p}/><Wire from={[410,210]} to={[550,210]} t={t} active={a!==0} label={`Ax=${n(currentA*2)}`}/>
 <Node x={550} y={180} w={110} title="B" value={n(currentB)} color={C.gold} id="init-B" p={p}/><Wire from={[660,210]} to={[830,210]} t={t} active={b!==0} color={C.gold} label={`BAx=${n(currentB*currentA*2)}`}/><Node x={830} y={180} w={140} title="½(y−1)²" value={n((currentB*currentA*2-1)**2/2)} color={C.pink} id="init-loss" p={p}/>
 <Wire from={[900,335]} to={[605,335]} t={t} active={gb!==0} color={C.pink} label={`更新前 gB = (y−1)Ax = ${n(gb)}`}/><Wire from={[605,335]} to={[355,335]} t={t} active={ga!==0} color={C.pink} label={`更新前 gA = (y−1)Bx = ${n(ga)}`}/>
 <Text x={355} y={386} anchor="middle" color={ga===0?C.frozen:C.blue}>{ga===0?'没有参数梯度流入 A':'A 开始学习'}</Text><Text x={605} y={386} anchor="middle" color={gb===0?C.frozen:C.gold}>{gb===0?'B 也被卡在零点':'B 接收非零梯度'}</Text>
 <Panel x={55} y={435} w={915} h={55}><Text x={80} y={469} color={C.gold}>{v.zero?'A=B=0 → 两个导数同时为0，无法离开原点':iteration===0?'B=0 → gA=0；但 Ax≠0，所以 B 可以先更新':'B 已经非零 → 梯度能够继续流回 A'}</Text></Panel>
 <Equation parts={[{text:'A ← A − ηgA',color:C.blue},{text:'       '},{text:'B ← B − ηgB',color:C.gold}]}/></>
}

export function AccumulationScene(p:SceneProps){
 const {v,time:t}=p,N=2+v.n,g=(2+v.n*3)/N,phase=Math.floor(t)
 return <><Label x={35} y={35} title="每个有效 token 投入同一个梯度累积器" sub="两条回答长度不同，但每个 token 在目标中的权重都应该是 1/N"/>
 <Label x={60} y={105} title="microbatch 1" sub="2 tokens · 每个梯度=1" color={C.blue}/><Label x={60} y={265} title="microbatch 2" sub={`${v.n} tokens · 每个梯度=3`} color={C.purple}/>
 {[2,v.n].map((count,lane)=>Array.from({length:count},(_,i)=>{const x=65+(i%10)*38,y=140+lane*160+Math.floor(i/10)*45,active=phase===lane+1;return <g key={`${lane}:${i}`}><Pick id={`gradient-token:${lane}:${i}`} label={`batch${lane+1} token${i+1}，贡献 ${n((lane?3:1)/N)}`} p={p}><rect x={x} y={y} width="28" height="31" rx="4" fill={lane?C.purple:C.blue} opacity=".3" stroke={lane?C.purple:C.blue}/><Text x={x+14} y={y+21} anchor="middle" size={12}>{lane?3:1}</Text></Pick><Wire from={[x+14,y+35]} to={[610,240]} t={t+i/count} active={active} color={lane?C.purple:C.blue} width={.7}/></g>}))}
 <Node x={570} y={205} w={150} h={82} title={`Σ grad / N=${N}`} value={n(phase<1?0:phase===1?2/N:g)} color={C.teal} id="accumulator" p={p}/><Wire from={[720,245]} to={[840,245]} t={t} active={phase===3} color={C.gold} label="一次 step"/><Node x={840} y={210} w={135} title="w′ = 1−0.1G" value={n(1-.1*g)} color={C.gold} id="updated-weight" p={p}/>
 <Panel x={560} y={350} w={415} h={110} label="若错误地平均两个 batch 的均值"><Text x={585} y={405} color={C.pink} size={23}>(1 + 3) / 2 = 2</Text><Text x={585} y={435} color={C.muted} size={13}>短回答里的每个 token 被过度加权</Text></Panel>
 <Equation parts={[{text:`G = (2×1 + ${v.n}×3) / ${N}`,color:C.teal},{text:` = ${n(g)}`,color:C.gold}]}/></>
}

export function OptimizerScene(p:SceneProps){
 const {v,time:t}=p,trajectory=adamTrajectory(v.lr,v.clip,v.decay),i=Math.min(7,Math.floor(t)),row=trajectory[i],w=mix(row.w,trajectory[Math.min(7,i+1)].w,smooth(t-i)),sx=(x:number)=>80+(x+1)/3.2*465,sy=(y:number)=>410-y/2.5*290
 return <><Label x={35} y={35} title="在损失曲线上，看一个参数怎样被更新" sub="当前例子 L(w)=w²/2；图中运动来自真实 AdamW 更新数值"/>
 <Plot x={80} y={120} w={465} h={290} xmin={-1} xmax={2.2} ymin={0} ymax={2.5} points={Array.from({length:65},(_,i)=>{const x=-1+i*.05;return[x,x*x/2]})} dot={[w,w*w/2]} xlabel="参数 w" ylabel="损失 L(w)" color={C.blue}/>
 {trajectory.slice(0,i+1).map((r,j)=><Pick key={j} id={`optimizer-step:${j}`} label={`优化器第${j+1}步，w=${n(r.w)}`} p={p}><circle cx={80+(r.w+1)/3.2*465} cy={410-r.w*r.w/2/2.5*290} r="4" fill={C.purple}/></Pick>)}
 <Wire from={[sx(row.before),sy(row.before**2/2)]} to={[sx(row.w),sy(row.w**2/2)]} t={t} active color={C.gold} width={3}/>
 <Node x={640} y={115} w={140} title="原始梯度" value={n(row.raw)} color={C.pink} id="raw-gradient" p={p}/><Wire from={[710,177]} to={[710,220]} t={t} active color={C.pink} label={`clip ${v.clip}`}/><Node x={640} y={220} w={140} title="裁剪后 g" value={n(row.g)} color={C.pink} id="clipped-gradient" p={p}/>
 <Wire from={[780,250]} to={[870,150]} t={t} active color={C.blue}/><Wire from={[780,250]} to={[870,320]} t={t} active color={C.purple}/><Node x={850} y={115} w={135} title="校正一阶矩 m̂" value={n(row.mh)} color={C.blue} id="moment-m" p={p}/><Node x={850} y={290} w={135} title="校正二阶矩 v̂" value={n(row.vh)} color={C.purple} id="moment-v" p={p}/>
 <Text x={640} y={425} color={C.gold} size={17}>w: {n(row.before)} → {n(row.w)}</Text><Text x={640} y={455} color={C.muted} size={13}>权重衰减独立作用：−ηλw</Text>
 <Equation parts={[{text:'w′ = (1−ηλ)w',color:C.gold},{text:' − ηm̂ / (√v̂+ε)',color:C.blue}]}/></>
}
