import { useEffect, useMemo, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { BookOpen, List, NotebookPen, Presentation, CheckCircle, Play } from 'lucide-react'
import 'katex/dist/katex.min.css'
import type { Snapshot } from '../host'
import { assetURL, type CourseLesson, type Exercise, type Slide } from '../content'
import { receiveCourseArtifact } from '../course-artifacts'
import { readingPages } from './reading-pages'
import { Pager, Sheet } from './primitives'

type Panel = 'contents' | 'work' | 'resources' | 'lecture' | `theory:${string}` | `lab:${string}` | null

export function CourseReader({ lesson, initial, onChange, onCommit }: { lesson: CourseLesson; initial: Snapshot; onChange: (state: Snapshot) => void; onCommit: (state: Snapshot) => Promise<void> }) {
  const revised = !!lesson.content_revision && initial.content_revision !== lesson.content_revision
  const previousCompletion = initial.previous_completion ?? (revised && initial.self_completed === true ? { revision: initial.content_revision ?? 'original', completed: true } : null)
  const [index, setIndex] = useState(() => revised ? 0 : Math.max(0, Number(initial.page_index) || 0))
  const [note, setNote] = useState(typeof initial.note === 'string' ? initial.note : '')
  const [answers, setAnswers] = useState<Record<string, string>>((initial.answers as Record<string, string>) ?? {})
  const [completed, setCompleted] = useState(!revised && initial.self_completed === true)
  const [slideIndex, setSlideIndex] = useState(revised ? 0 : Number(initial.slide_index) || 0)
  const [workspace, setWorkspace] = useState<Record<string,string>>(() => Object.assign({}, ...Object.values((initial.frames as Record<string,Record<string,string>>) ?? {}), (initial.shared_workspace as Record<string,string>) ?? {}))
  const [workView, setWorkView] = useState('note')
  const [panel, setPanel] = useState<Panel>(null)
  const pages = useMemo(() => readingPages(lesson.lesson), [lesson.lesson])
  const page = pages[Math.min(index, pages.length - 1)]
  const sections = [...new Set(pages.map(p => p.section))]
  const resolve = (url: string) => assetURL(url, lesson.asset_base)
  const interactions = lesson.interactions ?? [], theories = lesson.theories ?? [], slides = lesson.slides ?? []
  useEffect(() => onChange({ ...initial, note, answers, frames: {}, shared_workspace: workspace, page_index: index, reader_page: page?.id, slide_index: slideIndex, self_completed: completed, previous_completion: previousCompletion, content_revision: lesson.content_revision, content_version: lesson.content_version, module_id: lesson.module_id, library_slug: lesson.course_id }), [note, answers, workspace, index, slideIndex, completed, onChange, lesson, page?.id])
  async function commitWorkspace(next: Record<string,string>) {
    setWorkspace(next)
    await onCommit({...initial, note, answers, frames:{}, shared_workspace:next, page_index:index, slide_index:slideIndex, self_completed:completed, previous_completion:previousCompletion, content_revision:lesson.content_revision, content_version:lesson.content_version, module_id:lesson.module_id, library_slug:lesson.course_id})
  }
  function markdown(value: string) {
    // Keep source text unchanged; markers become accessible in-context entry buttons.
    const chunks = value.split(/(\[\[(?:IDEA|THEORY|ANIM|GAME|VIDEO|3D_OBJECT|LAB):[^\]]+\]\])/g)
    return chunks.map((chunk, i) => {
      const match = chunk.match(/^\[\[([^:]+):([^\]]+)\]\]$/)
      if (match) {
        const [, kind, id] = match
        const theory = theories.find(t => t.theory_id === id || t.aliases?.includes(id)), lab = interactions.find(t => t.id === id)
        if (theory) return <button key={i} className="content-entry" onClick={() => setPanel(`theory:${id}`)}><BookOpen size={20}/><span>{theory.title}</span><span>理解概念 →</span></button>
        if (lab) return <button key={i} className="content-entry" onClick={() => setPanel(`lab:${id}`)}><Play size={20}/><span>{lab.title}</span><span>动手试试 →</span></button>
        return <p className="muted" key={i}>{kind} · {id}：源课程未提供此资源。</p>
      }
      return <ReactMarkdown key={i} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { trust: false, strict: false }]]} components={{
        a: ({ href, children }) => <a href={href ? resolve(href) : undefined} target="_blank" rel="noreferrer">{children} ↗</a>,
        img: ({ src, alt }) => <img src={typeof src === 'string' ? resolve(src) : undefined} alt={alt ?? ''} loading="lazy"/>,
        table: ({ children }) => <div className="table-detail">{children}</div>,
        tr: ({ children }) => <dl>{children}</dl>, th: ({ children }) => <dt>{children}</dt>, td: ({ children }) => <dd>{children}</dd>,
        thead: ({ children }) => <div>{children}</div>, tbody: ({ children }) => <div>{children}</div>,
      }}>{chunk}</ReactMarkdown>
    })
  }
  const resources = [...(lesson.resources ?? []), ...(lesson.downloads ?? []), ...Object.values(lesson.external_resources ?? {}).flatMap(v => Array.isArray(v) ? v : [])].filter(r => r.url)
  const activeTheory = panel?.startsWith('theory:') ? theories.find(t => t.theory_id === panel.slice(7) || t.aliases?.includes(panel.slice(7))) : null
  const activeLab = panel?.startsWith('lab:') ? interactions.find(t => t.id === panel.slice(4)) : null
  return <div className="mobile-reader course-reader">
    <header className="reading-heading"><button onClick={() => setPanel('contents')} aria-label="打开课文目录"><List size={18}/><span>{lesson.module_id} · 本节目录</span></button><button onClick={() => setPanel('lecture')} disabled={!slides.length}><Presentation size={17}/>讲课</button></header>
    <div className="section-progress" aria-hidden="true">{sections.map((s, i) => <span key={s} data-active={i <= sections.indexOf(page?.section)}/>)}</div>
    <article className="reading-card" key={page?.id} aria-label={`课文第 ${index + 1} 页`} tabIndex={0}>
      <p className="overline">{page?.fields ? `逐项对照 · ${page.row} / ${page.rows}` : `阅读 · ${index + 1}`}</p>
      <h1>{page?.section ?? lesson.title}</h1>
      {page?.fields ? <dl className="comparison-card">{page.fields.map((field, i) => <div key={i}><dt>{markdown(field.label)}</dt><dd>{markdown(field.value || '—')}</dd></div>)}</dl> : <div className="reading-prose">{markdown(page?.markdown || lesson.lesson)}</div>}
      {index >= pages.length - 1 && <button className="wide-button" onClick={() => setCompleted(!completed)}><CheckCircle size={18}/>{completed ? '已标记读完 · 撤销' : '标记为已读完'}</button>}
    </article>
    <div className="reader-controls"><Pager index={Math.min(index, pages.length - 1)} count={Math.max(1, pages.length)} onChange={setIndex}/><div className="reader-actions"><button onClick={() => setPanel('work')}><NotebookPen size={18}/>练习与笔记</button><button onClick={() => setPanel('resources')}><BookOpen size={18}/>资料与实践</button></div></div>
    {panel === 'contents' && <Sheet title="本节阅读路径" onClose={() => setPanel(null)}><p>{lesson.core_question}</p><div className="contents-list">{sections.map((s, i) => <button key={s} onClick={() => { setIndex(pages.findIndex(p => p.section === s)); setPanel(null) }}><span>{i + 1}</span><strong>{s}</strong></button>)}</div></Sheet>}
    {panel === 'work' && <Sheet title="练习与笔记" onClose={() => setPanel(null)} footer={<label className="work-selector">选择练习内容<select aria-label="选择练习内容" value={workView} onChange={e=>setWorkView(e.target.value)}><option value="note">我的笔记与作业说明</option>{lesson.content_history && <option value="history">修订前的学习记录</option>}{lesson.assignment && <option value="assignment">阅读作业要求</option>}{(lesson.response_prompts ?? []).map((p,i)=><option value={'prompt:'+i} key={'p'+i}>{p.title}</option>)}{(lesson.assessments ?? []).filter(a=>a.questions.length).map(a=><option key={a.id} value={'assessment:'+a.id}>{a.title}</option>)}{interactions.filter(i=>i.exercises.length).map(i=><option key={i.id} value={'exercise:'+i.id}>{i.title}</option>)}</select></label>}>
      <p className="muted">答案和笔记保存在本机，可导出。本机练习和读完标记不代表正式评分。</p>
      {workView === "assignment" && <DocumentPages text={lesson.assignment} render={markdown}/>}
      {workView === 'history' && lesson.content_history && <section><h3>修订前的学习记录</h3><p>{lesson.content_history.notice}</p>{previousCompletion ? <p>保留了旧版的读完标记。新版内容需要重新核对。</p> : null}{lesson.content_history.questions.filter(q => answers[q.key] !== undefined).map(q => <article className="card" key={q.key}><h4>{q.question}</h4><p>原答案：{q.options?.[Number(answers[q.key])] ?? answers[q.key]}</p></article>)}{!lesson.content_history.questions.some(q => answers[q.key] !== undefined) && <p>这份本机记录中没有修订前的题目答案。原有笔记仍在“我的笔记与作业说明”中。</p>}<details><summary>查看保留的互动记录</summary><pre>{JSON.stringify(Object.fromEntries(Object.entries(workspace).filter(([key]) => !lesson.content_revision || !key.endsWith(':' + lesson.content_revision))), null, 2)}</pre></details></section>}

      {(lesson.assessments ?? []).filter(a => a.questions.length && workView === 'assessment:'+a.id).map(a => <section key={a.id}><h3>{a.title}</h3><Questions questions={a.questions} prefix={a.id} answers={answers} onAnswer={(id, answer) => setAnswers({ ...answers, [id]: answer })}/></section>)}
      {(lesson.response_prompts ?? []).map((prompt, p) => workView === 'prompt:'+p && <fieldset key={p}><legend>{prompt.title}</legend><p>{prompt.hint}</p>{prompt.fields.map(field => { const answerKey = `prompt:${p}:${field.id}`; return <label className="answer-field" key={field.id}>{field.label}{field.options ? <select value={answers[answerKey] ?? ''} onChange={e => setAnswers({ ...answers, [answerKey]: e.target.value })}><option value="">请选择</option>{field.options.map(o => <option key={o}>{o}</option>)}</select> : <textarea maxLength={3000} value={answers[answerKey] ?? ''} placeholder={field.placeholder} onChange={e => setAnswers({ ...answers, [answerKey]: e.target.value })}/>}</label> })}</fieldset>)}
      {interactions.filter(i => i.exercises.length && workView === 'exercise:'+i.id).map(lab => <Questions key={lab.id} questions={lab.exercises} prefix={lab.id} answers={answers} onAnswer={(id, answer) => setAnswers({ ...answers, [id]: answer })}/>)}
      {workView === "note" && <label className="answer-field" htmlFor="course-note">我的笔记与作业说明<textarea id="course-note" value={note} maxLength={20000} placeholder="记录你的判断、操作结果和作品文件位置。" onChange={e => setNote(e.target.value)}/></label>}
    </Sheet>}
    {panel === 'resources' && <Sheet title="资料与实践" onClose={() => setPanel(null)}>
      <p className="muted">课文和内置素材已保存在本机。外部网页、YouTube 和 Python 环境首次加载需要网络。</p><div className="resource-list">{(lesson.foundations ?? []).map(f => <details key={f.id}><summary>{f.title}</summary>{markdown(f.body_markdown)}</details>)}{theories.map(t => <button className="content-entry" key={t.theory_id} onClick={() => setPanel(`theory:${t.theory_id}`)}><BookOpen size={17}/>{t.title}</button>)}{interactions.map(i => <button className="content-entry" key={i.id} onClick={() => setPanel(`lab:${i.id}`)}><Play size={17}/>{i.title}</button>)}</div>
      {lesson.lab_url && <a href={'https://systeme.xin'+lesson.lab_url}>打开本课工作台（联网） ↗</a>}
      <div className="resource-list">{resources.map((r, i) => <div key={i}><a href={resolve(r.url!)} target="_blank" rel="noreferrer">{r.title ?? r.url} ↗</a><p>{r.purpose ?? r.focus ?? r.detail}</p>{r.media_url && <video controls playsInline preload="none" src={resolve(r.media_url)} poster={r.poster_url ? resolve(r.poster_url) : undefined} style={{width:"100%"}}/>}</div>)}</div>
      {!resources.length && <p className="muted">本节资料链接保留在课文和作业原文中。</p>}
    </Sheet>}
    {activeTheory && <Sheet title={activeTheory.title} onClose={() => setPanel(null)}><TheoryBody key={activeTheory.theory_id} theory={activeTheory} render={markdown} questionPrefix={`theory:${activeTheory.theory_id}:${lesson.content_revision ?? lesson.content_version}`} answers={answers} onAnswer={(id, value) => setAnswers({ ...answers, [id]: value })}/></Sheet>}
    {activeLab && <Sheet title="互动学习" onClose={() => setPanel(null)}><h3>{activeLab.title}</h3>{activeLab.path ? <InteractiveFrame path={resolve(activeLab.path)} title={activeLab.title} storage={workspace} onStorage={setWorkspace} onCommit={commitWorkspace} moduleId={lesson.module_id} ideaId={activeLab.id}/> : null}{activeLab.exercises.length > 0 && <Questions questions={activeLab.exercises} prefix={activeLab.id} answers={answers} onAnswer={(id, answer) => setAnswers({ ...answers, [id]: answer })}/>}</Sheet>}
    {panel === 'lecture' && <Sheet title={`讲课 · ${Math.min(slideIndex + 1, slides.length)}/${slides.length}`} onClose={() => setPanel(null)} footer={<Pager index={Math.min(slideIndex, slides.length - 1)} count={slides.length} onChange={setSlideIndex}/>}><SlideCard slide={slides[Math.min(slideIndex, slides.length - 1)]} markdown={markdown} resolve={resolve} onTheory={id => setPanel(`theory:${id}`)} onLab={id => setPanel(`lab:${id}`)}/></Sheet>}
  </div>
}

function DocumentPages({text,render}:{text:string;render:(text:string)=>React.ReactNode}) {
 const pages=useMemo(()=>readingPages(text),[text]),[index,setIndex]=useState(0),page=pages[index]
 return <><h3>{page?.section}</h3>{render(page?.markdown ?? '')}{page?.fields?.map((f,i)=><div key={i}><strong>{f.label}</strong>{render(f.value)}</div>)}<Pager index={index} count={Math.max(1,pages.length)} onChange={setIndex}/></>
}

function TheoryBody({ theory, render, questionPrefix, answers, onAnswer }: { theory: CourseLesson['theories'][number]; render: (text: string) => React.ReactNode; questionPrefix: string; answers: Record<string, string>; onAnswer: (id: string, value: string) => void }) {
  const levels = theory.level_bodies ?? [], [level, setLevel] = useState(0)
  const [practice, setPractice] = useState(false)
  const pages = useMemo(() => readingPages(levels[level]?.body_markdown ?? theory.body_markdown ?? ''), [theory, level]), [index, setIndex] = useState(0)
  return <>{practice ? <><button className="wide-button" onClick={() => setPractice(false)}>返回概念解释</button><Questions questions={theory.exercises ?? []} prefix={questionPrefix} answers={answers} onAnswer={onAnswer}/></> : <><div className="level-picker">{levels.map((v, i) => <button key={v.level} aria-pressed={i === level} onClick={() => { setLevel(i); setIndex(0) }}>{v.level === 'K1' ? '基础解释' : v.level === 'K3' ? '深入理解' : v.level}</button>)}</div><h3>{pages[index]?.section}</h3>{render(pages[index]?.markdown ?? '')}{pages[index]?.fields?.map((f,i) => <div key={i}><strong>{f.label}</strong>{render(f.value)}</div>)}<Pager index={index} count={Math.max(1, pages.length)} onChange={setIndex}/>{!!theory.exercises?.length && <button className="wide-button" onClick={() => setPractice(true)}>概念自测 · {theory.exercises.length} 题</button>}</>}</>
}
function Questions({ questions, prefix, answers, onAnswer }: { questions: Exercise[]; prefix: string; answers: Record<string, string>; onAnswer: (id: string, value: string) => void }) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  return <>{questions.map((q, i) => { if (i !== questionIndex) return null; const id = `${prefix}:${q.id ?? i}`; return <fieldset key={id}><legend>{i + 1}. {q.question ?? q.prompt}</legend>{q.options?.length ? q.options.map((option, n) => <label className="choice-answer" key={n}><input type="radio" name={id} checked={answers[id] === String(n)} onChange={() => onAnswer(id, String(n))}/>{option}</label>) : <textarea value={answers[id] ?? ''} maxLength={2000} onChange={e => onAnswer(id, e.target.value)}/>}<button className="wide-button" disabled={!answers[id] && answers[id] !== '0'} onClick={() => setRevealed({ ...revealed, [id]: true })}>查看解析</button>{revealed[id] && <p role="status">{typeof q.correct === 'number' ? answers[id] === String(q.correct) ? '回答正确。' : '再检查你的判断。' : ''}{q.explanation ?? q.answer ?? '请结合本节原理说明自己的理由。'}</p>}</fieldset> })}<Pager index={questionIndex} count={questions.length} onChange={setQuestionIndex} label="题"/></>
}
function InteractiveFrame({ path, title, storage, onStorage, onCommit, moduleId, ideaId }: { path: string; title: string; storage?: Record<string,string>; onStorage?: (value: Record<string,string>) => void; onCommit?: (value: Record<string,string>) => Promise<void>; moduleId?: string; ideaId?: string }) {
  const [expanded, setExpanded] = useState(false), [error, setError] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const channel = useRef(Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join(''))
  const source = useRef(path.split('#')[0]+'#'+encodeURIComponent(JSON.stringify({channel:channel.current,storage:storage ?? {}})))
  const change = useRef(onStorage); change.current = onStorage
  const stored = useRef(storage ?? {}), commit = useRef(onCommit); stored.current=storage ?? {};commit.current=onCommit
  const queue=useRef(Promise.resolve())
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data
      if(moduleId && ideaId && typeof data?.type === 'string' && data.type.startsWith('systemedu-')) {
        const sourceWindow=frame.current?.contentWindow
        queue.current=queue.current.then(async()=>{
          await receiveCourseArtifact(data,moduleId,ideaId,stored.current,async value=>{
            if(!commit.current) throw new Error('本机保存服务未连接')
            await commit.current(value);stored.current=value;setError('实验产物已保存到本机，可随学习记录导出。')
          },message=>{if(frame.current?.contentWindow===sourceWindow)sourceWindow?.postMessage(message,'*')})
        }).catch(()=>setError('实验产物保存失败，请保留当前页面并重试。'))
        return
      }
      if(data?.channel !== channel.current) return
      if (data.type === 'course-frame-state') {
        if (data.oversized) { setError('实验记录已超过本节容量，请使用实验内的导出按钮保存作品。'); return }
        if (!data.storage || typeof data.storage !== 'object' || Array.isArray(data.storage)) return
        if (Object.values(data.storage).some(v=>typeof v !== 'string') || new TextEncoder().encode(JSON.stringify(data.storage)).length>90000) return
        change.current?.(data.storage)
      } else if (data.type === 'course-frame-download' && typeof data.data === 'string' && data.data.length<17_000_000 && /^data:[a-zA-Z0-9.+/-]+;base64,/.test(data.data)) {
        const link=document.createElement('a'); const name=String(data.name ?? 'experiment.json').replace(/[^a-zA-Z0-9_.\-\u4e00-\u9fff]/g,'_').slice(0,100)
        link.href=data.data+'#'+encodeURIComponent(name); link.download=name; link.click()
      } else if (data.type === 'course-frame-link' && typeof data.url === 'string' && data.url.startsWith('https://')) {
        const link=document.createElement('a');link.href=data.url;link.target='_blank';link.rel='noreferrer';link.click()
      } else if (data.type === 'course-frame-error') setError(String(data.message).slice(0,300))
    }
    window.addEventListener('message',receive);return ()=>window.removeEventListener('message',receive)
  }, [])
  return <div className={expanded ? 'interactive-viewport expanded' : 'interactive-viewport'}><button className="wide-button" onClick={() => setExpanded(!expanded)}>{expanded ? '退出全屏' : '全屏操作'}</button><iframe ref={frame} title={title} src={source.current} sandbox="allow-scripts allow-downloads allow-pointer-lock" allow="fullscreen"/>{error && <p role="alert">{error}</p>}<p className="muted">原课程互动。较宽的实验可旋转手机横屏操作。</p></div>
}
function SlideCard({ slide, markdown, resolve, onTheory, onLab }: { slide?: Slide; markdown: (s: string) => React.ReactNode; resolve: (s: string) => string; onTheory: (s: string) => void; onLab: (s: string) => void }) {
  if (!slide) return <p>本节没有独立讲课稿。</p>
  const p = slide.payload ?? {}
  const hasPresentationText = ['hero_subtitle', 'key_takeaway', 'bullets', 'concept_cards'].some(key => {
    const value = p[key]
    return typeof value === 'string' ? !!value.trim() : Array.isArray(value) && value.length > 0
  })
  const fallbackBody = !hasPresentationText && (slide.body_markdown || (typeof p.body_markdown === 'string' ? p.body_markdown : ''))
  return <div className="lecture-card"><h2>{slide.title}</h2>{fallbackBody && markdown(fallbackBody)}{Object.entries(p).map(([key, value]) => {
    if (key === 'technical_visual' && typeof value === 'object') return <InteractiveFrame key={key} title={slide.title} path={'/embedded.html?family=technical&visual='+encodeURIComponent(JSON.stringify(value))}/>
    if (['theory_id','idea_id','level','body_markdown'].includes(key) || value == null || (key === 'hero_title' && value === slide.title)) return null
    if (key === 'bullets' && p.hero_subtitle && Array.isArray(value) && value.length === 1 && value[0] === p.hero_subtitle) return null
    if (key === 'inline_svg' && typeof value === 'string') return <img key={key} alt={String(p.svg_caption ?? slide.title)} src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(value)}/>
    if (['src','html_path'].includes(key) && typeof value === 'string' && value.endsWith('.html')) return <InteractiveFrame key={key} title={slide.title} path={resolve(value)}/>
    if (key === 'formula' && typeof value === 'string') return <div key={key}>{markdown(`$$\n${value}\n$$`)}</div>
    if (key === 'images' && Array.isArray(value)) return <div key={key}>{value.map((img, i) => { const v = img as Record<string,string>; return <figure key={i}><img src={resolve(v.src ?? v.path ?? v.url ?? v.asset ?? '')} alt={v.alt ?? v.caption ?? slide.title}/><figcaption>{v.caption}</figcaption></figure> })}</div>
    if (typeof value === 'string') return <div key={key}>{markdown(value)}</div>
    if (Array.isArray(value)) return <div key={key}>{value.map((v,i) => typeof v === 'string' ? <div key={i}>{markdown(v)}</div> : v && typeof v === 'object' ? <div key={i}>{Object.entries(v).filter(([k]) => !['id','type'].includes(k)).map(([k,val]) => typeof val === 'string' ? <p key={k}>{/^https?:\/\//.test(val) ? <a href={val}>{String(v.title ?? '打开资料')} ↗</a> : val}</p> : null)}</div> : null)}</div>
    return null
  })}{typeof p.theory_id === 'string' && <button className="content-entry" onClick={() => onTheory(p.theory_id as string)}>深入理解这个概念 →</button>}{typeof p.idea_id === 'string' && <button className="content-entry" onClick={() => onLab(p.idea_id as string)}>打开本页互动 →</button>}{slide.audio_path && <audio controls src={resolve(slide.audio_path)}/>}<details><summary>讲解文字</summary>{markdown(slide.audio_script ?? '')}</details></div>
}
