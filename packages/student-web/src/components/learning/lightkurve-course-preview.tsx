"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { LearningScope } from "@/lib/api/learning-records"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LIGHTKURVE_SLUG, lightkurveArtifactMessage, lightkurveHref, lightkurveView, lightkurveValidationKey, lightkurveValidationMessage, lightkurveValidationState, type LightkurveArtifact, type LightkurveLabMode, type LightkurveModule, type LightkurveQuestion, type LightkurveRecordConfig, type LightkurveStage, type LightkurveView, type LightkurveValidationMessage, type LightkurveValidationState } from "@/lib/lightkurve-preview"
import type { ResponsePrompt } from "@/lib/project-lines/guided-course"
import { responseComplete } from "@/lib/project-lines/guided-response"
import type { CourseContent, KnowledgeLevel, SlideEntry } from "@/lib/types/api"
import { CourseReadingBody } from "./course-content-view"
import { CourseVideoResource } from "./course-video-resource"
import { GuidedResponsePrompt } from "./guided-response-prompt"
import { LearningRecordStatus } from "./learning-record-status"
import { SlideDeckPlayer } from "./teacher-scene-view"
import styles from "./lightkurve-course-preview.module.css"

const VIEWS = [{ id: "reading", title: "课程" }, { id: "lab", title: "动画与实验" }, { id: "slides", title: "幻灯片" }, { id: "assignment", title: "作业" }] as const
type RecordSession = ReturnType<typeof useLearningRecord>
type ArtifactCandidate = { payload: LightkurveArtifact; idea_id: string; received_at: string; owner: string }

function isLocked(record: RecordSession) { return !record.ready || record.pending || record.conflict }
function canSubmit(record: RecordSession, complete: boolean) { return complete && !isLocked(record) && !record.busy }

/** Same 1280×800 srcdoc scaling as ScaledIframe, with an opaque sandbox and a source ref. */
function ArtifactFrame({ html, title, moduleId, onArtifact, onValidation }: { html: string; title: string; moduleId: string; onArtifact: (artifact: LightkurveArtifact) => void; onValidation: (message: LightkurveValidationMessage, reply: (message: unknown) => void) => Promise<void> }) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const element = box.current!
    const resize = () => { const rect = element.getBoundingClientRect(); setScale(Math.min(rect.width / 1280, rect.height / 800)) }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    function receive(event: MessageEvent<unknown>) {
      // Never use origin: sandboxed srcdoc messages have origin "null".
      if (!frame.current || event.source !== frame.current.contentWindow) return
      const validation = lightkurveValidationMessage(event.data, moduleId)
      if (validation) {
        const source = frame.current.contentWindow
        void onValidation(validation, message => {
          if (source && frame.current?.contentWindow === source) source.postMessage(message, "*")
        })
        return
      }
      const artifact = lightkurveArtifactMessage(event.data, moduleId)
      if (artifact) onArtifact(artifact)
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [moduleId, onArtifact, onValidation])
  return <div ref={box} className={styles.frameBox}>{scale > 0 && <iframe ref={frame} srcDoc={html} title={title} sandbox="allow-scripts allow-downloads" style={{ width: 1280, height: 800, transform: `translate(-50%, -50%) scale(${scale})` }} />}</div>
}

function AssessmentRecord({ moduleId, contentVersion, questions, kind }: { moduleId: string; contentVersion: string; questions: LightkurveQuestion[]; kind: "quiz" | "exam" }) {
  const record = useLearningRecord({ library_slug: LIGHTKURVE_SLUG, module_id: moduleId, activity_id: `lightkurve-${kind}`, kind, content_version: contentVersion }, {
    answers: questions.map(question => ({ question_id: question.id, question: question.question, answer: "" })),
    client_context: { source: "lightkurve-local-preview", assessment: kind },
  })
  const [feedback, setFeedback] = useState(false)
  const complete = questions.every(question => record.body.answers.find(answer => answer.question_id === question.id)?.answer.trim())
  const label = kind === "exam" ? "阶段检验" : "理解自测"
  const choice = (index: number, option: string) => `${index + 1}. ${option}`
  const correct = questions.filter(question => record.body.answers.find(answer => answer.question_id === question.id)?.answer === choice(question.correct, question.options[question.correct])).length
  function select(questionId: string, answer: string) {
    setFeedback(false)
    record.session.update({ ...record.body, answers: record.body.answers.map(item => item.question_id === questionId ? { ...item, answer } : item) })
  }
  return <section className={styles.recordSection} data-lightkurve-assessment={kind}>
    <p className={styles.eyebrow}>{kind === "exam" ? "STAGE CHECK" : "SELF CHECK"}</p>
    <h2>{label}</h2>
    <p className={styles.note}>选择和提交尝试会单独保存。这里的答案解析仅供自查，账号提交状态为未评阅。</p>
    {questions.map((question, index) => <fieldset key={question.id} className={styles.quizQuestion} disabled={isLocked(record)}>
      <legend>{index + 1}. {question.question}</legend>
      {question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={`${kind}-${question.id}`} value={choice(optionIndex, option)} checked={record.body.answers.find(answer => answer.question_id === question.id)?.answer === choice(optionIndex, option)} onChange={event => select(question.id, event.target.value)} /><span>{option}</span></label>)}
      {feedback && <div className={styles.feedback}><strong>参考答案：{question.options[question.correct]}</strong><p>{question.explanation}</p></div>}
    </fieldset>)}
    {feedback && <p role="status" className={styles.note}>本机自查：{correct} / {questions.length}。这不是服务器评分，也不自动标记掌握。</p>}
    <div className={styles.actions}>
      <button type="button" disabled={!complete || !record.ready} onClick={() => setFeedback(true)}>查看答案解析</button>
      <button type="button" className={styles.primary} disabled={!canSubmit(record, complete)} onClick={() => void record.session.submit()}>{record.session.token ? "提交本次尝试" : "保存本次尝试到本机"}</button>
    </div>
    <LearningRecordStatus record={record} />
  </section>
}

export function LightkurveCoursePreview({ moduleId, courseTitle, modules, stages, knodeDir, content, slides, images, audio, assignment, recordConfig, contentVersion, initialView = "reading", initialLabMode = "game" }: {
  moduleId: string; courseTitle: string; modules: LightkurveModule[]; stages: LightkurveStage[]; knodeDir: string
  content: CourseContent; slides: SlideEntry[]; images: Record<string, string>; audio: Record<string, string>; assignment: string
  recordConfig: LightkurveRecordConfig; contentVersion: string; initialView?: LightkurveView; initialLabMode?: LightkurveLabMode
}) {
  const router = useRouter()
  const search = useSearchParams()
  const view = lightkurveView(search.get("view") ?? initialView)
  const requestedLabMode = (search.get("mode") ?? initialLabMode) === "animation" ? "animation" : "game"
  const [level, setLevel] = useState<KnowledgeLevel>("K1")
  const [slideIndex, setSlideIndex] = useState(0)
  const [candidate, setCandidate] = useState<ArtifactCandidate | null>(null)
  const [validationNotice, setValidationNotice] = useState<{ owner: string; message: string } | null>(null)
  const scope = (kind: LearningScope["kind"], activity: string): LearningScope => ({ library_slug: LIGHTKURVE_SLUG, module_id: moduleId, activity_id: activity, kind, content_version: contentVersion })
  const classroom = useLearningRecord(scope("classroom", "lightkurve-notebook"), {
    answers: recordConfig.questions.map((question, index) => ({ question_id: `q${index + 1}`, question, answer: "" })),
    client_context: { source: "lightkurve-local-preview" },
  })
  const delivery = useLearningRecord(scope("assignment", "lightkurve-delivery"), {
    answers: [{ question_id: "deliverable", question: recordConfig.output, answer: "" }], client_context: { source: "lightkurve-local-preview" },
  })
  const index = modules.findIndex(module => module.id === moduleId)
  const current = modules[index]
  const stage = stages.find(stage => stage.id === current.stage)
  const labIdeas = content.ideas.filter(idea => (idea.mode === "animation" || idea.mode === "game") && content.rendered_sections[idea.idea_id]?.html)
  const labIdea = labIdeas.find(idea => idea.mode === requestedLabMode) ?? labIdeas[0]
  const labMode: LightkurveLabMode = labIdea?.mode === "animation" ? "animation" : "game"
  const ideaId = labIdea?.idea_id
  const receiveArtifact = (payload: LightkurveArtifact) => {
    if (ideaId) setCandidate({ payload, idea_id: ideaId, received_at: new Date().toISOString(), owner: classroom.identity.owner })
  }
  const currentCandidate = candidate?.owner === classroom.identity.owner ? candidate : null
  const validationActive = moduleId === "M24" || moduleId === "M25"
  async function validationProtocol(message: LightkurveValidationMessage, reply: (message: unknown) => void) {
    if (!validationActive || message.moduleId !== moduleId) return
    const owner = classroom.identity.owner
    const key = lightkurveValidationKey(owner)
    const notice = (message: string) => setValidationNotice({ owner, message })
    const sameFreeze = (a: LightkurveValidationState, b: LightkurveValidationState) => JSON.stringify(a.freeze) === JSON.stringify(b.freeze)
    try {
      const raw = localStorage.getItem(key)
      let state = raw ? lightkurveValidationState(JSON.parse(raw)) : null
      if (raw && !state) throw new Error("已有冻结记录无法读取；原记录未覆盖，请先导出检查。")
      const accountArtifact = classroom.body.artifact
      const accountState = accountArtifact?.kind === "validation" ? lightkurveValidationState(accountArtifact.data) : null
      // Account restoration may bring a previously saved first result; it never replaces a different freeze.
      if (accountState && (!state || (!state.firstResult && accountState.firstResult && sameFreeze(state, accountState)))) {
        state = accountState
        localStorage.setItem(key, JSON.stringify(state))
      }
      if (message.type === "systemedu-lightkurve-checkpoint") {
        if (state?.freeze && !sameFreeze(state, message.state)) {
          notice("已保留原冻结配置；不同配置不能覆盖这次验证记录。")
        } else {
          state = state?.firstResult ? state : message.state
          // Write and read back before acknowledging or permitting access to held-out data.
          localStorage.setItem(key, JSON.stringify(state))
          const persisted = lightkurveValidationState(JSON.parse(localStorage.getItem(key) || "null"))
          if (!persisted?.freeze) throw new Error("冻结记录未能持久保存，尚未读取保留观测。")
          state = persisted
          notice(state.firstResult ? "首次结果已保留，后续结果不会覆盖它。账号保存状态见下方。" : classroom.session.token ? "冻结配置已保存到当前账号的本机草稿；账号同步状态见下方。" : "未登录：冻结配置仅保存在当前浏览器，可跨本课 M24 / M25 继续。")
        }
      }
      if (state?.freeze && !isLocked(classroom)) {
        const artifact = { kind: "validation", title: "Q4 冻结与首次验证记录", data: state }
        if (JSON.stringify(classroom.body.artifact) !== JSON.stringify(artifact)) classroom.session.update({ ...classroom.body, artifact })
      }
      if (message.type !== "systemedu-lightkurve-request-holdout") reply({ type: "systemedu-lightkurve-state", moduleId, state: state ?? { freeze: null, firstResult: null } })
      if (message.type !== "systemedu-lightkurve-request-holdout") return
      if (moduleId !== "M25") { notice("本节只保存预测；请到 M25 按冻结方法揭开 Q4。"); return }
      // A persisted freeze must exist even when this request arrives directly, without the UI workflow.
      const persisted = lightkurveValidationState(JSON.parse(localStorage.getItem(key) || "null"))
      if (!persisted?.freeze) { notice("先保存冻结配置，再打开保留观测。尚未读取 Q4 数据。"); return }
      const response = await fetch("/preview/lightkurve/media?path=practice%2Fbrowser%2Fholdout.json", { cache: "no-store" })
      if (!response.ok) throw new Error("保留观测暂时无法读取；冻结记录仍已保存，请重试。")
      const data: unknown = await response.json()
      reply({ type: "systemedu-lightkurve-holdout", moduleId, data })
      notice("已按已保存的冻结配置请求保留观测；首次结果生成后会独立保留。")
    } catch (error) {
      reply({ type: "systemedu-lightkurve-error", moduleId })
      notice(error instanceof Error ? error.message : "冻结记录未能保存，尚未读取保留观测。")
    }
  }
  const setView = (nextView: LightkurveView, mode: LightkurveLabMode = labMode) => window.history.replaceState(null, "", lightkurveHref(moduleId, nextView, mode))
  const href = (id: string) => lightkurveHref(id, view, labMode)
  const notebookComplete = recordConfig.questions.every((_, questionIndex) => responseComplete(classroom.body, questionIndex, recordConfig.response_prompts?.[questionIndex]))
  function attachArtifact() {
    if (!currentCandidate || currentCandidate.idea_id !== ideaId || isLocked(delivery)) return
    const { payload, idea_id, received_at } = currentCandidate
    delivery.session.update({ ...delivery.body, artifact: { source: "lightkurve-interactive", module_id: moduleId, payload, idea_id, received_at } })
    setView("assignment")
  }
  const deliveryPrompt: ResponsePrompt = {
    title: "让同伴能找到作品，也能查到你的依据",
    hint: "用短句即可。文件在本机时，仍需把文件本身交给验收同伴；填写路径不会上传文件。",
    example: `格式示例（请换成本人记录）：my-work/${moduleId}/evidence.json；输入是Q3；我只改了一个参数；差异仍可能来自噪声。`,
    layout: "brief",
    fields: [
      { id: "location", label: "作品文件或共享链接", type: "short", placeholder: `本节要交付：${recordConfig.output}` },
      { id: "method", label: "我用了什么输入，亲手做了哪一步", type: "text", placeholder: "写数据区段、所用规则或实际操作" },
      { id: "finding", label: "哪项证据支持我的结果", type: "text", placeholder: "写图名、数据行、数值与单位；没有测出也如实填写" },
      { id: "limit", label: "还不能确定什么", type: "short", placeholder: "写一个尚未排除的原因或下一步检查" },
    ],
  }

  return <main className={styles.page} data-lightkurve-preview={moduleId}>
    <header className={styles.header}>
      <div className={styles.headerInner}><Link href="/library">← 项目课程</Link><span>本地课程验收 · {modules.length} 个节点</span></div>
    </header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>LIGHTKURVE / TRANSIT DETECTIVE</p><p className={styles.courseTitle}>{courseTitle}</p><h1><span>{moduleId}</span>{current.title}</h1><p className={styles.stage}>{stage?.title} · 第 {index + 1} / {modules.length} 节</p></div>
      <div className={styles.selectors}>
        <label>课程节点<select aria-label="切换课程节点" value={moduleId} onChange={event => router.push(href(event.target.value))}>{stages.map(stage => <optgroup key={stage.id} label={stage.title}>{modules.filter(module => module.stage === stage.id).map(module => <option key={module.id} value={module.id}>{module.id} · {module.title}</option>)}</optgroup>)}</select></label>
        <label>理论深度<select aria-label="理论深度" value={level} onChange={event => setLevel(event.target.value as KnowledgeLevel)}><option value="K1">K1 · 直观理解</option><option value="K3">K3 · 推导与计算</option></select></label>
      </div>
    </section>
    <div className={`${styles.body} ${view === "lab" ? styles.wide : ""}`}>
      <nav aria-label="课程内容视图" className={styles.viewNav}>{VIEWS.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.title}</button>)}</nav>
      {view === "reading" && <div data-preview-reading>
        <div className={styles.readingLead}><p>本节产出 · {recordConfig.output}</p><a href="#learning-notebook">前往课堂记录 ↓</a></div>
        {!!recordConfig.foundations?.length && <section className={styles.recordSection} aria-label="按需补学基础"><h2>先确认自己会这几步</h2><p className={styles.note}>每项都有一个小检查。已经能独立完成就继续；卡住时展开例子，在实践包的 foundations.ipynb 里操作。</p>{recordConfig.foundations.map(bridge => <details key={bridge.id} className={styles.foundation}><summary>{bridge.title}</summary><div className={styles.prose}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{bridge.body_markdown}</ReactMarkdown></div></details>)}</section>}
        <CourseReadingBody content={content} projectName={LIGHTKURVE_SLUG} moduleId={moduleId} knowledgeLevel={level} />
        {!!recordConfig.resources?.length && <section className={styles.recordSection}><h2>带着问题看资料</h2>{recordConfig.resources.map(resource => resource.kind === "video" ? <CourseVideoResource key={resource.url} resource={resource} /> : <article key={resource.url} className={styles.resource}><p className={styles.eyebrow}>{resource.publisher}</p><h3><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} ↗</a></h3><p>{resource.purpose}</p><p className={styles.note}>{resource.prompt}</p><details><summary>中文阅读要点</summary><p>{resource.fallback}</p></details></article>)}</section>}
        <section id="learning-notebook" className={styles.recordSection} data-lightkurve-notebook>
          <p className={styles.eyebrow}>FIELD NOTES</p><h2>把观察写进课堂记录</h2><p className={styles.note}>先写自己的判断，再补上证据。输入会自动保存，保存位置见下方状态。</p>
          {recordConfig.questions.map((question, questionIndex) => <div key={question} className={styles.response}><h3>{questionIndex + 1}. {question}</h3><GuidedResponsePrompt body={classroom.body} index={questionIndex} prompt={recordConfig.response_prompts?.[questionIndex]} question={question} locked={isLocked(classroom)} onChange={body => classroom.session.update(body)} /></div>)}
          <button type="button" className={styles.primary} disabled={!canSubmit(classroom, notebookComplete)} onClick={() => void classroom.session.submit()}>{classroom.session.token ? "提交课堂记录" : "保存课堂记录到本机"}</button>
          <LearningRecordStatus record={classroom} />
        </section>
      </div>}
      {view === "lab" && <section id="interactive-lab" data-preview-lab>
        <div className={styles.labHeading}><div><p className={styles.eyebrow}>OBSERVE / TEST / RECORD</p><h2>{labIdea?.topic || "动画与实验"}</h2></div><div className={styles.actions}>{(["animation", "game"] as const).map(mode => <button key={mode} type="button" aria-pressed={labMode === mode} disabled={!labIdeas.some(idea => idea.mode === mode)} onClick={() => setView("lab", mode)}>{mode === "animation" ? "观看动画" : "动手实验"}</button>)}</div></div>
        {labIdea ? <><p className={styles.note}>改变参数后，使用实验里的记录按钮生成操作产物，再关联本节作业。横屏可以更清楚地查看坐标与控件。</p><div className={styles.labFrame}>{validationActive && !classroom.ready ? <div className={styles.empty}>正在读取当前身份的冻结记录。连接问题与重试入口见下方保存状态。</div> : <ArtifactFrame key={`${labIdea.idea_id}:${classroom.identity.owner}`} html={content.rendered_sections[labIdea.idea_id].html!} title={labIdea.topic} moduleId={moduleId} onArtifact={receiveArtifact} onValidation={validationProtocol} />}</div>
          {validationActive && <div className={styles.artifactBar}><div><strong>冻结与首次验证记录</strong><p role="status">{validationNotice?.owner === classroom.identity.owner ? validationNotice.message : "M24 与 M25 共用当前身份的冻结记录。先封存参数和预测，再揭示 Q4。"}</p><p>此记录帮助保留操作顺序；是否提前看过数据仍需本人如实声明。</p><LearningRecordStatus record={classroom} /></div></div>}
          <div className={styles.artifactBar}><div><strong>实验操作产物</strong><p role="status">{currentCandidate?.idea_id === labIdea.idea_id ? `已收到${typeof currentCandidate.payload.title === "string" ? `「${currentCandidate.payload.title}」` : "本次操作记录"}，尚未关联作业。` : "完成实验中的记录操作后，这里会显示可关联的产物。"}</p></div><button type="button" className={styles.primary} disabled={currentCandidate?.idea_id !== labIdea.idea_id || isLocked(delivery)} onClick={attachArtifact}>关联到本节作业</button></div>
          {currentCandidate?.idea_id === labIdea.idea_id && <details className={styles.artifactDetails}><summary>查看待关联的操作数据</summary><pre>{JSON.stringify(currentCandidate.payload, null, 2)}</pre></details>}
        </> : <div className={styles.empty}>本节点未提供{labMode === "animation" ? "动画" : "动手实验"}。请切换到可用的模式，或继续阅读课程。</div>}
      </section>}
      {view === "slides" && <section className={styles.slides} data-preview-slides>{slides.length ? <SlideDeckPlayer deck={{ slides, ideas: content.ideas, renderedSections: content.rendered_sections, knodeDir }} projectName={LIGHTKURVE_SLUG} moduleId={moduleId} currentIndex={slideIndex} onIndexChange={setSlideIndex} layout="content" autoPlay={false} previewImageSources={images} previewAudioSources={audio} /> : <p className={styles.empty}>本节点暂无幻灯片。</p>}</section>}
      {view === "assignment" && <section data-preview-assignment>
        <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{assignment}</ReactMarkdown></div>
        <a className={styles.download} href="/preview/lightkurve/media?path=downloads%2Flightkurve-practice-kit.zip" download="lightkurve-practice-kit.zip">下载 Lightkurve 实践包 ↓</a>
        <section className={styles.recordSection} data-lightkurve-delivery>
          <p className={styles.eyebrow}>YOUR EVIDENCE</p><h2>提交本节作品</h2><p className={styles.note}>{recordConfig.output}</p>
          <GuidedResponsePrompt body={delivery.body} index={0} prompt={deliveryPrompt} question="作品说明与证据" locked={isLocked(delivery)} onChange={body => delivery.session.update(body)} />
          {delivery.body.artifact ? <div className={styles.attachedArtifact}><strong>已关联实验操作产物</strong><p className={styles.note}>产物随本节作业一起保存，账号同步结果见下方状态。</p><details><summary>查看操作数据</summary><pre>{JSON.stringify(delivery.body.artifact, null, 2)}</pre></details><button type="button" disabled={isLocked(delivery)} onClick={() => delivery.session.update({ ...delivery.body, artifact: null })}>移除关联</button></div> : labIdeas.some(idea => idea.mode === "game") ? <p className={styles.note}>还没有关联实验产物。<button type="button" className={styles.textButton} onClick={() => setView("lab", "game")}>前往动手实验 →</button></p> : <p className={styles.note}>本节以实际文件、Notebook 或复查记录为作品；请在上方写明位置与证据。</p>}
          <button type="button" className={styles.primary} disabled={!canSubmit(delivery, responseComplete(delivery.body, 0, deliveryPrompt))} onClick={() => void delivery.session.submit()}>{delivery.session.token ? "提交本节作业" : "保存本节作业到本机"}</button>
          <LearningRecordStatus record={delivery} />
        </section>
        {!!recordConfig.quiz.length && <AssessmentRecord moduleId={moduleId} contentVersion={contentVersion} questions={recordConfig.quiz} kind="quiz" />}
        {!!recordConfig.exam?.length && <AssessmentRecord moduleId={moduleId} contentVersion={contentVersion} questions={recordConfig.exam} kind="exam" />}
      </section>}
      <nav aria-label="顺序浏览课程" className={styles.footer}>{index > 0 ? <Link href={href(modules[index - 1].id)}>← {modules[index - 1].id} 上一节</Link> : <span />}<span>{index + 1} / {modules.length}</span>{index + 1 < modules.length ? <Link href={href(modules[index + 1].id)}>{modules[index + 1].id} 下一节 →</Link> : <span>本课程终点</span>}</nav>
    </div>
  </main>
}
