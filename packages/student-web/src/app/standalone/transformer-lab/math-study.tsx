'use client'
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Box, Check, ChevronRight, Code2, Route } from 'lucide-react'
import type { Concept } from '@/lib/transformer-viz/bridge'
import { TOPICS } from './model-content'
import { FOUNDATIONS, STUDIES, type FoundationId, type Question } from './study-content'
import { NumericLab } from './study-labs'
import { useStudyRecord, type StudyRecord, type StudyEvent } from './study-record'
import { usePython } from './use-python'
import { fixtures, gradeRun } from './math'
import s from './study.module.css'

const stages=['补齐数学基础','逐项读懂公式','推导与数值实验','手算与代码检验','映射到 3D 模型']
type Log=(node:Concept,kind:StudyEvent['kind'],detail:string,pass?:boolean)=>void
type Props={id:Concept;onTopic:(id:Concept)=>void;onModel:(id:Concept)=>void;onOverview:()=>void}
export function Formula({source,inline=false}:{source:string;inline?:boolean}){
 const html=useMemo(()=>katex.renderToString(source,{displayMode:!inline,throwOnError:false,trust:false,output:'htmlAndMathml',strict:'ignore'}),[source,inline])
 return <span className={inline?s.inlineMath:s.formula} dangerouslySetInnerHTML={{__html:html}}/>
}
export function MathStudy({id,onTopic,onModel,onOverview}:Props){
 const {record,setRecord,log,ready,error}=useStudyRecord(),[report,setReport]=useState(false)
 const topic=TOPICS.find(t=>t.id===id)!,level=record.levels[id]??0
 const visited=record.events.filter(e=>e.kind==='foundation').map(e=>e.detail)
 const mastered=(node:Concept)=>STUDIES[node].questions.every((q,i)=>record.answers[node+':'+i]===q.answer)&&record.results[node]?.pass&&record.results[node]?.code===(record.codes[node]??TOPICS.find(t=>t.id===node)!.starter)
 const setLevel=(n:number)=>{setRecord(r=>({...r,levels:{...r.levels,[id]:n}}));log(id,'step',stages[n]);setReport(false);document.getElementById('study-title')?.scrollIntoView({block:'start'})}
 return <div className={s.study}>
  <div className={s.breadcrumb}><button onClick={onOverview}><ArrowLeft size={14}/>结构总览</button><ChevronRight size={13}/><span>从基础到 Transformer</span><button className={s.recordButton} onClick={()=>setReport(v=>!v)}><Route size={14}/>{report?'返回学习':'数学学习记录'}</button></div>
  <header className={s.studyHeader}><div><span className={s.eyebrow}>UNDERSTAND → DERIVE → IMPLEMENT → INSPECT</span><h1 id='study-title' tabIndex={-1}>{report?'你的数学学习路径':topic.title}</h1><p>{report?'用作答与运行结果检验理解，浏览进度与掌握程度分别记录。':STUDIES[id].problem}</p></div><button onClick={()=>onModel(id)} className={s.modelShortcut}><Box size={16}/>直接查看此部件的 3D<ArrowUpRight size={14}/></button></header>
  <div className={s.studyLayout}>
   <nav className={s.topicNav} aria-label='从基础到模型的学习路径'><span className={s.eyebrow}>八个部件 · 可往返学习</span>{TOPICS.map((t,i)=><button key={t.id} aria-current={t.id===id?'step':undefined} onClick={()=>{onTopic(t.id);setReport(false)}}><span>{mastered(t.id)?<Check size={15}/>:String(i+1).padStart(2,'0')}</span><div><b>{t.title}</b><small>{record.levels[t.id]!==undefined?'学到：'+stages[record.levels[t.id]!]:t.en}</small></div></button>)}<div className={s.navNote}><b>建议的顺序</b><p>向量与索引 → 点积与矩阵 → 概率与统计 → 部件推导 → 手算和代码 → 真实 3D。</p><p>可以随时回补。打开页面不会自动算作掌握。</p></div></nav>
   <div className={s.studyMain}>
    {report?<section className={s.report}><h2>基础与部件检查</h2><p>基础题通过 {Object.values(FOUNDATIONS).filter(f=>record.foundations[f.id]===f.question.answer).length}/8；部件手算与代码通过 {TOPICS.filter(t=>mastered(t.id)).length}/8。这里是数学练习记录，原有 3D 模型验收记录继续单独保留。</p><div className={s.foundationStatus}>{Object.values(FOUNDATIONS).map(f=><span key={f.id}>{record.foundations[f.id]===f.question.answer?'✓':visited.includes(f.id)?'○':'·'} {f.title}</span>)}</div>{TOPICS.map(t=>{const wrong=record.events.filter(e=>e.node===t.id&&e.pass===false).length;return <button className={s.reportRow} key={t.id} onClick={()=>{onTopic(t.id);setReport(false)}}><b>{t.title}</b><span>{mastered(t.id)?'手算与代码已通过':'需要继续验证'}</span><small>{wrong>0?`近期 ${wrong} 次未通过尝试，可回看推导`:'尚无失败记录（不等于已掌握）'}</small></button>})}<h3>最近学习过程</h3><ol className={s.evidence}>{record.events.slice(-25).reverse().map((e,i)=><li key={e.at+i}><time>{new Date(e.at).toLocaleTimeString('zh-CN')}</time><b>{TOPICS.find(t=>t.id===e.node)?.title}</b><span>{e.kind==='foundation'?'下钻：'+FOUNDATIONS[e.detail as FoundationId]?.title:e.kind==='code'?'运行了当前代码的数值检查':e.kind==='environment'?'Python 环境加载或执行中断；未计入理解失误':e.detail}{e.pass===undefined?'':e.pass?' · 通过':' · 待修正'}</span></li>)}</ol></section>:<>
     <div className={s.stepper} aria-label='学习深度'>{stages.map((name,i)=><button key={name} aria-current={i===level?'step':undefined} onClick={()=>setLevel(i)}><span>{i+1}</span>{name}</button>)}</div>
     <StudyChapter key={id+':'+level} id={id} level={level} setLevel={setLevel} record={record} setRecord={setRecord} log={log} onModel={onModel} onTopic={onTopic}/>
    </>}
    <footer className={s.studyFooter}>{error||(ready?'数学路径、草稿与检查结果已自动保存在此浏览器。':'正在恢复数学学习记录…')}</footer>
   </div>
  </div>
 </div>
}

function StudyChapter({id,level,setLevel,record,setRecord,log,onModel,onTopic}:{id:Concept;level:number;setLevel:(n:number)=>void;record:StudyRecord;setRecord:Dispatch<SetStateAction<StudyRecord>>;log:Log;onModel:(id:Concept)=>void;onTopic:(id:Concept)=>void}){
 const [symbol,setSymbol]=useState(0),[trail,setTrail]=useState<FoundationId[]>([]),[derivation,setDerivation]=useState(0)
 const top=useRef<HTMLElement>(null),study=STUDIES[id],topic=TOPICS.find(t=>t.id===id)!,term=study.terms[symbol],foundation=trail.at(-1)
 const openFoundation=(f:FoundationId)=>{setTrail(t=>[...t,f]);log(id,'foundation',f);requestAnimationFrame(()=>top.current?.scrollIntoView({block:'start'}))}
 // Navigating between levels exits an optional prerequisite drill-down.
 const move=(n:number)=>{setTrail([]);setLevel(n)}
 useEffect(()=>{const frame=requestAnimationFrame(()=>top.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame)},[foundation])
 const observe=(detail:string)=>log(id,'experiment',detail)
 return <article ref={top} tabIndex={-1} className={s.chapter} aria-label='数学推导工作台'>
  {foundation?<>
   <div className={s.drillBreadcrumb}><button onClick={()=>setTrail([])}>返回{topic.title}</button>{trail.map((f,i)=><span key={i}><ChevronRight size={12}/><button aria-current={i===trail.length-1?'page':undefined} onClick={()=>setTrail(t=>t.slice(0,i+1))}>{FOUNDATIONS[f].title}</button></span>)}</div>
   <FoundationReader key={foundation} id={foundation} onDrill={openFoundation} answer={record.foundations[foundation]} onAnswer={n=>{setRecord(r=>({...r,foundations:{...r.foundations,[foundation]:n}}));log(id,'answer','基础题 '+FOUNDATIONS[foundation].title,FOUNDATIONS[foundation].question.answer===n)}} onObserve={observe}/>
   <button className={s.primary} onClick={()=>setTrail(t=>t.slice(0,-1))}><ArrowLeft size={16}/>{trail.length>1?'回到上一层基础':'返回部件学习'}</button>
  </>:<>
   {level===0&&<><span className={s.eyebrow}>01 / 先建立可用的数学直觉</span><h2>这一步在解决什么问题？</h2><p className={s.lead}>{study.intuition}</p><h3>先补齐这些基础</h3><p>点开任何一项，从定义、记号和最小算例开始。若还有不熟悉的前置概念，可以继续向下钻；返回时保留当前学习位置。</p><div className={s.prerequisites}>{study.prerequisites.map((f,i)=><button key={f} onClick={()=>openFoundation(f)}><span>{String(i+1).padStart(2,'0')}</span><div><b>{FOUNDATIONS[f].title}</b><small>{FOUNDATIONS[f].subtitle}</small></div>{record.foundations[f]===FOUNDATIONS[f].question.answer?<Check size={17}/>:<ArrowUpRight size={17}/>}</button>)}</div><div className={s.orientation}><h3>从这里到 3D，你会走过什么？</h3><ol><li>读懂每个数学符号的意义、形状和来源。</li><li>先用 2–4 个数手算，再在小实验中修改输入。</li><li>通过预测题和实际 Python 执行验证理解。</li><li>将小例子的每一步对应到模型的真实张量。</li></ol></div></>}
   {level===1&&<><span className={s.eyebrow}>02 / 一项一项拆开读</span><h2>公式不是黑箱</h2><Formula source={study.formula}/><p>点选下面的符号，查看它表示什么、是什么形状、如何计算；再继续下钻到所需的数学基础。</p><div className={s.symbols} role='group' aria-label='公式符号解释'>{study.terms.map((t,i)=><button key={t.symbol} aria-pressed={symbol===i} onClick={()=>{setSymbol(i);log(id,'symbol',t.name)}}><Formula source={t.symbol} inline/><span>{t.name}</span></button>)}</div><div className={s.termDetail} aria-live='polite'><div><Formula source={term.symbol} inline/><h3>{term.name}</h3></div><p>{term.meaning}</p><dl><dt>类型 / 形状</dt><dd>{term.shape}</dd><dt>把它代入一个例子</dt><dd>{term.example}</dd></dl><button onClick={()=>openFoundation(term.foundation)}><BookOpen size={15}/>继续下钻：{FOUNDATIONS[term.foundation].title}<ArrowRight size={15}/></button></div><h3>容易混淆的地方</h3><ul className={s.pitfalls}>{study.pitfalls.map(p=><li key={p}>{p}</li>)}</ul></>}
   {level===2&&<><span className={s.eyebrow}>03 / 从定义到可计算的步骤</span><h2>把整条公式拆成计算过程</h2><div className={s.derivationNav}>{study.derivation.map((d,i)=><button key={d.title} aria-pressed={i===derivation} onClick={()=>{setDerivation(i);log(id,'step','推导：'+d.title)}}>{i+1}. {d.title}</button>)}</div><DerivationCard value={study.derivation[derivation]}/><div className={s.deriveControls}><button disabled={derivation===0} onClick={()=>setDerivation(d=>d-1)}>上一步推导</button><button disabled={derivation===study.derivation.length-1} onClick={()=>setDerivation(d=>d+1)}>下一步推导<ArrowRight size={14}/></button></div><NumericLab key={id} kind={id} onObserve={observe}/><details className={s.allSteps}><summary>展开全部推导，连起来读</summary>{study.derivation.map(d=><DerivationCard key={d.title} value={d}/>)}</details></>}
   {level===3&&<><span className={s.eyebrow}>04 / 预测 → 实现 → 核对</span><h2>先独立回答，再写成代码</h2><p>这两道题检查你能否手算与辨认机制；代码会真的在隔离 Python 环境中执行，并与数值行为检查比较。</p>{study.questions.map((q,i)=><Quiz key={i} question={q} answer={record.answers[id+':'+i]} onAnswer={n=>{setRecord(r=>({...r,answers:{...r.answers,[id+':'+i]:n}}));log(id,'answer',q.prompt+' → '+q.options[n],q.answer===n)}}/>)}<StudyCode id={id} record={record} setRecord={setRecord} log={log}/></>}
   {level===4&&<><span className={s.eyebrow}>05 / 从小例子映射到真实张量</span><h2>现在走进 {topic.en}</h2><div className={s.scaleBridge}><div><small>刚才的教学例子</small><b>2–4 维 · 手算每个数</b><span>固定小矩阵，显式展示每一项。</span></div><ArrowRight size={24}/><div><small>训练好的 minGPT 模型</small><b>48 维 · 3 头 · 3 个 Block</b><span>真实权重，浏览器本地前向推理。</span></div></div>{study.bridge.map(p=><p key={p} className={s.bridgeParagraph}>{p}</p>)}<div className={s.bridgeChecklist}><h3>进入模型后做这三件事</h3><ol><li>播放当前部件，并暂停在一个中间步骤。</li><li>选一个格子，把它的来源与刚才的公式对应起来。</li><li>修改输入或参数观察选项，检验你的预测；再运行原有部件代码检查。</li></ol></div><p>{study.questions.every((q,i)=>record.answers[id+':'+i]===q.answer)?'✓ 两道手算题已答对。':'手算题还有未验证部分，可以返回第 4 步补齐。'}{record.results[id]?.pass&&record.results[id]?.code===(record.codes[id]??topic.starter)?' ✓ 当前代码通过小规模检查。':' 当前代码的小规模检查尚未通过。'}可以随时进入 3D，这里不强制锁定进度。</p><button className={s.primary} onClick={()=>onModel(id)}><Box size={18}/>进入 {topic.en} 的 3D 交互<ArrowUpRight size={16}/></button>{TOPICS.indexOf(topic)<7&&<button className={s.nextTopic} onClick={()=>onTopic(TOPICS[TOPICS.indexOf(topic)+1].id)}>继续下一部件：{TOPICS[TOPICS.indexOf(topic)+1].title}<ArrowRight size={15}/></button>}<div className={s.sourceLinks}><a href={topic.resource} target='_blank' rel='noreferrer'><BookOpen size={15}/>{topic.resourceName}<ArrowUpRight size={13}/></a><a href='https://www.youtube.com/watch?v=kCc8FmEb1nY' target='_blank' rel='noreferrer'>视频索引：Karpathy 从零实现 GPT<ArrowUpRight size={13}/></a></div></>}
   <div className={s.stageNavigation}><button disabled={level===0} onClick={()=>move(level-1)}><ArrowLeft size={15}/>上一个学习步骤</button><span>{level+1} / 5</span>{level<4?<button className={s.primary} onClick={()=>move(level+1)}>继续：{stages[level+1]}<ArrowRight size={15}/></button>:<button onClick={()=>onModel(id)}>进入 3D<Box size={15}/></button>}</div>
  </>}
 </article>
}
function DerivationCard({value}:{value:{title:string;formula:string;explanation:string;calculation:string}}){return <section className={s.derivationCard}><h3>{value.title}</h3><Formula source={value.formula}/><p>{value.explanation}</p><div className={s.worked}><b>代入与核对</b><p>{value.calculation}</p></div></section>}
function FoundationReader({id,onDrill,answer,onAnswer,onObserve}:{id:FoundationId;onDrill:(id:FoundationId)=>void;answer?:number;onAnswer:(i:number)=>void;onObserve:(detail:string)=>void}){
 const f=FOUNDATIONS[id]
 return <div className={s.foundationReader}><span className={s.eyebrow}>数学基础 / 可继续下钻</span><h2>{f.title}</h2><p className={s.lead}>{f.subtitle}</p>{f.requires.length>0&&<div className={s.requires}><span>还不熟悉这些前置概念？</span>{f.requires.map(r=><button key={r} onClick={()=>onDrill(r)}>{FOUNDATIONS[r].title}<ArrowRight size={12}/></button>)}</div>}{f.paragraphs.map((p,i)=><p key={i}>{p}</p>)}<Formula source={f.formula}/><p className={s.notation}>{f.notation}</p>{f.steps.map(d=><DerivationCard key={d.title} value={d}/>)}<NumericLab kind={id} onObserve={onObserve}/><Quiz question={f.question} answer={answer} onAnswer={onAnswer}/><a className={s.foundationSource} href={f.source} target='_blank' rel='noreferrer'>{f.sourceName}<ArrowUpRight size={14}/></a></div>
}
function Quiz({question,answer,onAnswer}:{question:Question;answer?:number;onAnswer:(i:number)=>void}){return <section className={s.quiz}><span className={s.eyebrow}>停下来预测一下</span><h3>{question.prompt}</h3>{question.options.map((o,i)=><button key={o} aria-pressed={answer===i} data-result={answer===i?(i===question.answer?'correct':'wrong'):undefined} onClick={()=>onAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}{answer!==undefined&&<p role='status' className={s.feedback}>{answer===question.answer?'✓ 理解正确。':'还需要修正。'}{question.explanation}</p>}</section>}
function StudyCode({id,record,setRecord,log}:{id:Concept;record:StudyRecord;setRecord:Dispatch<SetStateAction<StudyRecord>>;log:Log}){
 const topic=TOPICS.find(t=>t.id===id)!,python=usePython(),code=record.codes[id]??topic.starter,result=record.results[id]
 function run(){const saved=code;const finish=(pass:boolean,text:string,environment=false)=>{setRecord(r=>({...r,results:{...r.results,[id]:{code:saved,pass,text:text.slice(0,30000)}}}));log(id,environment?'environment':'code',text,environment?undefined:pass)}
  if(id==='attention'){const cases=fixtures(20261022);python.run(saved,cases,r=>{const checks=gradeRun(cases,r.raw).checks;finish(!r.error&&checks.every(c=>c.pass),(r.error??'')+'\n'+checks.map(c=>(c.pass?'✓ ':'✗ ')+c.label+' · '+c.detail).join('\n')+'\n'+r.stdout)},e=>finish(false,e,true))}
  else python.runScript(saved+'\n\n'+topic.tests,r=>finish(!r.error&&!!(r.raw as {ok?:boolean})?.ok,r.error??r.stdout),e=>finish(false,e,true))
 }
 return <section className={s.code}><h3><Code2 size={18}/>把公式翻译成 Python</h3><p>补全 ___。已提供 np{id==='attention'?' 和 stable_softmax':''}。这些小规模检查不会替代进入 3D 后的模型数据检查。</p><textarea aria-label={topic.en+' 数学代码练习'} value={code} spellCheck={false} onChange={e=>{const value=e.target.value;if(value.length<=20000)setRecord(r=>({...r,codes:{...r.codes,[id]:value}}))}}/><div className={s.codeButtons}><button className={s.primary} disabled={python.status!=='idle'} onClick={run}>{python.status==='idle'?'运行小规模检查':python.status==='loading'?'加载 Python…':'正在运行…'}</button>{python.status!=='idle'&&<button onClick={python.cancel}>停止运行</button>}</div>{result&&<div className={s.result} role='status'><b>{result.code!==code?'代码已修改，需要重新运行':result.pass?'✓ 代码检查通过':'检查尚未通过'}</b><pre>{result.text}</pre></div>}<small>浏览器隔离执行 · Python 3.12 / NumPy 2.0.2 · 首次需要下载环境 · 运行上限 5 秒</small></section>
}
