'use client'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { softmax } from './math'
import { NumericLab } from './study-labs'
import { defaults, pocketForward, traceStages, words, type Settings, type Stage } from './pocket-model'
import type { Lesson } from './reader-lessons'
import c from './reader.module.css'

type StateProps = { settings: Settings; update: Dispatch<SetStateAction<Settings>> }
const number = (n: number) => Number.isFinite(n) ? n.toFixed(3) : '−∞'
const vector = (x: number[]) => '(' + x.map(number).join(', ') + ')'
const note = {
  x:'嵌入表的这一行，加上同位置的偏移。', n:'对这个位置的三个坐标求均值、减均值、除以标准差。',
  q:'从归一化后的 (a,b,c) 中取 (a,b)。', k:'从归一化后的 (a,b,c) 中取 (b,a)。', v:'从归一化后的 (a,b,c) 中取 (a,c)。',
  scores:'用行位置的查询与列位置的键做点积，再缩放和遮罩。', weights:'只沿本行做 softmax，各可见列权重之和为 1。',
  context:'用本行的读取比例，加权汇总全部位置对应的 V 坐标。', u:'把读回的 (a,b) 投影成 (a,0,b)，再加回本行输入。',
  hidden:'先归一化第一条残差的结果，把 (a,b,c) 变成 (a−c,b)。', active:'开启 ReLU 时只保留大于零的部分。',
  y:'将激活后的 (a,b) 投影为 (a/2,0,b/2)，加回第一条残差的输出。',
  final:'对第二条残差的输出做最终 LayerNorm。', logits:'这里输出矩阵为单位矩阵，第三个词另加一个可调整的偏置。',
  prob:'沿词表做 softmax，选中的格子是下一词为该列词元的概率。',
}
const switches = [['position','位置编码'],['scaled','平方根缩放'],['causal','因果遮罩'],['nonlinear','ReLU']] as const

export function Trace({ lesson, settings, update }: StateProps & { lesson: Lesson }) {
  const [stage, setStage] = useState<Stage>(lesson.stage)
  const [row, setRow] = useState(1)
  const [column, setColumn] = useState(lesson.stage === 'prob' ? 2 : 0)
  const [playing, setPlaying] = useState(false)
  const trace = pocketForward(settings)
  const table = trace[stage]
  const col = Math.min(column, table[0].length - 1)
  const index = traceStages.findIndex(([id]) => id === stage)
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      if (index < traceStages.length - 1) setStage(traceStages[index + 1][0])
      else setPlaying(false)
    }, 1700)
    return () => clearTimeout(timer)
  }, [index, playing])
  const wordAxis = stage === 'logits' || stage === 'prob'
  const positionAxis = stage === 'scores' || stage === 'weights'
  const columnName = (i: number) => wordAxis ? words[i] : positionAxis ? words[settings.tokens[i]] + ' · ' + i : '坐标 ' + (i + 1)
  let detail = note[stage]
  if (stage === 'scores') {
    detail = !Number.isFinite(table[row][col]) ? '列位置晚于行位置，因果遮罩把这一格设为 −∞。' :
      'Q = ' + vector(trace.q[row]) + '，K = ' + vector(trace.k[col]) + '。逐项相乘并相加' + (settings.scaled ? '，再除以 √2。' : '，本次关闭了缩放。')
  } else if (stage === 'context') {
    detail = trace.weights[row].map((w, i) => number(w) + ' × ' + number(trace.v[i][col])).join(' + ') + ' ≈ ' + number(table[row][col])
  } else if (stage === 'weights' || stage === 'prob') {
    detail = '本行' + (wordAxis ? '词表分数 ' : '匹配分数 ') + vector((wordAxis ? trace.logits : trace.scores)[row]) + '，归一化后得到 ' + vector(table[row]) + '。'
  }
  return <section className={c.trace} aria-label="三词模型计算台">
    <div className={c.traceTop}><div><small>可操作的计算台</small><h3>追踪一个数的来历</h3></div><button onClick={() => { update({...defaults}); setStage(lesson.stage); setColumn(lesson.stage === 'prob' ? 2 : 0); setRow(1); setPlaying(false) }}>恢复初始值</button></div>
    <p className={c.traceTask}>{lesson.action}</p>
    <div className={c.traceControls}><label>观察哪一步<select value={stage} onChange={e => { setStage(e.target.value as Stage); setPlaying(false) }}>{traceStages.map(([key, title], i) => <option key={key} value={key}>{i+1} · {title}</option>)}</select></label><button aria-pressed={playing} onClick={() => { if (!playing && index === traceStages.length - 1) setStage('x'); setPlaying(!playing) }}>{playing ? '暂停演示' : '逐步播放'}</button></div>
    <div className={c.matrixWrap}><table className={c.matrix}><caption>{traceStages[index][1]} · {table.length} 行 × {table[0].length} 列</caption><thead><tr><th scope="col">位置</th>{table[0].map((_, j) => <th scope="col" key={j}>{columnName(j)}</th>)}</tr></thead><tbody>{table.map((values, i) => <tr key={i}><th scope="row">{words[settings.tokens[i]]} <small>{i}</small></th>{values.map((value, j) => <td key={j}><button aria-label={`位置 ${i}，${columnName(j)}，${number(value)}`} aria-pressed={row === i && col === j} onClick={() => { setRow(i); setColumn(j); setPlaying(false) }}>{number(value)}</button></td>)}</tr>)}</tbody></table></div>
    <div className={c.cellNote} aria-live={playing ? 'off' : 'polite'}><b>{words[settings.tokens[row]]} · {columnName(col)} = {number(table[row][col])}</b><p>{detail}</p></div>
    <div className={c.tokens}>{settings.tokens.map((id, i) => <label key={i}>位置 {i}<select aria-label={'位置 '+i+' 的词元'} value={id} onChange={e => update(s => ({...s, tokens:s.tokens.map((old, j) => i === j ? Number(e.target.value) : old)}))}>{words.map((word, j) => <option key={word} value={j}>{word}</option>)}</select></label>)}</div>
    <div className={c.switches}>{switches.map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={() => update(s => ({ ...s, [key]:!s[key] }))}/>{label}</label>)}</div>
    <details className={c.weights}><summary>模型参数与读数精度</summary><p>三个位置、三维主干、一层、一头。词表依次为猫、追、鱼。嵌入表三行为 (1,0,−1)、(0,1,−1)、(−1,0,1)。位置表为 (0,0,0)、(0,0.5,0)、(0,−0.5,0)。</p><p>三次 LN 均取 γ=1、β=0、ε=10⁻⁵。Q、K、V 及前馈层的所有系数写在对应步骤的格子说明里。初始输出偏置全零；当前鱼偏置 {number(settings.fishBias)}。全程按浮点数计算，面板保留三位小数。</p></details>
  </section>
}

function Slider({label, value, max, step=1, change}:{label:string; value:number; max:number; step?:number; change:(n:number)=>void}) {
  return <label className={c.slider}>{label}<output>{value}</output><input aria-label={label} type="range" min={0} max={max} step={step} value={value} onChange={e => change(Number(e.target.value))}/></label>
}

function Train({settings, update}:StateProps) {
  const [rate, setRate] = useState(0.5)
  const [last, setLast] = useState('')
  const p = pocketForward(settings).prob[1][2]
  const loss = -Math.log(p)
  return <section className={c.experiment}><h3>沿损失曲线走一步</h3><p>固定训练目标为「鱼」，用位置 1 的预测。只更新输出偏置 b鱼，其他参数与计算台同步。横轴是偏置，纵轴是损失。</p>
    <svg viewBox="0 0 350 125" role="img" aria-label={'当前交叉熵 '+number(loss)}><path d="M15 8V106H335" stroke="#b8c7da" fill="none"/>{(() => {
      const left=settings.fishBias-2
      const at=(b:number)=>Math.log1p((1/p-1)*Math.exp(settings.fishBias-b))
      const height=(v:number)=>103-88*v/Math.max(at(left),0.001)
      return <><path d={Array.from({length:81},(_,i)=>(i?'L':'M')+(20+i*3.85)+' '+height(at(left+i/20))).join(' ')} fill="none" stroke="#5671d2" strokeWidth="3"/><circle cx="174" cy={height(loss)} r="6" fill="#db754d"/><text x="16" y="121">{number(left)}</text><text x="273" y="121">{number(left+4)}</text></>
    })()}</svg>
    <div className={c.readings}><span>b鱼 <b>{number(settings.fishBias)}</b></span><span>p鱼 <b>{number(p)}</b></span><span>损失 <b>{number(loss)}</b></span><span>梯度 <b>{number(p-1)}</b></span></div>
    <Slider label="学习率" max={2} step={0.1} value={rate} change={setRate}/><button onClick={() => { const next = {...settings,fishBias:settings.fishBias-rate*(p-1)}; update(next); setLast('这一步损失从 '+number(loss)+' 变为 '+number(-Math.log(pocketForward(next).prob[1][2]))+'。') }}>更新一次参数</button><p role="status">{last}</p></section>
}

function Heads() {
  const [a, setA] = useState(0.25), [b, setB] = useState(0.75)
  const first=2*a+6*(1-a), second=2*b+6*(1-b)
  return <section className={c.experiment}><h3>两头能留下哪些不同的信息？</h3><p>两个来源分别提供数值 2 和 6。拖动各头分给第一个来源的比例；其余份额自动给第二个来源。</p>
    {[a,b].map((ratio,i)=><div key={i}><Slider label={'头 '+(i+1)+' 对来源一的权重'} max={1} step={0.05} value={ratio} change={i?setB:setA}/><div className={c.mixBar}><i style={{width:100*ratio+'%'}}/></div></div>)}
    <div className={c.readings}><span>并排保留 <b>{vector([first,second])}</b></span><span>投影取和 <b>{number(first+second)}</b></span><span>投影取差 <b>{number(first-second)}</b></span></div></section>
}
function Cross() {
  const [mode,setMode]=useState<'cross'|'self'>('cross'), [row,setRow]=useState(1)
  const keys= mode==='cross' ? [[1,0],[0,1],[-1,0]] : [[1,0],[0,1]]
  const query=[[1,0],[0,1]][row], labels=mode==='cross'?['cats','chase','fish']:['开始','猫']
  const probs=softmax(keys.map(([a,b],i)=>mode==='self' && i>row ? -Infinity : (a*query[0]+b*query[1])/Math.sqrt(2)))
  return <section className={c.experiment}><h3>译文的查询可以看哪里？</h3><p>给两个目标位置的查询分别取 (1,0)、(0,1)。源键依次为 (1,0)、(0,1)、(−1,0)，目标键用前两行。点一个查询，观察本行实际算出的权重。</p>
    <div className={c.choices}>{(['cross','self'] as const).map(k=><button key={k} aria-pressed={mode===k} onClick={()=>setMode(k)}>{k==='cross'?'查询原文':'读取译文前缀'}</button>)}</div>
    <div className={c.choices}>{['开始','猫'].map((word,i)=><button key={word} aria-pressed={row===i} onClick={()=>setRow(i)}>目标查询 · {word}</button>)}</div>
    {labels.map((word,i)=><div key={word} className={c.dist}><span>{word}</span><i><b style={{width:100*probs[i]+'%'}}/></i><output>{number(probs[i])}</output></div>)}
  </section>
}
function Cache() {
  const [length,setLength]=useState(3)
  return <section className={c.experiment}><h3>追加一个词，观察新增的一行</h3><p>行是查询，列是键。灰色格表示旧位置已完成的匹配，蓝色格是新查询要算的匹配。空格受到因果遮罩。</p>
    <div className={c.cacheGrid} style={{gridTemplateColumns:`repeat(${length},1fr)`}}>{Array.from({length:length*length},(_,i)=>{const r=Math.floor(i/length),j=i%length;return <i key={i} data-kind={j>r?'empty':r===length-1?'new':'old'}>{j>r?'·':r===length-1?'＋':'✓'}</i>})}</div>
    <div className={c.choices}><button onClick={()=>setLength(n=>n+1)} disabled={length===8}>追加一个词</button><button onClick={()=>setLength(2)}>回到两词前缀</button></div><p role="status">长度 {length}。整张稠密表有 {length*length} 格，其中 {length*(length+1)/2} 格合法。有缓存时只需新算 {length} 个点积。</p></section>
}
function Rotary() {
  const [q,setQ]=useState(1),[k,setK]=useState(3)
  const point=(pos:number)=>[120+68*Math.cos(pos*Math.PI/6),87-68*Math.sin(pos*Math.PI/6)]
  return <section className={c.experiment}><h3>把相对位置转成夹角</h3><p>两支内容向量起初都指向 (1,0)，每个位置转 30°。蓝色为 Q，橙色为 K。</p><svg viewBox="0 0 240 174" role="img" aria-label={'位置差 '+(k-q)+'，点积 '+number(Math.cos((k-q)*Math.PI/6))}><circle cx="120" cy="87" r="68" stroke="#c2cbdd" fill="none"/><path d="M41 87h158M120 10v154" stroke="#d7ddea"/>{[q,k].map((n,i)=>{const [x,y]=point(n);return <g key={i} stroke={i?'#cb7344':'#4865b9'}><path d={`M120 87L${x} ${y}`} strokeWidth={i?3:5}/><circle cx={x} cy={y} r={i?3:5} fill={i?'#cb7344':'#4865b9'}/></g>})}</svg>
    <div className={c.choices}><button onClick={()=>{setQ(q+1);setK(k+1)}}>两者一起后移</button><button onClick={()=>setK(k+1)}>只后移键</button><button onClick={()=>{setQ(1);setK(3)}}>复位</button></div><p role="status">查询位置 {q}，键位置 {k}，相对转角 {(k-q)*30}°，点积 {number(Math.cos((k-q)*Math.PI/6))}。</p></section>
}
export function Experiment({lesson,settings,update}:StateProps & {lesson:Lesson}) {
  switch(lesson.lab) {
    case undefined:return null
    case 'train':return <Train settings={settings} update={update}/>
    case 'cross':return <Cross/>
    case 'heads':return <Heads/>
    case 'rope':return <Rotary/>
    case 'cache':return <Cache/>
    default:return <NumericLab kind={lesson.lab} onObserve={()=>{}}/>
  }
}
