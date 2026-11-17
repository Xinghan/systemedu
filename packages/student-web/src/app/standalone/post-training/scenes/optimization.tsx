import { adamTrajectory } from '../algorithm-math'
import { C, coord, Equation, Label, mix, n, Pick, smooth, Text, type SceneProps } from './primitives'
import { Arrow, Axis, DragHandle } from './direct-manipulation'
const pts=(v:number[][])=>v.map(p=>p.map(coord).join(',')).join(' ')

export function BackpropScene(p:SceneProps){
  const {v,time}=p,h=2*v.a,y=v.b*h,e=y-4,deltaA=Math.min(2,Math.max(-1,v.a+.12*Math.sin(time*Math.PI)))-v.a
  const panels=[{x:65,title:'h = 2a',min:-1,max:2,ymin:-2,ymax:4,input:v.a,output:h,fn:(x:number)=>2*x,slope:2,color:C.blue,id:'a'},
    {x:395,title:'ŷ = b · h',min:-2,max:4,ymin:-8,ymax:16,input:h,output:y,fn:(x:number)=>v.b*x,slope:v.b,color:C.frozen,id:'b'},
    {x:725,title:'L = ½(ŷ−4)²',min:-8,max:16,ymin:0,ymax:72,input:y,output:e*e/2,fn:(x:number)=>(x-4)**2/2,slope:e,color:C.pink,id:'squared-loss'}]
  return <g data-representation="composed-functions-and-slopes">
    <Label x={35} y={38} title="链式法则，是把三段函数的局部斜率相乘" sub="看相同的微小扰动依次通过三段函数；冻结参数仍保留函数的斜率"/>
    {panels.map(panel=>{const sx=(x:number)=>panel.x+(x-panel.min)/(panel.max-panel.min)*245,sy=(x:number)=>330-(x-panel.ymin)/(panel.ymax-panel.ymin)*200,dx=.16*(panel.max-panel.min),left=Math.max(panel.min,panel.input-dx),right=Math.min(panel.max,panel.input+dx),tangent=[[left,panel.output+(left-panel.input)*panel.slope],[right,panel.output+(right-panel.input)*panel.slope]],probe=Math.min(panel.max,Math.max(panel.min,panel.input+(panel.id==='a'?deltaA:panel.id==='b'?2*deltaA:2*v.b*deltaA))),probeY=panel.fn(probe);return <g key={panel.id}>
      <Text x={panel.x} y={108} size={24} color={panel.color}>{panel.title}</Text>
      <path d={`M${panel.x} 130V330H${panel.x+245}`} stroke={C.frozen} fill="none"/>
      <polyline points={pts(Array.from({length:61},(_,i)=>{const x=panel.min+(panel.max-panel.min)*i/60;return[sx(x),sy(panel.fn(x))]}))} stroke={panel.color} strokeWidth="3" fill="none"/>
      <polyline points={pts(tangent.map(([a,b])=>[sx(a),sy(b)]))} stroke={C.gold} strokeWidth="2" fill="none"/>
      <Pick id={panel.id} label={`${panel.title}，局部斜率 ${n(panel.slope)}`} p={p}><circle cx={coord(sx(panel.input))} cy={coord(sy(panel.output))} r="9" fill={C.gold}/></Pick>
      <path d={`M${coord(sx(panel.input))} ${coord(sy(panel.output))}H${coord(sx(probe))}V${coord(sy(probeY))}`} fill="none" stroke={panel.color} strokeWidth="2" strokeDasharray="3 3"/><circle cx={coord(sx(probe))} cy={coord(sy(probeY))} r="5" fill={panel.color}/>
      {panel.id==='a'&&<DragHandle x={sx(v.a)} y={330} value={v.a} min={-1} max={2} step={.1} label="拖动上游参数 a" param="a" p={p} toValue={([x])=>-1+(x-panel.x)/245*3} color={C.blue}/>}
      <Text x={panel.x} y={359} color={C.muted} size={12}>输入 {n(panel.input)} → 输出 {n(panel.output)}</Text>
      <Text x={panel.x} y={393} color={panel.color} size={22}>局部导数 {n(panel.slope)}</Text>
    </g>})}
    <Arrow from={[850,440]} to={[540,440]} color={C.pink} width={time>=2?4:1}/>
    {!v.detach&&<Arrow from={[500,440]} to={[205,440]} color={C.pink} width={time>=3?4:1}/>}
    <Pick id="detach-switch" label={v.detach?'恢复梯度连接':'切断中间 h 的梯度'} p={p}><circle cx="365" cy="440" r="22" fill="var(--scene-bg,#0b1320)" stroke={v.detach?C.pink:C.teal}/><Text x={365} y={447} anchor="middle" size={22} color={v.detach?C.pink:C.teal}>{v.detach?'×':'↶'}</Text></Pick>
    <Text x={365} y={483} anchor="middle" size={13} color={C.muted}>点击 {v.detach?'接回':'detach'} 路径</Text>
    <Equation parts={[{text:'dL/da = ',color:C.pink},{text:`${n(e)} × ${n(v.b)} × 2`,color:C.gold},{text:v.detach?' → 无上游梯度':` = ${n(e*v.b*2)}`}]}/>
  </g>
}

function Balance({x,y,w,counts,mean,correct,p,time}:{x:number;y:number;w:number;counts:number[];mean:number;correct:boolean;p:SceneProps;time:number}){
  const sx=(g:number)=>x+(g-1)/2*w,pivot=sx(mean)
  return <g>
    <path d={`M${x} ${y}H${x+w}`} stroke={correct?C.teal:C.pink} strokeWidth="3"/>
    <path d={`M${coord(pivot)} ${y+4}l-16 28h32Z`} fill={correct?C.teal:C.pink}/>
    {counts.map((count,lane)=><g key={lane}>
      <path d={`M${sx(lane?3:1)} ${y}v-55`} stroke={C.frozen}/>
      <path d={`M${sx(lane?3:1)-50} ${y-55}h100l-12 15h-76Z`} fill={correct?C.teal:C.pink} fillOpacity=".15" stroke={correct?C.teal:C.pink}/>
      {Array.from({length:correct?count:1},(_,i)=>{const px=sx(lane?3:1)+(correct?(i%5-(Math.min(count,5)-1)/2)*16:0),py=y-71-Math.floor(i/5)*17,arrival=smooth(time-(lane?1:0));return <Pick key={i} id={correct?`gradient-token:${lane}:${i}`:`batch-mean:${lane}`} label={correct?`batch ${lane+1} token ${i+1}，权重 ${n(1/(counts[0]+counts[1]))}`:`batch ${lane+1} 均值，权重1/2`} p={p}><circle cx={px} cy={coord(py-25*(1-arrival))} r={correct?6:20} fill={lane?C.purple:C.blue} fillOpacity={.25+.65*arrival}/>{!correct&&<Text x={px} y={py+5} anchor="middle" size={14}>{lane?3:1}</Text>}</Pick>})}
      <Text x={sx(lane?3:1)} y={y+53} anchor="middle" size={14} color={C.muted}>g={lane?3:1}</Text>
    </g>)}
    <Text x={pivot} y={y+82} anchor="middle" size={25} color={correct?C.teal:C.pink}>G={n(mean)}</Text>
  </g>
}
export function AccumulationScene(p:SceneProps){
  const {v,time}=p,N=2+v.n,mean=(2+3*v.n)/N
  return <g data-representation="token-weighted-balance">
    <Label x={35} y={38} title="两个 batch 到底应该各有多重？" sub="支点是加权平均梯度。圆点代表 token；大圆代表一个 batch 的均值。"/>
    <Text x={70} y={118} color={C.teal} size={25}>按 token 等权</Text><Text x={590} y={118} color={C.pink} size={25}>按 batch 等权</Text>
    <Text x={70} y={150} color={C.muted} size={14}>2 个短回答 token + {v.n} 个长回答 token</Text><Text x={590} y={150} color={C.muted} size={14}>两个 batch 各占 1/2，不论长度</Text>
    <Balance x={110} y={305} w={310} counts={[2,v.n]} mean={mean} correct p={p} time={time}/>
    <Balance x={620} y={305} w={310} counts={[2,v.n]} mean={2} correct={false} p={p} time={time}/>
    <path d="M520 100V430" stroke={C.grid} strokeDasharray="5 6"/>
    <Text x={70} y={440} color={C.teal} size={16}>每个 token 的权重：1/{N}</Text><Text x={590} y={440} color={C.pink} size={16}>短 batch 内每个 token 权重：1/4</Text>
    <Axis x={100} y={480} w={380} min={2} max={20}/>
    <DragHandle x={100+(v.n-2)/18*380} y={480} value={v.n} min={2} max={20} step={1} param="n" label="拖动长回答的 token 数量" p={p} toValue={([x])=>2+(x-100)/380*18} color={C.teal}/>
    <Text x={590} y={496} size={17}>一次 step：w′=1−0.1G={n(1-.1*mean)}</Text>
    <Text x={100} y={535} color={C.muted} size={13}>拖动改变长回答长度，观察两个支点是否重合</Text>
  </g>
}

export function OptimizerScene(p:SceneProps){
  const {v,time}=p,rows=adamTrajectory(v.lr,v.clip,v.decay),i=Math.min(7,Math.floor(time)),row=rows[i],current=mix(row.w,rows[Math.min(7,i+1)].w,smooth(time-i)),sx=(x:number)=>85+(x+1)/3.2*570,sy=(loss:number)=>420-loss/2.5*300
  return <g data-representation="adamw-valley-and-memory">
    <Label x={35} y={38} title="沿损失山谷前进，步子还受过去的梯度影响" sub="点击历史落点回看那次更新；右侧显示一阶矩记忆中各次梯度的贡献"/>
    <path d={`M${sx(-1)} 420L${pts(Array.from({length:65},(_,j)=>{const x=-1+j*.05;return[sx(x),sy(x*x/2)]}))}L${sx(2.2)} 420Z`} fill={C.blue} fillOpacity=".08"/>
    <polyline points={pts(Array.from({length:65},(_,j)=>{const x=-1+j*.05;return[sx(x),sy(x*x/2)]}))} fill="none" stroke={C.blue} strokeWidth="3"/>
    <path d="M85 110V420H655" stroke={C.frozen} fill="none"/>
    <Text x={85} y={96} color={C.muted} size={14}>L(w)=w²/2</Text><Text x={655} y={446} anchor="end" size={14} color={C.muted}>参数 w →</Text>
    <polyline points={pts([[sx(2),sy(2)],...rows.slice(0,i+1).map(r=>[sx(r.w),sy(r.w*r.w/2)])])} fill="none" stroke={C.gold} strokeWidth="2"/>
    {rows.map((r,j)=><Pick key={j} id={`optimizer-step:${j}`} label={`回看 AdamW 第 ${j+1} 步，w=${n(r.w)}`} p={p}><circle cx={coord(sx(r.w))} cy={coord(sy(r.w*r.w/2))} r={j===i?8:5} fill={j<=i?C.gold:C.frozen} opacity={j<=i?1:.3}/></Pick>)}
    <circle cx={coord(sx(current))} cy={coord(sy(current*current/2))} r="12" fill={C.gold} stroke={C.ink}/>
    <Text x={110} y={485} color={C.gold} size={26}>w{i+1} = {n(row.w)}</Text>
    <Text x={735} y={112} color={C.purple} size={18}>一阶矩的衰减记忆</Text>
    {rows.slice(0,i+1).map((r,j)=>{const contribution=.1*.9**(i-j)*r.g;return <g key={j}><Text x={735} y={150+j*30} color={C.muted} size={12}>g{j+1}</Text><rect x="770" y={137+j*30} width={Math.abs(contribution)*1000} height="16" fill={contribution<0?C.pink:C.purple}/><Text x={980} y={150+j*30} anchor="end" size={12}>{n(contribution)}</Text></g>})}
    <Text x={735} y={421} size={15} color={C.pink}>g: {n(row.raw)} → clip {n(row.g)}</Text>
    <Text x={735} y={454} size={15} color={C.purple}>m̂={n(row.mh)}　v̂={n(row.vh)}</Text>
    <Text x={735} y={487} size={15} color={C.muted}>独立衰减项 −ηλw={n(-v.lr*v.decay*row.before)}</Text>
    <Equation parts={[{text:'w′ = (1−ηλ)w − ηm̂/(√v̂+ε)',color:C.gold}]}/>
  </g>
}

export function LoraGradientScene(p:SceneProps){
  const {v,time}=p,min=-.35,max=1.2,sx=(a:number)=>90+(a-min)/(max-min)*570,sy=(b:number)=>445-(b-min)/(max-min)*330
  let a=v.zero?0:.5,b=0
  const states=[{a,b}]
  for(let i=0;i<3;i++){const e=2*a*b-1,ga=e*b*2,gb=e*a*2;a-=v.lr*ga;b-=v.lr*gb;states.push({a,b})}
  const iteration=Math.min(2,Math.floor(time/2)),before=states[iteration],after=states[iteration+1],amount=smooth(time%2),current={a:mix(before.a,after.a,amount),b:mix(before.b,after.b,amount)},err=2*before.a*before.b-1
  const contour=(loss:number,sign:number)=>{let path='',drawing=false;for(let i=0;i<=200;i++){const x=min+(max-min)*i/200,y=(1+sign*Math.sqrt(2*loss))/(2*x);if(Number.isFinite(y)&&y>=min&&y<=max){path+=`${drawing?'L':'M'}${coord(sx(x))},${coord(sy(y))}`;drawing=true}else drawing=false}return path}
  return <g data-representation="bilinear-loss-contours">
    <Label x={35} y={38} title="把 A 和 B 当作两个坐标，看优化器能否离开起点" sub="颜色表示 L(A,B)=½(2AB−1)²；绿色曲线是满足 2AB=1 的零损失解"/>
    {Array.from({length:24},(_,row)=>Array.from({length:32},(_,col)=>{const a=min+(col+.5)/32*(max-min),b=min+(row+.5)/24*(max-min),loss=(2*a*b-1)**2/2;return <rect key={`${row}:${col}`} x={coord(90+col*570/32)} y={coord(115+(23-row)*330/24)} width={570/32+.2} height={330/24+.2} fill={C.pink} fillOpacity={coord(.03+Math.min(.38,Math.log1p(loss)*.22))}/>}))}
    {[0,.04,.15,.5,1].map(loss=><g key={loss}>{[-1,1].map(sign=><path key={sign} d={contour(loss,sign)} fill="none" stroke={loss===0?C.teal:C.frozen} strokeWidth={loss===0?3:1} strokeOpacity={loss===0?1:.5}/>)}</g>)}
    <path d={`M90 ${sy(0)}H660M${sx(0)} 115V445`} stroke={C.frozen}/>
    <Text x={90} y={462} color={C.muted} size={11}>−0.35</Text><Text x={660} y={462} anchor="end" color={C.muted} size={11}>1.2</Text><Text x={80} y={120} anchor="end" color={C.muted} size={11}>1.2</Text><Text x={670} y={sy(0)+5} color={C.blue} size={18}>A</Text><Text x={sx(0)-10} y={105} color={C.gold} size={18}>B</Text>
    <polyline points={pts(states.slice(0,iteration+1).map(s=>[sx(s.a),sy(s.b)]).concat([[sx(current.a),sy(current.b)]]))} stroke={C.gold} strokeWidth="3" fill="none"/>
    {states.map((s,i)=><Pick key={i} id={`init-iteration:${i}`} label={`第 ${i} 次更新后 A=${n(s.a)}, B=${n(s.b)}`} p={p}><circle cx={coord(sx(s.a))} cy={coord(sy(s.b))} r="5" fill={C.gold}/></Pick>)}
    <Arrow from={[sx(before.a),sy(before.b)]} to={[sx(after.a),sy(after.b)]} color={C.gold} width={3}/>
    <circle cx={coord(sx(current.a))} cy={coord(sy(current.b))} r="11" fill={v.zero?C.pink:C.gold} stroke={C.ink}/>
    <Pick id="zero-origin" label="将 A 和 B 都设为零，检查驻点" p={p}><circle cx={coord(sx(0))} cy={coord(sy(0))} r="15" fill="transparent" stroke={C.pink} strokeDasharray="3 3"/></Pick>
    <Text x={730} y={145} color={v.zero?C.pink:C.gold} size={27}>{v.zero?'原点没有梯度':'先沿 B 轴出发'}</Text>
    <Text x={730} y={203} size={22} color={C.blue}>A={n(current.a)}</Text><Text x={730} y={242} size={22} color={C.gold}>B={n(current.b)}</Text>
    <Text x={730} y={300} size={14} color={C.pink}>gA=(y−1)·B·2={n(err*before.b*2)}</Text><Text x={730} y={337} size={14} color={C.pink}>gB=(y−1)·A·2={n(err*before.a*2)}</Text>
    <Text x={730} y={392} size={16}>当前 L={n((2*current.a*current.b-1)**2/2)}</Text>
    <Text x={90} y={485} color={C.muted} size={15}>双零是驻点，不是最优解。只有一边为零时，另一边可以提供梯度信号。</Text>
    <Equation parts={[{text:'(A, B) ← (A, B) − η(gA, gB)',color:C.gold}]}/>
  </g>
}
