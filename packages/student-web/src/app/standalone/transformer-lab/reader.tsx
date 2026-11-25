'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Box, BookOpen, Check, ChevronRight, Menu } from 'lucide-react'
import { Formula } from './formula'
import { lessons, sources } from './reader-lessons'
import { Experiment, Trace } from './reader-experiments'
import { defaults, type Settings } from './pocket-model'
import { mathNotes } from './reader-math-notes'
import { MatrixFactorization } from './matrix-factorization'
import { HeadSplit } from './head-split'
import { MatrixDesk, hasMatrixDesk } from './matrix-desk'
import { ReaderCode } from './reader-code'
import { ReaderIntroduction } from './reader-introduction'
import { VectorFlight } from './vector-flight'
import c from './reader.module.css'

const base = '/standalone/transformer-lab'
const storageKey = 'transformer-first-principles:v1'
type Journal = { last: string; answers: Record<string,number> }
const initial: Journal = { last:lessons[0].id, answers:{} }
const modelNotes:Record<string,string> = {
  translation:'3D 中可检查解码器的自注意力，比较 Q、K、V 的来源。本节的翻译实验则可操作来自两段序列的交叉注意力。',
  training:'在 3D 输出层读取真实词表概率。参数更新可在本节的损失曲线实验中逐步操作。',
  generation:'在 3D 模型中可把新词追加到序列，观察新一行预测。缓存实验单独展示增量计算节省的那部分工作。',
  variants:'3D 排序模型用 LayerNorm。可先算出一行的均值和标准差，再与本节的 RMSNorm 对照。',
}
const groups = [...new Set(lessons.map(l => l.group))]
const anchor = (id: string) => '#lesson/'+id
const known = (id?: string) => lessons.some(l => l.id === id)
function restore():Journal {
  const value = JSON.parse(localStorage.getItem(storageKey) || 'null')
  if (!value || !known(value.last)) return initial
  const answers: Record<string,number> = {}
  for (const l of lessons) {
    const answer = value.answers?.[l.id]
    if (Number.isInteger(answer) && answer >= 0 && answer < l.check.options.length) answers[l.id] = answer
  }
  return { last:value.last, answers }
}
export function FirstPrinciples() {
  const [journal,setJournal] = useState<Journal>(initial)
  const [intro,setIntro] = useState(true)
  const [fragment,setFragment] = useState('')
  const [ready,setReady] = useState(false)
  const [storageIssue,setStorageIssue] = useState(false)
  const [menu,setMenu] = useState(false)
  const [settings,update] = useState<Settings>(defaults)
  const index = Math.max(0,lessons.findIndex(l=>l.id===journal.last))
  const lesson = lessons[index], answer = journal.answers[lesson.id]
  const extraMath = mathNotes[lesson.id]
  const passed = lessons.filter(l => journal.answers[l.id] === l.check.answer).length
  useEffect(()=>{
    function showHash() {
      if (['#block-map','#overview-title','#block-title'].includes(location.hash)) { location.replace(base+'?view=overview'+location.hash); return }
      const hash = location.hash.slice(1)
      const [,id] = hash.split('/')
      const reading = location.hash.startsWith('#lesson/') && known(id)
      setIntro(!reading)
      if (reading) setJournal(j=>({...j,last:id}))
      setFragment(hash)
    }
    let active=true
    queueMicrotask(()=>{if (!active) return
      try {
        setJournal(restore())
        const saved = JSON.parse(localStorage.getItem(storageKey+':model') || 'null')
        if (saved && Array.isArray(saved.tokens) && saved.tokens.length===3 && saved.tokens.every((id:unknown)=>typeof id==='number' && Number.isInteger(id) && id>=0 && id<3) && ['causal','scaled','position','nonlinear'].every(key=>typeof saved[key]==='boolean') && Number.isFinite(saved.fishBias)) update(saved)
      } catch { setStorageIssue(true) }
      showHash(); setReady(true)
    })
    window.addEventListener('hashchange',showHash)
    return ()=>{active=false; window.removeEventListener('hashchange',showHash)}
  },[])
  useEffect(()=>{
    if (!ready || storageIssue) return
    try {localStorage.setItem(storageKey,JSON.stringify(journal)); localStorage.setItem(storageKey+':model',JSON.stringify(settings))}
    catch {queueMicrotask(()=>setStorageIssue(true))}
  },[ready,journal,settings,storageIssue])
  useEffect(()=>{
    if (!ready) return
    const frame = requestAnimationFrame(()=>{
      const target = document.getElementById(fragment)
      if (target) {
        target.focus({preventScroll:true})
        target.scrollIntoView({block:'start'})
      } else {
        document.getElementById('reader-title')?.focus({preventScroll:true})
        window.scrollTo({top:0})
      }
    })
    return ()=>cancelAnimationFrame(frame)
  },[ready,fragment])
  const firstMatrix = lesson.sections.find(section => hasMatrixDesk(section.concept?.id))?.concept
  const target = (view: string) => base+'?view='+view+(intro?'':'&part='+lesson.part+'&from='+lesson.id)
  const contents = <><p className={c.navTitle}>学习目录 <span>{lessons.length} 节</span></p><a className={c.introNav} href="#guide" aria-current={intro?'page':undefined} onClick={()=>setMenu(false)}>课程导读</a>{groups.map(group=><div key={group} className={c.navGroup}><h3>{group}</h3>{lessons.map((l,i)=>l.group===group&&<a key={l.id} href={anchor(l.id)} aria-current={!intro&&index===i?'step':undefined} onClick={()=>setMenu(false)}><span>{journal.answers[l.id]===l.check.answer?<Check size={13} aria-label="自测已通过"/>:String(i+1).padStart(2,'0')}</span>{l.title}</a>)}</div>)}<div className={c.journal}><b>已答对 {passed} / {lessons.length} 道自测</b><progress max={lessons.length} value={passed}/><small>{storageIssue?'当前浏览器无法保存进度。':'阅读位置与作答保存在此浏览器。'}</small></div></>
  return <main className={c.page}><header className={c.mast}><a href="#guide" className={c.brand} onClick={()=>setMenu(false)}><span className={c.brandMark} aria-hidden="true">∑</span><span>Transformer <b>原理实验室</b></span></a><nav><button className={c.menuButton} aria-expanded={menu} disabled={!ready} onClick={()=>setMenu(open=>!open)}><Menu size={16}/>课程目录</button><a href="#concepts" onClick={()=>setMenu(false)}>概念索引</a><a href={target('overview')}><BookOpen size={16}/>模型结构图</a><a href={target('model')}><Box size={16}/>交互 3D</a></nav></header>
    {menu&&<nav className={c.drawer} aria-label="移动端课节">{contents}</nav>}
    <div className={c.layout}><aside className={c.sidebar}><nav aria-label="课节">{contents}</nav></aside><div className={c.main} key={intro?'guide':lesson.id}>
    {intro ? <ReaderIntroduction first={lessons[0].id} resume={index>0?lesson:undefined}/> : <>
    <header className={c.lessonHead}><p className={c.kicker}><a href="#guide">{index===0?'先读导读 · Transformer 是什么？':'课程导读'}</a><ChevronRight size={13}/>{lesson.group}</p><div className={c.lessonIndex}>第 {index+1} 节 <i/> 共 {lessons.length} 节</div><h1 id="reader-title" tabIndex={-1}>{lesson.title}</h1><p>{lesson.question}</p><button className={c.jump} onClick={()=>document.getElementById('lesson-experiment')?.scrollIntoView({block:'start'})}>动手试一试 ↓</button>{firstMatrix && <a className={c.matrixJump} href={anchor(lesson.id)+'/'+firstMatrix.id}>逐格拆解矩阵 ↓</a>}</header>
    {index===0&&<div className={c.introMap} aria-label="Transformer 的计算流程">{[['embedding','输入表示','文字 → 向量'],['routing','注意力','从前文读取'],['feedforward','前馈网络','更新每行特征'],['readout','词表预测','分数 → 概率']].map(([id,title,desc])=><a key={id} href={anchor(id)}><b>{title}</b><small>{desc}</small><ChevronRight size={15}/></a>)}</div>}
    <div className={c.columns}><article className={c.article}>
    {lesson.sections.map(section => {
      const concept = section.concept?.id
      return <section key={section.title}>
        <h2 id={concept ? 'lesson/' + lesson.id + '/' + concept : undefined} tabIndex={concept ? -1 : undefined}>{section.title}</h2>
        {section.text.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        {section.equation && <div className={c.equation}><Formula source={section.equation}/><p>{section.read}</p></div>}
        <MatrixDesk concept={concept} settings={settings}/>
        {concept === 'split-heads' && <HeadSplit/>}
        {concept === 'factorization' && <MatrixFactorization/>}
      </section>
    })}
    {extraMath&&<details className={c.mathNote}><summary>数学慢读 · {extraMath.title}</summary>{extraMath.paragraphs.map(p=><p key={p}>{p}</p>)}<p><b>用纸笔试一次。</b>{extraMath.test}</p><details><summary>核对推理</summary><p>{extraMath.solution}</p></details></details>}
    <section className={c.faq}><h2>初学时容易卡在哪里？</h2>{lesson.ask.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    </article><aside id="lesson-experiment" className={c.labColumn}>{index===0&&<div className={c.firstFlight}><VectorFlight settings={settings}/></div>}<Trace lesson={lesson} settings={settings} update={update}/><div className={c.modelLink}><Box size={20}/><div><b>在训练过的模型里看这一步</b><p>{modelNotes[lesson.id]??'A/B/C 排序模型有 3 层、每层 3 个头。可旋转、播放，点格子追踪实际数值。'}</p><a href={target('model')}>定位对应的 3D 部件 <ArrowRight size={14}/></a></div></div></aside></div>
    {['residual','audit'].includes(lesson.id)&&<div className={c.extraLab}><VectorFlight settings={settings}/></div>}
    {lesson.lab&&<div className={c.extraLab}><Experiment lesson={lesson} settings={settings} update={update}/></div>}
    <ReaderCode id={lesson.id}/>
    <section className={c.quiz}><small>换个例子，自己判断</small><h2>{lesson.check.prompt}</h2><div>{lesson.check.options.map((option,i)=><button key={option} aria-pressed={answer===i} onClick={()=>setJournal(j=>({...j,answers:{...j.answers,[lesson.id]:i}}))}>{option}</button>)}</div>{answer!==undefined&&<p role="status"><b>{answer===lesson.check.answer?'答对了。':'再算一次。'}</b>{lesson.check.reason}</p>}</section>
    <div className={c.references}><div><h3>继续推导与动手实现</h3><a href={target('math')}>打开分步推导、数学基础和 Python 填空 <ArrowRight size={14}/></a>{lesson.id==='audit'&&<><a download href={base+'/attention-project.zip'}>下载注意力编程项目（ZIP）</a><p>在 Python 环境中按 README 安装依赖，补全 src/attention.py，运行 python -m unittest discover -s tests -v，并在 reports/reflection.md 记录预测、结果与原因。</p></>}</div><div><h3>对照原始资料</h3>{lesson.sources.map(key=><a key={key} href={sources[key][1]} target="_blank" rel="noreferrer">{sources[key][0]} ↗</a>)}</div></div>
    <footer className={c.pager}><a href={index>0?anchor(lessons[index-1].id):'#guide'}><ArrowLeft size={16}/>{index>0?'上一节':'回到课程导读'}</a>{index<lessons.length-1?<a href={anchor(lessons[index+1].id)}>下一节 · {lessons[index+1].title}<ArrowRight size={16}/></a>:<a href={target('model')}>进入模型，完成独立验收 <ArrowRight size={16}/></a>}</footer>
    </>}
    </div></div></main>
}
