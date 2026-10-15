import { ALGORITHMS } from '../algorithm-catalog'
import { adamTrajectory, bootstrap, ce, classification, dot, lora, NF4, preference, quantize, softmax, sum } from '../algorithm-math'
import { AttentionScene, LoraGeometry, LoraScene, QuantizationScene, SoftmaxScene } from './core'
import { AccumulationScene, BackpropScene, ChainScene, LoraGradientScene, OptimizerScene, PolicyScene, PreferenceScene } from './training'
import { BootstrapScene, CheckpointScene, DoubleQuantScene, MetricsScene } from './resources'
import { n, smooth, type SceneProps } from './primitives'
export const SCENES={chain:ChainScene,preference:PreferenceScene,policy:PolicyScene,attention:AttentionScene,softmax:SoftmaxScene,backprop:BackpropScene,accumulation:AccumulationScene,optimizer:OptimizerScene,lora:LoraScene,loragrad:LoraGradientScene,nf4:QuantizationScene,doublequant:DoubleQuantScene,checkpoint:CheckpointScene,metrics:MetricsScene,bootstrap:BootstrapScene}
export function AlgorithmScene({id,...props}:SceneProps&{id:string}){const Scene=SCENES[id as keyof typeof SCENES];return id==='lora'&&props.geometry?<LoraGeometry {...props}/>:<Scene {...props}/>}
export type Inspection={title:string;expression:string;explanation:string}
export function inspect(id:string,v:Record<string,number>,focus:string,time:number):Inspection{
 const frames=ALGORITHMS[id].frames(v),frame=frames[Math.max(0,Math.min(frames.length-1,Math.floor(time)))]
 const fallback={title:focus?`追踪 ${focus}`:frame.title,expression:frame.formula,explanation:frame.explain}
 const [kind,a,b]=focus.split(':'),r=Number(a??0),c=Number(b??0),bounded=(x:number,max:number)=>Number.isInteger(x)&&x>=0&&x<=max?x:0
 if(id==='lora'){
  const d=lora(v.rank,v.alpha,[1,2,v.x]),x=[1,2,v.x],s=v.alpha/v.rank
  if(kind==='x'&&x[r]!==undefined)return {title:`输入 x[${r}]`,expression:`x[${r}]=${n(x[r])}`,explanation:'同一个输入同时送往冻结基座和低秩分支。改变 x₃ 会重新计算 A 的每一行点积，再经 B 改变输出；不会直接改变 A/B 的参数。'}
  if(kind==='A'&&d.A[r]?.[c]!==undefined)return {title:`A[${r},${c}] → u[${r}]`,expression:`${n(d.A[r][c])} × x[${c}]=${n(x[c])} → ${n(d.A[r][c]*x[c])}`,explanation:`选中这一行后，三个乘积相加：${d.A[r].map((a,j)=>`${n(a)}×${n(x[j])}`).join(' + ')} = ${n(d.u[r])}。它是低维坐标 u[${r}]。`}
  if(kind==='B'&&d.B[r]?.[c]!==undefined)return {title:`B[${r},${c}] → Δh[${r}]`,expression:`(α/r) × B[${r},${c}] × u[${c}] = ${n(s*d.B[r][c]*d.u[c])}`,explanation:`B的第${c+1}列是输出方向；u[${c}]=${n(d.u[c])}决定沿此方向走多远。对所有rank分量求和得到 Δh[${r}]=${n(d.delta[r])}。`}
  if(kind==='u'&&d.u[r]!==undefined)return {title:`投影坐标 u[${r}]`,expression:`${d.A[r].map((a,j)=>`${n(a)}×${n(x[j])}`).join(' + ')} = ${n(d.u[r])}`,explanation:'A的一行与输入向量做点积。这个标量随后乘到B的对应列上。值为0时，此输入不会激活这一个更新方向。'}
  if(kind==='basis'||kind==='component'){const k=bounded(r,v.rank-1);return {title:`输出方向 b${k+1}`,expression:`b=[${d.B.map(row=>n(row[k])).join(', ')}]，系数 (α/r)u=${n(s*d.u[k])}`,explanation:'向量方向来自B的一列。r=1时所有增量沿一条直线；r=2时增量落在两列张成的平面。这里投影的是真实三维向量。'}}
  if(kind==='delta'||kind==='output')return {title:`最终输出坐标 ${r}`,expression:`${n(d.base[r]??0)} + ${n(d.delta[r]??0)} = ${n(d.y[r]??0)}`,explanation:'相同输入同时经过冻结基座与低秩分支。两条分支在输出空间相加；被限制秩的是增量，而不是总权重。'}
  if(kind==='W'||kind==='base')return {title:'冻结的基座路径',expression:'h_base = W₀x',explanation:'W₀参与前向和向输入的梯度传播，但不累计参数梯度、不由优化器更新。灰色用于标记冻结参数。'}
 }
 if(id==='attention'){
  const q=[1,1,2,1],k=[1,0,1,2],val=[1,2,3,4],row=kind==='attention'?bounded(r,3):v.query,col=kind==='attention'?bounded(c,3):0,probs=softmax(k.map((x,j)=>v.causal&&j>row?-Infinity:q[row]*x))
  if(kind==='attention')return {title:`query ${row} → key ${col}`,expression:v.causal&&col>row?'未来位置：score + (−∞) → probability 0':`score=${q[row]}×${k[col]}=${q[row]*k[col]} → p=${n(probs[col])}`,explanation:`对同一query的可读key做softmax。这一项对输出贡献 ${n(probs[col])} × V[${col}]=${val[col]} → ${n(probs[col]*val[col])}。`}
  if(kind==='query'&&r>=0&&r<4)return {title:`跟随 query ${r}`,expression:`Q[${r}]=${q[r]}，h=${n(dot(probs,val))}`,explanation:'点选query后，注意力热图、可读位置、连线宽度与加权输出同步更新。标签mask不改变这些注意力权重。'}
 }
 if(id==='softmax'){
  const z=[v.z,1,0],prob=softmax(z),i=bounded(r,2),g=prob[i]-Number(i===v.target)
  if(['logit','exp','prob'].includes(kind))return {title:`类别 ${i} 的完整路径`,expression:`p=${n(prob[i])}，target=${Number(i===v.target)}，∂L/∂z=${n(g)}`,explanation:`一次SGD将z[${i}]从${n(z[i])}更新到${n(z[i]-v.lr*g)}。其它类别也会影响softmax分母，因此目标loss与整个词表耦合。`}
  if(kind==='loss'){const current=z.map((x,j)=>x-v.lr*(prob[j]-Number(j===v.target))*smooth(time-3)),p=softmax(current);return {title:'当前目标 token 的负对数似然',expression:`−log(${n(p[v.target])}) = ${n(ce(current,v.target))}`,explanation:'这不是把每个错误类别单独打分；log概率中的归一化分母让所有logits都收到梯度。反向箭头对应更新前的 p−one_hot。'}}
 }
 if(id==='nf4'){
  const w=[-.7,-.3,-.1,0,.2,.4,.6,v.outlier],d=quantize(w,!!v.uniform),i=kind==='weight'?bounded(r,7):v.index,book=v.uniform?Array.from({length:16},(_,j)=>-1+2*j/15):NF4
  if(kind==='code'&&r>=0&&r<16)return {title:`码字 ${r}: ${r.toString(2).padStart(4,'0')}`,expression:`c[${r}] = ${n(book[r])}`,explanation:'4bit存的是16个索引中的一个。NF4在零附近布置较密的格点，码字不是直接参与矩阵乘法的浮点值。'}
  return {title:`追踪权重 w[${i}]`,expression:`${n(w[i])} ÷ ${n(d.scale)} → code ${d.codes[i]} → ${n(d.restored[i])}`,explanation:`反量化误差为 ${n(d.errors[i])}。同块离群值改变scale后，其它权重的归一化位置也会移动；改变码本或离群值即可对照。`}
 }
 if(id==='preference'){
  const d=preference(v.margin,v.mode?v.reference:0,v.mode?v.beta:1)
  return {title:kind==='reference'?'为什么减去参考差值':'偏好差值的导数',expression:`z=${n(d.z)}，P=${n(d.p)}，dL/dmargin=${n(d.gradient)}`,explanation:kind==='reference'?'当前策略和参考策略有相同偏好差时，z=0，偏好概率为0.5。这里比较的是相对参考的改变。':'正 margin 很大时，偏好损失的梯度减弱；负 margin 很大时，dL/dmargin 接近 −β。梯度下降会提高 chosen 相对 rejected 的优势。金色切线表示 sigmoid 本身的局部斜率，须与 loss 的导数区分。'}
 }
 if(id==='bootstrap'&&kind==='pair'&&r>=0&&r<8){const a=[1,1,0,1,0,1,0,0],b=[1,1,1,0,1,1,0,1];return {title:`样例 #${r} 是一个抽样单元`,expression:`base=${a[r]}，new=${b[r]}，Δ=${b[r]-a[r]}`,explanation:'重采样时，这两个分数始终一起被抽走。不能给两个模型分别抽索引，否则会破坏样例难度的配对关系。'}}
 if(id==='chain'&&['token','nll'].includes(kind)){
  const probs=[.6,v.p,.9],i=bounded(kind==='token'?r-1:r,2)
  return {title:`第 ${i+1} 个目标的条件概率`,expression:`p=${n(probs[i])}，−log p=${n(-Math.log(probs[i]))}`,explanation:'条件中包含输入和真实的前缀。整条回答的概率是这些条件概率的乘积；取负对数后，各 token 的损失变成可相加的量。'}
 }
 if(id==='policy'){
  const rewards=v.group===0?[0,0,1,1]:Array(4).fill(v.group===1?1:0),mean=sum(rewards)/4,sd=Math.sqrt(sum(rewards.map(x=>(x-mean)**2))/4),i=['sample','advantage'].includes(kind)?bounded(r,3):v.sample,adv=(rewards[i]-mean)/(sd+1e-8),clipped=Math.max(1-v.epsilon,Math.min(1+v.epsilon,v.ratio))
  return time<3?{title:`回答 ${i} 的相对优势`,expression:`A=(${rewards[i]}−${n(mean)})/(${n(sd)}+ε)=${n(adv)}`,explanation:`两条候选更新是 ρA=${n(v.ratio*adv)} 与 clip(ρ)A=${n(clipped*adv)}。取较小者，限制超出信任区间后继续提高目标的收益；优势符号会改变生效的一侧。`}:fallback
 }
 if(id==='backprop'){
  const y=v.b*v.a*2,e=y-4
  const expressions:Record<string,string>={input:'x=2',a:`∂L/∂a=${v.detach?'无路径':n(e*v.b*2)}`,h:`h=2a=${n(v.a*2)}；∂L/∂h=${v.detach?'无路径':n(e*v.b)}`,b:`∂ŷ/∂h=b=${n(v.b)}`, 'squared-loss':`ŷ=${n(y)}；L=½(ŷ−4)²=${n(e*e/2)}`}
  if(expressions[kind])return {title:kind==='b'?'冻结参数与切断路径的区别':`追踪 ${kind}`,expression:expressions[kind],explanation:kind==='b'?'冻结 b 只停止它的参数更新；局部导数 b 仍将误差信号乘回 h。detach 则移除上游的连接。':'从输出开始，将每条边的局部导数相乘。这里最终得到 (ŷ−4)×b×2；打开 detach 后，这条路径中断。'}
 }
 if(id==='accumulation')return {title:'一个 token 在整个累积窗口中的权重',expression:`N=${2+v.n}；G=(2×1+${v.n}×3)/${2+v.n}=${n((2+v.n*3)/(2+v.n))}`,explanation:kind==='gradient-token'?`这一个 token 的梯度贡献为 ${n((r===0?1:3)/(2+v.n))}。累积时不按 microbatch 的数量重新平均。`:'每个有效 token 先按同一个总数 N 归一化，梯度相加后再执行一次 optimizer.step。'}
 if(id==='optimizer'){
  const row=adamTrajectory(v.lr,v.clip,v.decay)[Math.min(7,Math.floor(time))]
  return {title:'同一次 AdamW 更新的数值路径',expression:`g=${n(row.raw)} → clip ${n(row.g)}；m̂=${n(row.mh)}，v̂=${n(row.vh)}`,explanation:`w=${n(row.before)} 先接受自适应更新和独立的权重衰减，得到 ${n(row.w)}。曲线上的紫点保留每次已完成的迭代；金色标记沿真实数值轨迹移动。`}
 }
 if(id==='loragrad'){
  const i=Math.min(2,Math.floor(time/2));let A=v.zero?0:.5,B=0
  for(let k=0;k<i;k++){const e=2*A*B-1,da=e*B*2,db=e*A*2;A-=v.lr*da;B-=v.lr*db}
  const e=2*A*B-1
  return {title:kind==='init-A'?'A 的梯度从 B 传来':'B 的梯度需要非零的 Ax',expression:kind==='init-A'?`gA=(${n(e)})×${n(B)}×2=${n(e*B*2)}`:`gB=(${n(e)})×${n(A)}×2=${n(e*A*2)}`,explanation:'数值是本次更新前计算的梯度。播放时两因子同时按这份梯度更新，然后重新前向；不能用刚更新的 B 去计算同一次更新的 A 梯度。'}
 }
 if(id==='doublequant'){
  const scales=[.8,1,v.scale,2],offset=sum(scales)/4,s=Math.max(...scales.map(x=>Math.abs(x-offset))),i=bounded(r,3),q=Math.round(((scales[i]-offset)/s+1)*127.5),restored=(q/127.5-1)*s+offset
  return {title:kind==='scale-one'?`第一层 scale ${i} 的恢复`:'两层量化的依赖关系',expression:`scale=${n(scales[i])} → q₂=${q} → ŝ=${n(restored)}`,explanation:`先恢复 scale：offset + scale₂×(q₂/127.5−1)，再用这个 ŝ 解开第一层权重。这里二级采用中心化均匀8bit教学码本，非 bitsandbytes 内核逐位实现。`}
 }
 if(id==='checkpoint'&&kind==='activation')return {title:`激活 h${bounded(r,4)} 的生命周期`,expression:frame.values[bounded(r,4)]?'当前驻留，可供后续计算读取':'当前没有保存，需要边界或重算提供',explanation:frame.explain+' 灰色表示当前不在保存集合中；金色连线表示重算，而不是优化器更新。'}
 if(id==='metrics'){
  const truth=[0,0,1,1,2,2],pred=[0,0,1,0,2,v.prediction],d=classification(truth,pred)
  if(kind==='example'){const i=bounded(r,5);return {title:`样例 ${i} → 一个矩阵单元`,expression:`truth=${truth[i]}，prediction=${pred[i]<0?'invalid':pred[i]}`,explanation:'无效 JSON 也必须保留在评估分母。它对真值类别贡献一个 FN，不是直接删掉这条困难样例。'}}
  if(kind==='confusion'){const row=bounded(r,2),col=bounded(c,3);return {title:`混淆矩阵 [${row},${col}]`,expression:`count=${d.matrix[row][col]}`,explanation:row===col?'对这个类别，这个单元是 TP；其它行在本列的计数是 FP。':`对真值类别 ${row} 是 FN。${col===3?'invalid 列不作为第四个正常类别参与 macro 平均。':`对预测类别 ${col} 同时是 FP。`}`}}
 }
 if(id==='bootstrap'){
  const a=[1,1,0,1,0,1,0,0],b=[1,1,1,0,1,1,0,1],d=bootstrap(a,b,v.seed),sample=d.samples[Math.min(2,Math.max(0,Math.floor(time)-1))]
  if(kind==='resample'){const i=bounded(r,7),source=sample.indices[i];return {title:`第 ${i} 个抽样位置`,expression:`来自 #${source} → base=${a[source]}, new=${b[source]}`,explanation:'有放回意味着同一个原样例可以贡献多次；两个模型始终共用这个索引。对这组八个配对差值取均值，得到一次重采样统计量。'}}
  if(kind==='histogram')return {title:'一次抽样对应直方图中的一次计数',expression:`分差 Δ=${n(-1+bounded(r,16)/8)}`,explanation:'金线是原始八条样例上的观察差值，紫色区间来自200次配对重采样。它描述这组样例的抽样不确定性；不能修复数据偏差。'}
 }

 return fallback
}
