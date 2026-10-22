'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Box, ChevronRight, Code2, RotateCw, Pause, Play, Plus, Minus, X, Route, Check, BookOpen } from 'lucide-react'
import type { Concept, Explorer, Selection, Snapshot } from '@/lib/transformer-viz/bridge'
import { TOPICS, HINTS } from './model-content'
import { ModelOverview } from './model-overview'
import { MathStudy } from './math-study'
import { attention, fixtures, gradeRun, softmax, type AttentionOutput } from './math'
import { usePython } from './use-python'
import s from './model-explorer.module.css'

type Event = {id:string;at:string;node:Concept;kind:'explore'|'answer'|'code'|'hint'|'experiment'|'environment';pass?:boolean;assisted?:boolean;detail:string}
type Result = {code:string;pass:boolean;text:string;assisted:boolean}
type Notebook = {version:1;codes:Partial<Record<Concept,string>>;results:Partial<Record<Concept,Result>>;answers:Partial<Record<Concept,number>>;hints:Partial<Record<Concept,boolean>>;events:Event[]}
const empty:Notebook = {version:1,codes:{},results:{},answers:{},hints:{},events:[]}
const initial:Snapshot={time:0,duration:0,running:false,concept:null,tokens:[2,1,0,1,1,2],probabilities:[],selection:null}
const key=()=> 'transformer-model-notebook-v1'+(new URLSearchParams(location.search).has('practice')?'-practice':'')
function valid(v:unknown):v is Notebook {
 if(!v || typeof v!=='object')return false
 const n=v as Notebook,ids=TOPICS.map(t=>t.id)
 return n.version===1 && !!n.codes && !!n.results && !!n.answers && !!n.hints && Array.isArray(n.events) && n.events.length<=600 && n.events.every(e=>e && ids.includes(e.node)&&typeof e.kind==='string'&&typeof e.detail==='string') && Object.values(n.codes).every(x=>typeof x==='string'&&x.length<=20000) && Object.values(n.results).every(r=>r&&typeof r.code==='string'&&typeof r.pass==='boolean'&&typeof r.text==='string')
}
export function TransformerModelExplorer(){
 const canvas=useRef<HTMLCanvasElement>(null),panel=useRef<HTMLElement>(null),pendingConcept=useRef<Concept|null>(null)
 const [overview,setOverview]=useState(true),[hasOpened,setHasOpened]=useState(false)
 const [study,setStudy]=useState<Concept|null>(null),[lastStudy,setLastStudy]=useState<Concept>('embedding')
 const [controller,setController]=useState<Explorer|null>(null)
 const [snapshot,setSnapshot]=useState(initial),[status,setStatus]=useState('正在加载 3D 模型与训练权重…'),[error,setError]=useState('')
 const [selected,setSelected]=useState<Concept|null>(null),[cell,setCell]=useState<Selection|null>(null),[report,setReport]=useState(false)
 const [notebook,setNotebook]=useState<Notebook>(empty),[restored,setRestored]=useState(false),[storageError,setStorageError]=useState('')
 const [input,setInput]=useState('CBABBC'),[inputError,setInputError]=useState(''),[layer,setLayer]=useState(0),[head,setHead]=useState(0)
 const [experiment,setExperiment]=useState(1),[geluX,setGeluX]=useState(1),[codeTrace,setCodeTrace]=useState<{data:AttentionOutput;context:string}|null>(null),[runningNode,setRunningNode]=useState<Concept|null>(null)
 const python=usePython(),topic=TOPICS.find(t=>t.id===selected)
 const log=useCallback((node:Concept,kind:Event['kind'],detail:string,pass?:boolean,assisted=false)=>{
  setNotebook(n=>({...n,events:[...n.events,{id:crypto.randomUUID(),at:new Date().toISOString(),node,kind,detail,pass,assisted}].slice(-600)}))
 },[])
 useEffect(()=>{
  let alive=true;queueMicrotask(()=>{if(!alive)return
  try{const raw=localStorage.getItem(key());if(raw){const value=JSON.parse(raw);if(valid(value))setNotebook(value);else setStorageError('已有记录格式不兼容，本次记录暂不覆盖它。')}}catch{setStorageError('无法恢复本地记录；本次操作仍可继续。')}
  setRestored(true)
  });return()=>{alive=false}
 },[])
 useEffect(()=>{if(restored&&!storageError){try{localStorage.setItem(key(),JSON.stringify(notebook))}catch{queueMicrotask(()=>setStorageError('浏览器无法保存记录；请保持当前页面打开。'))}}},[notebook,restored,storageError])
 useEffect(()=>{
  if(!hasOpened)return
  let stopped=false,instance:Explorer|undefined
  const abort=new AbortController()
  import('@/lib/transformer-viz/bridge').then(({createExplorer})=>createExplorer(canvas.current!,setSnapshot,(pick)=>{
    panel.current?.scrollTo({top:0});setSelected(pick.concept);setCell(pick);setReport(false);setExperiment(1);setCodeTrace(null);log(pick.concept,'explore',`点击模型：${pick.name} [${pick.index.join(', ')}]`)
  },abort.signal)).then(result=>{instance=result;if(stopped)result.destroy();else{setController(result);if(pendingConcept.current)result.focus(pendingConcept.current);setStatus('模型已就绪 · 浏览器本地推理')}}).catch(e=>{if(!stopped){setError(String(e));setStatus('模型未能加载')}})
  return()=>{stopped=true;abort.abort();instance?.destroy();}
 },[log,hasOpened])
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{if(overview)document.getElementById('overview-title')?.focus({preventScroll:true});else if(study)document.getElementById('study-title')?.focus({preventScroll:true});else panel.current?.focus({preventScroll:true})})
  return()=>cancelAnimationFrame(frame)
 },[overview,study])
 const openStudy=(id:Concept)=>{controller?.scrub(snapshot.time);setStudy(id);setLastStudy(id);setOverview(false);setReport(false);window.scrollTo({top:0})}
 const backToOverview=()=>{controller?.scrub(snapshot.time);setStudy(null);setOverview(true);window.scrollTo({top:0})}
 const choose=(id:Concept)=>{setStudy(null);pendingConcept.current=id;setOverview(false);setHasOpened(true);window.scrollTo({top:0});panel.current?.scrollTo({top:0});setSelected(id);setCell(null);setReport(false);setExperiment(1);setCodeTrace(null);controller?.focus(id);log(id,'explore','定位模型部件')}
 const currentCode=topic?(notebook.codes[topic.id]??topic.starter):''
 const answer=topic?notebook.answers[topic.id]:undefined,result=topic?notebook.results[topic.id]:undefined
 const passed=TOPICS.filter(t=>notebook.answers[t.id]===t.answer&&notebook.results[t.id]?.pass&&notebook.results[t.id]?.code===(notebook.codes[t.id]??t.starter))
 const independent=passed.filter(t=>!notebook.results[t.id]?.assisted)
 const liveInput=controller?.attentionInput(layer,head)
 const realWeights=controller?.attentionWeights(layer,head)??[]
 const tempWeights=liveInput?attention(liveInput).weights.map(row=>softmax(row.map(x=>x>0?Math.log(x)/experiment:-Infinity))):[]
 const probability=softmax(snapshot.probabilities.map(x=>x>0?Math.log(x)/experiment:-Infinity))
 function runCode(){
  if(!topic||!controller)return
  const node=topic.id,code=currentCode,assisted=!!notebook.hints[node]
  setRunningNode(node);setCodeTrace(null)
  function environmentFailure(text:string){setNotebook(n=>({...n,results:{...n.results,[node]:{code,pass:false,text,assisted}}}));log(node,'environment',text);setRunningNode(null)}
  function finish(pass:boolean,text:string){setNotebook(n=>({...n,results:{...n.results,[node]:{code,pass,text,assisted}}}));log(node,'code',text,pass,assisted);setRunningNode(null)}
  if(node==='attention'){
   const cases=[controller.attentionInput(layer,head),...fixtures(20261022)]
   python.run(code,cases,r=>{const graded=gradeRun(cases,r.raw);const ok=!r.error&&graded.checks.every(c=>c.pass);finish(ok,(r.error?r.error+'\n':'')+graded.checks.map(c=>(c.pass?'✓ ':'✗ ')+c.label+' · '+c.detail).join('\n')+'\n'+r.stdout);if(Array.isArray(r.raw)&&r.raw[0]?.weights&&graded.checks[0]?.pass)setCodeTrace({data:r.raw[0],context:JSON.stringify(cases[0])})},environmentFailure)
  }else{
   python.runScript(code+'\n\n# 本节点行为检查\n'+topic.tests,r=>finish(!r.error&&!!(r.raw as {ok?:boolean})?.ok,r.error??r.stdout),environmentFailure)
  }
 }
 const progress=passed.length/8
 return <main className={s.app}>
  <header className={s.header}><a href='/standalone/transformer-lab' onClick={e=>{e.preventDefault();backToOverview()}} className={s.brand}><Box size={23}/><span>TRANSFORMER<span className={s.brandSmall}>MODEL EXPLORER</span></span></a><div className={s.identity}>{overview?'从结构总览，走进模型内部':study?'从数学基础逐步走进模型':'结构总览 / '+(topic?.title??'3D 模型')}<span>minGPT · 3 blocks · 3 heads · d = 48</span></div>{!overview&&<button className={s.backOverview} onClick={backToOverview}><ArrowUpRight size={15}/>返回结构总览</button>}<button className={!overview&&report?s.activeButton:''} onClick={()=>{setStudy(null);setHasOpened(true);setOverview(false);setReport(r=>overview||!r);panel.current?.scrollTo({top:0});window.scrollTo({top:0})}}><Route size={17}/>学习轨迹<span className={s.count}>{passed.length}/8</span></button></header>
  <div hidden={!overview}><ModelOverview onOpen={openStudy} passed={passed.map(t=>t.id)} storageMessage={storageError||(restored?'学习记录保存在此浏览器 · 独立于原课程':'正在恢复记录…')}/></div>
  <div hidden={!study}><MathStudy id={study??lastStudy} onTopic={openStudy} onModel={choose} onOverview={backToOverview}/></div>
  {hasOpened&&<div className={s.workspace} hidden={overview||!!study}>
   <section className={s.stage} aria-label='可交互的 Transformer 三维模型'>
    <div className={s.inputBar}><div><span className={s.kicker}>INPUT SEQUENCE</span><div className={s.inputControls}><input aria-label='输入 A B C 序列' value={input} maxLength={6} onChange={e=>setInput(e.target.value.toUpperCase())}/><button disabled={!controller} onClick={()=>{try{controller?.input(input);setInputError('');setCodeTrace(null);setCell(null);if(selected)log(selected,'experiment','修改输入：'+input)}catch(e){setInputError(String(e))}}}>前向计算 <ArrowDownRight size={14}/></button><button disabled={!controller||snapshot.tokens.length>=11} onClick={()=>{controller?.step();setCodeTrace(null);setCell(null);log('output','experiment','greedy 生成下一词元')}}>生成下一词元</button></div></div><div className={s.taskLabel}>A / B / C 排序模型<span>真实激活 · 有效位置 {snapshot.tokens.length} / 11</span></div></div>
    {inputError&&<p role='alert' className={s.inputError}>{inputError}</p>}
    <canvas ref={canvas} className={s.canvas} aria-label='拖动平移，Shift 加拖动旋转，滚轮缩放。点击任意张量小格打开学习面板。也可使用模型部件按钮。'/>
    <div className={s.modelNavigator}><span className={s.kicker}>模型部件 · 点击定位</span>{TOPICS.map((t,i)=><button key={t.id} className={selected===t.id?s.navActive:''} onClick={()=>choose(t.id)} disabled={!controller} style={{'--node-color':t.color} as React.CSSProperties}><i/>{t.en}<span>{passed.some(p=>p.id===t.id)?<Check size={12}/>:String(i+1).padStart(2,'0')}</span></button>)}</div>
    <div className={s.viewControls}><button aria-label='缩小模型' onClick={()=>controller?.zoom(1.2)}><Minus size={16}/></button><button aria-label='放大模型' onClick={()=>controller?.zoom(1/1.2)}><Plus size={16}/></button><button aria-label='旋转模型' onClick={()=>controller?.rotate()}><RotateCw size={16}/></button><button onClick={()=>{controller?.overview();setSelected(null);setCell(null);setReport(false)}}>3D 全貌</button></div>
    {error?<div className={s.modelError} role='alert'><h2>3D 模型加载失败</h2><p>{error}</p><button onClick={()=>location.reload()}>重新加载</button><a href='https://bbycroft.net/llm' target='_blank' rel='noreferrer'>打开原始模型</a></div>:!controller&&<div className={s.loading}><Box size={36}/><p>{status}</p></div>}
    <div className={s.sequence}><span>当前序列</span>{snapshot.tokens.map((t,i)=><b key={i} className={i>=6?s.generated:''}>{'ABC'[t]}<small>{i}</small></b>)}<span className={s.nextArrow}>→</span>{snapshot.probabilities.map((p,i)=><span key={i} className={s.outputToken}>{'ABC'[i]} <strong>{(p*100).toFixed(1)}%</strong></span>)}</div>
    <div className={s.playback}><button disabled={!selected||!controller} aria-label={snapshot.running?'暂停演示':'播放部件演示'} onClick={()=>controller?.play()}>{snapshot.running?<Pause size={17}/>:<Play size={17}/>}</button><div className={s.timeline}><span>{topic?topic.en+' · 计算演示':'点击模型中的张量，从它开始探索'}<b>{snapshot.time.toFixed(1)} / {snapshot.duration.toFixed(1)}s</b></span><input aria-label='动画进度' type='range' min={0} max={Math.max(1,snapshot.duration)} step={.05} value={snapshot.time} disabled={!selected} onChange={e=>controller?.scrub(Number(e.target.value))}/></div><select aria-label='动画速度' defaultValue='1' onChange={e=>controller?.speed(Number(e.target.value))}><option value='.5'>0.5×</option><option value='1'>1×</option><option value='2'>2×</option><option value='4'>4×</option></select></div>
    <div className={s.stageFoot}><span>拖动平移 · Shift + 拖动旋转 · 滚轮缩放 · 点击格子检查数值</span><a href='https://github.com/bbycroft/llm-viz' target='_blank' rel='noreferrer'>3D engine © Brendan Bycroft · MIT <ArrowUpRight size={12}/></a></div>
   </section>
   <aside ref={panel} className={s.inspector} tabIndex={-1} aria-label={report?'学习轨迹':'模型学习面板'}>
    {report?<><div className={s.panelTop}><span className={s.kicker}>YOUR EXPLORATION</span><button aria-label='关闭学习轨迹' onClick={()=>setReport(false)}><X size={18}/></button></div><h1>你的模型地图</h1><p>按真实探索、作答与代码检查记录。打开部件不等于掌握概念。</p><div className={s.progressTrack}><i style={{width:progress*100+'%'}}/></div><h2>{independent.length===8?'本轮独立验收通过':passed.length===8?'练习通过，仍有提示辅助':'仍在建立理解'}</h2><p>已通过 {passed.length}/8 个部件的概念与代码检查；其中 {independent.length} 个未使用代码提示。这是本地练习记录。</p><div className={s.map}>{TOPICS.map(t=>{const seen=notebook.events.filter(e=>e.node===t.id),fail=seen.filter(e=>e.pass===false).length,ok=passed.some(p=>p.id===t.id);return <button key={t.id} onClick={()=>choose(t.id)} style={{'--node-color':t.color} as React.CSSProperties}><i>{ok?<Check size={15}/>:<Box size={15}/>}</i><div><strong>{t.title}</strong><span>{seen.length===0?'尚未探索':ok?'概念与代码已通过':notebook.answers[t.id]===t.answer?'概念已答对 · 代码待验证':'需要继续验证'}</span></div><small>{fail>0?fail+' 次待修正':seen.length+' 条记录'}</small></button>})}</div><h3>实际经过的路径</h3><div className={s.path}>{notebook.events.filter(e=>e.kind==='explore').slice(-16).map(e=><button key={e.id} onClick={()=>choose(e.node)}>{TOPICS.find(t=>t.id===e.node)?.en}<ChevronRight size={12}/></button>)}</div><h3>最近的过程证据</h3><div className={s.events}>{notebook.events.slice(-15).reverse().map(e=><details key={e.id}><summary><span>{e.pass===false?'待修正':e.pass===true?'通过':e.kind==='hint'?'提示':'探索'}</span> {TOPICS.find(t=>t.id===e.node)?.title}<small>{new Date(e.at).toLocaleTimeString('zh-CN')}</small></summary><pre>{e.detail}</pre></details>)}</div><a className={s.projectLink} href='/standalone/transformer-lab/attention-project.zip'>课后项目：实现因果注意力 <ArrowDownRight size={16}/></a><p className={s.fine}>项目要求 Python 3.12、NumPy 2.0.2；包含测试、目录约定和 Git 管理说明。</p></>:topic?<>
      <div className={s.panelTop}><span className={s.kicker}>INSIDE THE MODEL</span><span className={s.topicIndex}>{String(TOPICS.indexOf(topic)+1).padStart(2,'0')} / 08</span></div><h1>{topic.title}</h1><div className={s.enTitle} style={{color:topic.color}}>{topic.en}</div>
      {cell&&<div className={s.cellInfo}><span>你点中的格子 · {cell.name}</span><b>{cell.value===null?'该格没有可读值':Number.isFinite(cell.value)?cell.value.toFixed(6):String(cell.value)}</b><small>索引 [{cell.index.join(', ')}] · 图形网格 {cell.shape.join(' × ')}（不是 PyTorch 轴顺序）</small></div>}
      <div className={s.formula}>{topic.formula}</div><button className={s.mathDeepen} onClick={()=>openStudy(topic.id)}><BookOpen size={16}/>逐项读公式 · 回补数学基础<ArrowUpRight size={14}/></button><div className={s.observe}><Play size={16}/><p>{topic.observe}</p><button onClick={()=>{controller?.focus(topic.id);controller?.play()}}>播放此过程</button></div>
      {topic.explanation.map((p,i)=><p key={i}>{p}</p>)}
      {(topic.id==='attention'||topic.id==='softmax'||topic.id==='projection')&&<section className={s.experiment}><div className={s.sectionHeading}><h3>当前模型的注意力</h3><span>真实激活</span></div><div className={s.selectors}><label>Block<select value={layer} onChange={e=>{setLayer(Number(e.target.value));setCodeTrace(null)}}>{[0,1,2].map(i=><option key={i} value={i}>{i+1}</option>)}</select></label><label>Head<select value={head} onChange={e=>{setHead(Number(e.target.value));setCodeTrace(null)}}>{[0,1,2].map(i=><option key={i} value={i}>{i+1}</option>)}</select></label></div><Heatmap rows={realWeights} tokens={snapshot.tokens}/>{topic.id==='softmax'&&<><label className={s.sliderLabel}>观察温度 τ <b>{experiment.toFixed(2)}</b><input aria-label='注意力观察温度' type='range' min='.15' max='3' step='.05' value={experiment} onChange={e=>setExperiment(Number(e.target.value))} onPointerUp={()=>log('softmax','experiment','观察温度 '+experiment)}/></label><Heatmap rows={tempWeights} tokens={snapshot.tokens}/><p className={s.fine}>下图是温度干预实验；上图和 3D 模型仍保留原计算。行：query；列：key。</p></>}</section>}
      {topic.id==='mlp'&&<section className={s.experiment}><h3>检查非线性门控</h3><GeluPlot x={geluX}/><label className={s.sliderLabel}>输入 x <b>{geluX.toFixed(2)}</b><input aria-label='GELU 输入' type='range' min='-4' max='4' step='.05' value={geluX} onChange={e=>setGeluX(Number(e.target.value))} onPointerUp={()=>log('mlp','experiment','GELU 输入 '+geluX)}/></label></section>}
      {topic.id==='output'&&<section className={s.experiment}><h3>改变分布的尖锐程度</h3><label className={s.sliderLabel}>温度 τ <b>{experiment.toFixed(2)}</b><input aria-label='输出观察温度' type='range' min='.15' max='3' step='.05' value={experiment} onChange={e=>setExperiment(Number(e.target.value))} onPointerUp={()=>log('output','experiment','输出观察温度 '+experiment)}/></label>{probability.map((p,i)=><div className={s.probability} key={i}><span>{'ABC'[i]}</span><div><i style={{width:p*100+'%'}}/></div><b>{(p*100).toFixed(2)}%</b></div>)}<p className={s.fine}>这是温度实验，不改变顶部 greedy 生成按钮的规则。</p></section>}
      <section className={s.question}><span className={s.kicker}>CHECK YOUR UNDERSTANDING</span><h3>{topic.question}</h3>{topic.options.map((o,i)=><button key={o} className={answer===i?(i===topic.answer?s.correct:s.wrong):''} onClick={()=>{setNotebook(n=>({...n,answers:{...n.answers,[topic.id]:i}}));log(topic.id,'answer',o,i===topic.answer)}}><span>{String.fromCharCode(65+i)}</span>{o}{answer===i&&i===topic.answer&&<Check size={15}/>}</button>)}{answer!==undefined&&<p role='status' className={answer===topic.answer?s.answerGood:s.answerBad}>{answer===topic.answer?'✓ 理解正确。':'再想一想。'}{topic.feedback}</p>}</section>
      <section className={s.codeSection}><span className={s.kicker}>IMPLEMENT THIS OPERATION</span><h3><Code2 size={18}/>在这个部件写一段代码</h3><p>补全 ___ 后运行。{topic.id==='attention'?'使用当前层 / 头的 Q、K、V，以及不同形状、未来扰动等检查。':'在独立 Python 环境中执行，并检查数值行为。'}已提供 np{topic.id==='attention'?' 和 stable_softmax':''}。</p><textarea spellCheck={false} aria-label={topic.en+' 代码填空'} value={currentCode} onChange={e=>{const code=e.target.value;if(code.length<=20000)setNotebook(n=>({...n,codes:{...n.codes,[topic.id]:code}}))}}/><div className={s.codeActions}><button className={s.runButton} disabled={!controller||python.status!=='idle'} onClick={runCode}><Play size={14}/>{python.status==='idle'?'运行并检查':python.status==='loading'?'加载 Python…':'正在运行…'}</button>{python.status!=='idle'&&<button onClick={()=>{python.cancel();setRunningNode(null)}}>停止</button>}<button onClick={()=>{setNotebook(n=>({...n,hints:{...n.hints,[topic.id]:true}}));log(topic.id,'hint','查看代码提示',undefined,true)}}>查看提示</button></div>{notebook.hints[topic.id]&&<pre className={s.hint}>{HINTS[topic.id]}<small>本节点后续代码检查标记为“提示辅助”。</small></pre>}{result&&<div className={s.codeResult} role='status'><b>{result.code!==currentCode?'代码已修改，请重新检查':result.pass?'✓ 行为检查通过':'检查未通过'}{result.assisted?' · 提示辅助':''}</b><pre>{result.text}</pre></div>}{runningNode&&runningNode!==topic.id&&<p>正在检查 {TOPICS.find(t=>t.id===runningNode)?.en}，结果将保存在该部件。</p>}{topic.id==='attention'&&codeTrace&&codeTrace.context===JSON.stringify(liveInput)&&<><h4>你的代码算出的当前模型权重</h4><Heatmap rows={codeTrace.data.weights} tokens={snapshot.tokens}/></>}<p className={s.fine}>Python 3.12 / NumPy 2.0.2 · 首次运行需下载环境 · 执行上限 5 秒</p></section>
      <div className={s.sources}><span className={s.kicker}>CONTINUE WITH THE SOURCE</span><a href={topic.resource} target='_blank' rel='noreferrer'><BookOpen size={15}/>{topic.resourceName}<ArrowUpRight size={14}/></a><a href='https://www.youtube.com/watch?v=kCc8FmEb1nY' target='_blank' rel='noreferrer'>视频索引 · Karpathy 从零实现 GPT<ArrowUpRight size={14}/></a></div>
    </>:<><div className={s.panelTop}><span className={s.kicker}>START WITH THE MODEL</span><Box size={20}/></div><h1>走进一个<br/>正在计算的<br/><em>Transformer。</em></h1><p className={s.intro}>每一块都是张量，<br/>每条连线都有计算含义。</p><p>点击模型里的一个小格，查看它的值与来源。从这个部件打开数学解释、交互实验、问题和可运行代码。</p><div className={s.startSteps}><div><b>01</b><p>移动视角，选中一个张量<span>也可以用左上角部件名称定位。</span></p></div><div><b>02</b><p>播放它的计算过程<span>暂停、拖动时间线、检查内部数值。</span></p></div><div><b>03</b><p>预测、实现，再检查<span>学习轨迹根据真实作答和运行记录生成。</span></p></div></div><button className={s.startButton} disabled={!controller} onClick={()=>choose('embedding')}>从输入向量进入模型 <ArrowDownRight size={18}/></button><div className={s.aboutModel}><h3>这个模型是什么？</h3><p>复用 Brendan Bycroft 的 LLM Visualization：具有真实权重的 minGPT 排序模型，3 个 block、每层 3 个头、48 维隐藏表示。这里展示 decoder-only / Pre-LN，不是原论文完整的 encoder-decoder。</p><a href='https://bbycroft.net/llm' target='_blank' rel='noreferrer'>原始交互模型 <ArrowUpRight size={13}/></a><a href='https://poloclub.github.io/transformer-explainer/' target='_blank' rel='noreferrer'>对照：Transformer Explainer <ArrowUpRight size={13}/></a><a href='https://www.llm-visualized.com/' target='_blank' rel='noreferrer'>对照：LLM-Visualized <ArrowUpRight size={13}/></a><a href='/standalone/transformer-lab/model/NOTICE.txt' target='_blank' rel='noreferrer'>来源与开源许可 <ArrowUpRight size={13}/></a></div></>}
    <footer className={s.panelFoot}>{storageError|| (restored?'学习记录保存在此浏览器 · 独立于原课程':'正在恢复记录…')}</footer>
   </aside>
  </div>}
 </main>
}
function Heatmap({rows,tokens}:{rows:number[][];tokens:number[]}){
 const [picked,setPicked]=useState<[number,number]|null>(null)
 return <div className={s.heatmap}><div className={s.heatGrid} style={{gridTemplateColumns:`22px repeat(${rows.length}, 1fr)`}}><span/>{tokens.map((t,i)=><span key={'c'+i}>{'ABC'[t]}<small>{i}</small></span>)}{rows.map((row,i)=><div className={s.heatRow} key={i}><span>{'ABC'[tokens[i]]}<small>{i}</small></span>{row.map((v,j)=><button key={j} aria-label={`query ${i} key ${j} 权重 ${v.toFixed(5)}`} onClick={()=>setPicked([i,j])} style={{background:j>i?'repeating-linear-gradient(135deg,#e9eae7,#e9eae7 2px,#f8f8f6 2px,#f8f8f6 6px)':`rgba(39,122,91,${.06+.94*v})`,color:v>.5?'white':'#234638'}}>{j>i?'×':v.toFixed(2)}</button>)}</div>)}</div><p>{picked&&rows[picked[0]]?.[picked[1]]!==undefined?`query ${picked[0]} → key ${picked[1]}：${rows[picked[0]][picked[1]].toFixed(6)}${picked[1]>picked[0]?' · 未来位置被遮罩':''}`:'点击一格查看权重 · 横轴 key，纵轴 query'}</p></div>
}
const gelu=(x:number)=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))
function GeluPlot({x}:{x:number}){const px=(v:number)=>25+(v+4)*34,py=(v:number)=>150-v*28;return <div className={s.plot}><svg viewBox='0 0 320 190' role='img' aria-label={`GELU 曲线，x=${x.toFixed(2)}，输出=${gelu(x).toFixed(3)}`}><path d='M25 150H300 M161 22V174' stroke='#bac4bc' fill='none'/><path d={Array.from({length:161},(_,i)=>{const a=-4+i/20;return(i?'L':'M')+px(a)+','+py(gelu(a))}).join(' ')} fill='none' stroke='#7c6945' strokeWidth='2.5'/><path d={`M${px(x)} 150V${py(gelu(x))}H161`} stroke='#777' strokeDasharray='3 3' fill='none'/><circle cx={px(x)} cy={py(gelu(x))} r='5' fill='#b47c2a'/><text x='287' y='170'>x</text><text x='170' y='25'>GELU(x)</text></svg><p>GELU({x.toFixed(2)}) = <b>{gelu(x).toFixed(4)}</b></p></div>}
