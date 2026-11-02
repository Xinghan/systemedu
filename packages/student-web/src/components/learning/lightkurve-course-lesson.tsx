"use client"

import { lightkurveChoiceIndex } from "@/lib/lightkurve-language-revision"

import Link from "next/link"
import { missionContext } from "@/lib/project-lines/space-curriculum"
import { MissionLessonBrief, MissionLessonFooter } from "@/components/mission/space-mission-lesson"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { LearningScope } from "@/lib/api/learning-records"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LIGHTKURVE_SLUG, lightkurveArtifactMessage, lightkurveValidationKey, lightkurveValidationMessage, lightkurveValidationState, type LightkurveArtifact, type LightkurveValidationMessage, type LightkurveValidationState, type LightkurveLabMode, type LightkurveModule, type LightkurveQuestion, type LightkurveRecordConfig, type LightkurveStage, type LightkurveView } from "@/lib/lightkurve-preview"
import { lightkurveClassroomTarget } from "@/lib/lightkurve-classroom"
import type { ResponsePrompt } from "@/lib/project-lines/guided-course"
import { responseComplete } from "@/lib/project-lines/guided-response"
import type { CourseContent, KnodeInfo, KnowledgeLevel, SlideEntry } from "@/lib/types/api"
import { CourseContentView } from "./course-content-view"
import { LightkurveMaterialLink } from "./lightkurve-material-link"
import { getToken } from "@/lib/auth"
import { lightkurveFile } from "@/lib/lightkurve-course-links"
import { CourseMediaContext } from "./course-media-context"
import { CourseVideoResource } from "./course-video-resource"
import { GuidedResponsePrompt } from "./guided-response-prompt"
import { LearningRecordStatus } from "./learning-record-status"
import styles from "./lightkurve-course-lesson.module.css"

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

function FoundationBody({ markdown }: { markdown: string }) {
  // Authored foundations use a small disclosure for worked answers. Keep raw
  // HTML disabled; render only this known wrapper as a native React element.
  const parts = markdown.split(/(<details>\s*<summary>[\s\S]*?<\/summary>[\s\S]*?<\/details>)/g)
  return <>{parts.map((part, index) => {
    const disclosure = /^<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>$/.exec(part)
    const body = <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{disclosure ? disclosure[2].trim() : part}</ReactMarkdown>
    return disclosure ? <details key={index} className={styles.foundation}><summary>{disclosure[1].trim()}</summary>{body}</details> : <div key={index}>{body}</div>
  })}</>
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
  const selected = (question: LightkurveQuestion) => lightkurveChoiceIndex(moduleId, contentVersion, kind, question.id, question.options, record.body.answers.find(answer => answer.question_id === question.id)?.answer ?? "")
  const correct = questions.filter(question => selected(question) === question.correct).length
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
      {question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={`${kind}-${question.id}`} value={choice(optionIndex, option)} checked={selected(question) === optionIndex} onChange={event => select(question.id, event.target.value)} /><span>{option}</span></label>)}
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

export interface LightkurveCourseLessonProps {
  published?: boolean; downloadControl?: ReactNode
  holdoutUrl?: string
  moduleId: string; courseTitle: string; modules: LightkurveModule[]; stages: LightkurveStage[]; plannedNodes?: number; knodeDir: string
  content: CourseContent; slides: SlideEntry[]; images: Record<string, string>; audio: Record<string, string>; assignment: string
  recordConfig: LightkurveRecordConfig; contentVersion: string; initialView?: LightkurveView; initialLabMode?: LightkurveLabMode
}

/** Both local review and published courses use the established classroom. */
export function LightkurveCourseLesson({ moduleId, courseTitle, modules, stages, knodeDir, content, slides, assignment, recordConfig, contentVersion, initialView = "reading", initialLabMode = "game", published = false, downloadControl, images, audio, holdoutUrl = "/preview/lightkurve/media?path=practice%2Fbrowser%2Fholdout.json" }: LightkurveCourseLessonProps) {
  const router = useRouter()
  const search = useSearchParams()
  const mission = missionContext(LIGHTKURVE_SLUG,moduleId,search.get("mission")==="space")
  const [level, setLevel] = useState<KnowledgeLevel>("K1")
  const [candidate, setCandidate] = useState<ArtifactCandidate | null>(null)
  const offeredLevels = (["K1", "K2", "K3", "K4", "K5"] as KnowledgeLevel[]).filter(candidate => candidate === "K1" || content.theories?.some(theory => theory.level_bodies?.some(body => body.level === candidate)))
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
  const href = (id: string) => `${published ? `/learn/${LIGHTKURVE_SLUG}` : "/preview/lightkurve"}/${encodeURIComponent(id)}${mission?"?mission=space":""}`
  const classroomContent = content
  const data = useMemo(() => ({ status: "ready" as const, course_content: classroomContent, slides: slides.map(slide => ({...slide, payload: {...slide.payload, images: slide.payload.images?.map(image => ({...image, src: images[image.src] || image.src}))}})), knode_dir: knodeDir }), [classroomContent, slides, knodeDir, images])
  const knode: KnodeInfo = { id: 0, module_id: moduleId, title: current.title, summary: recordConfig.output, difficulty_level: 0, content_type: "lesson", acceptance_type: "artifact", estimated_minutes: 0, xp_reward: 0, prerequisite_indices: [] }
  const target = lightkurveClassroomTarget(content, search.get("view") ?? initialView, (search.get("mode") ?? initialLabMode) === "animation" ? "animation" : "game")
  useEffect(() => { if (target) document.getElementById(target)?.scrollIntoView({ block: "center" }) }, [target])
  const labIdeas = content.ideas.filter(idea => (idea.mode === "animation" || idea.mode === "game") && content.rendered_sections[idea.idea_id]?.html)
  const [validationNotice, setValidationNotice] = useState<{ owner: string; message: string } | null>(null)
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
      if (raw && !state) throw new Error("已有方法记录无法读取。请先导出检查，原记录仍然保留。")
      const accountArtifact = classroom.body.artifact
      const accountState = accountArtifact?.kind === "validation" ? lightkurveValidationState(accountArtifact.data) : null
      // Account restoration may bring a previously saved first result; it never replaces a different freeze.
      if (accountState && (!state || (!state.firstResult && accountState.firstResult && sameFreeze(state, accountState)))) {
        state = accountState
        localStorage.setItem(key, JSON.stringify(state))
      }
      if (message.type === "systemedu-lightkurve-checkpoint") {
        if (state?.freeze && !sameFreeze(state, message.state)) {
          notice("已保留首次配置。新的参数不能覆盖这次检验记录。")
        } else {
          state = state?.firstResult ? state : message.state
          // Write and read back before acknowledging or permitting access to held-out data.
          localStorage.setItem(key, JSON.stringify(state))
          const persisted = lightkurveValidationState(JSON.parse(localStorage.getItem(key) || "null"))
          if (!persisted?.freeze) throw new Error("方法记录尚未保存成功，因此还没有读取 Q4。")
          state = persisted
          notice(state.firstResult ? "首次结果已保留，后续结果不会覆盖它。账号保存状态见下方。" : classroom.session.token ? "分析配置已保存为当前账号的本机草稿；同步状态见下方。" : "未登录：分析配置保存在当前浏览器，可在本课 M24、M25 之间继续使用。")
        }
      }
      if (state?.freeze && !isLocked(classroom)) {
        const artifact = { kind: "validation", title: "Q4 分析配置与首次检验结果", data: state }
        if (JSON.stringify(classroom.body.artifact) !== JSON.stringify(artifact)) classroom.session.update({ ...classroom.body, artifact })
      }
      if (message.type !== "systemedu-lightkurve-request-holdout") reply({ type: "systemedu-lightkurve-state", moduleId, state: state ?? { freeze: null, firstResult: null } })
      if (message.type !== "systemedu-lightkurve-request-holdout") return
      if (moduleId !== "M25") { notice("本节只保存预测；请到 M25 按已记录的方法查看 Q4。"); return }
      // A persisted freeze must exist even when this request arrives directly, without the UI workflow.
      const persisted = lightkurveValidationState(JSON.parse(localStorage.getItem(key) || "null"))
      if (!persisted?.freeze) { notice("请先保存分析配置，再查看 Q4。目前尚未读取 Q4 数据。"); return }
      const token = getToken()
      const response = published ? await lightkurveFile("practice/browser/holdout.json", token || "") : await fetch(holdoutUrl, { cache: "no-store" })
      if (!response.ok) throw new Error("Q4 观测暂时无法读取；分析配置仍已保存，请重试。")
      const data: unknown = await response.json()
      reply({ type: "systemedu-lightkurve-holdout", moduleId, data })
      notice("已按保存的配置请求 Q4 观测；首次结果生成后会单独保留。")
    } catch (error) {
      reply({ type: "systemedu-lightkurve-error", moduleId })
      notice(error instanceof Error ? error.message : "分析配置未能保存，因此尚未读取 Q4。")
    }
  }

  const notebookComplete = recordConfig.questions.every((_, questionIndex) => responseComplete(classroom.body, questionIndex, recordConfig.response_prompts?.[questionIndex]))
  function attachArtifact() {
    if (!currentCandidate || isLocked(delivery)) return
    const { payload, idea_id, received_at } = currentCandidate
    delivery.session.update({ ...delivery.body, artifact: { source: "lightkurve-interactive", module_id: moduleId, payload, idea_id, received_at } })
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
  const beforeContent = <div className={styles.records}>
        {!!recordConfig.foundations?.length && <section className={styles.recordSection} aria-label="按需补学基础"><h2>先确认自己会这几步</h2><p className={styles.note}>每项都有一个小检查。已经能独立完成就继续；卡住时展开例子，再按本节指引使用实践包操作。</p>{recordConfig.foundations.map(bridge => <details key={bridge.id} className={styles.foundation}><summary>{bridge.title}</summary><div className={styles.prose}><FoundationBody markdown={bridge.body_markdown} /></div></details>)}</section>}

  </div>
  const afterContent = <div className={styles.records}>
        {!!recordConfig.resources?.length && <section className={styles.recordSection}><h2>带着问题看资料</h2>{recordConfig.resources.map(resource => resource.kind === "video" ? <CourseVideoResource key={resource.url} resource={resource} /> : <article key={resource.url} className={styles.resource}><p className={styles.eyebrow}>{resource.publisher}</p><h3><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} ↗</a></h3><p>{resource.purpose}</p><p className={styles.note}>{resource.prompt}</p><details><summary>中文阅读要点</summary><p>{resource.fallback}</p></details></article>)}</section>}
        <section id="learning-notebook" className={styles.recordSection} data-lightkurve-notebook>
          <p className={styles.eyebrow}>FIELD NOTES</p><h2>把观察写进课堂记录</h2><p className={styles.note}>先写自己的判断，再补上证据。输入会自动保存，保存位置见下方状态。</p>
          {recordConfig.questions.map((question, questionIndex) => <div key={question} className={styles.response}><h3>{questionIndex + 1}. {question}</h3><GuidedResponsePrompt body={classroom.body} index={questionIndex} prompt={recordConfig.response_prompts?.[questionIndex]} question={question} locked={isLocked(classroom)} onChange={body => classroom.session.update(body)} /></div>)}
          <button type="button" className={styles.primary} disabled={!canSubmit(classroom, notebookComplete)} onClick={() => void classroom.session.submit()}>{classroom.session.token ? "提交课堂记录" : "保存课堂记录到本机"}</button>
          <LearningRecordStatus record={classroom} />
        </section>
  </div>
  const assignmentContent = <section id="course-assignment" className={styles.records} data-node-assignment>
    <h2 className="text-2xl font-semibold">本节作业与学习记录</h2>
    <div id="course-downloads" className="scroll-mt-24">
      {downloadControl || <a className={styles.download} href="/preview/lightkurve/media?path=downloads%2Flightkurve-practice-kit.zip" download="lightkurve-practice-kit.zip">下载 Lightkurve 实践包 ↓</a>}
    </div>
        <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{a:({href,children}) => href?.startsWith("/preview/lightkurve/") ? <LightkurveMaterialLink href={href}>{children}</LightkurveMaterialLink> : <a href={href}>{children}</a>}}>{assignment}</ReactMarkdown></div>
        <section className={styles.recordSection} data-lightkurve-delivery>
          <p className={styles.eyebrow}>YOUR EVIDENCE</p><h2>提交本节作品</h2><p className={styles.note}>{recordConfig.output}</p>
          <GuidedResponsePrompt body={delivery.body} index={0} prompt={deliveryPrompt} question="作品说明与证据" locked={isLocked(delivery)} onChange={body => delivery.session.update(body)} />
          {delivery.body.artifact ? <div className={styles.attachedArtifact}><strong>已关联实验操作产物</strong><p className={styles.note}>产物随本节作业一起保存，账号同步结果见下方状态。</p><details><summary>查看操作数据</summary><pre>{JSON.stringify(delivery.body.artifact, null, 2)}</pre></details><button type="button" disabled={isLocked(delivery)} onClick={() => delivery.session.update({ ...delivery.body, artifact: null })}>移除关联</button></div> : labIdeas.some(idea => idea.mode === "game") ? <p className={styles.note}>还没有关联实验产物。<button type="button" className={styles.textButton} onClick={() => document.getElementById(`idea-${labIdeas.find(idea => idea.mode === "game")?.idea_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>前往动手实验 →</button></p> : <p className={styles.note}>本节以实际文件、Notebook 或复查记录为作品；请在上方写明位置与证据。</p>}
          <button type="button" className={styles.primary} disabled={!canSubmit(delivery, responseComplete(delivery.body, 0, deliveryPrompt))} onClick={() => void delivery.session.submit()}>{delivery.session.token ? "提交本节作业" : "保存本节作业到本机"}</button>
          <LearningRecordStatus record={delivery} />
        </section>
        {!!recordConfig.quiz.length && <AssessmentRecord moduleId={moduleId} contentVersion={contentVersion} questions={recordConfig.quiz} kind="quiz" />}
        {!!recordConfig.exam?.length && <AssessmentRecord moduleId={moduleId} contentVersion={contentVersion} questions={recordConfig.exam} kind="exam" />}
  </section>

  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]" data-lightkurve-classroom={moduleId}>
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8">
      {mission && <MissionLessonBrief context={mission}/>}
      <nav aria-label="课程位置" className="mb-5 flex flex-wrap items-center gap-3 text-sm text-[var(--sub)]">
        <Link href={`/library/${LIGHTKURVE_SLUG}${mission ? `?mission=space&node=${moduleId}` : ""}`}>← {courseTitle}</Link><span> / {stage?.title} · {moduleId}</span>
      </nav>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-auto lg:self-start" aria-label="课程目录">
          <label className="mb-4 block text-sm">课程节点<select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3" aria-label="切换课程节点" value={moduleId} onChange={event => router.push(href(event.target.value))}>{stages.map(stage => <optgroup key={stage.id} label={stage.title}>{modules.filter(module => module.stage === stage.id).map(module => <option key={module.id} value={module.id}>{module.id} · {module.title}</option>)}</optgroup>)}</select></label>
          <label className="mb-5 block text-sm">理论深度<select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3" aria-label="理论深度" value={level} onChange={event => setLevel(event.target.value as KnowledgeLevel)}>{offeredLevels.map(value => <option key={value} value={value}>{value} · {({ K1: "直观理解", K2: "建立联系", K3: "基础推导与计算", K4: "进阶数学与模型", K5: "深入研究" })[value]}</option>)}</select></label>
          <div className="hidden lg:block">{stages.map(stage => <details key={stage.id} open={stage.id === current.stage} className="border-t border-[var(--border)] py-3"><summary className="cursor-pointer text-sm font-semibold">{stage.title}</summary>{modules.filter(module => module.stage === stage.id).map(module => <Link key={module.id} href={href(module.id)} aria-current={module.id === moduleId ? "page" : undefined} className={`mt-2 block rounded-lg p-3 text-sm leading-relaxed ${module.id === moduleId ? "bg-[var(--primary-soft)] text-[var(--primary-ink)]" : "text-[var(--sub)] hover:bg-[var(--card)]"}`}><span className="mr-2 font-mono text-xs">{module.id}</span>{module.title}</Link>)}</details>)}</div>
        </aside>
        <div className="min-w-0" data-unified-course>
          <CourseMediaContext.Provider value={{ initialIdeaId: target?.startsWith("idea-") ? target.slice(5) : undefined,
            renderFrame: (idea, html) => <div className="flex h-full min-h-0 flex-col" data-lightkurve-experiment={idea.idea_id}>
              <div className="min-h-0 flex-1">{validationActive && !classroom.ready ? <p>正在恢复已保存的方法记录…</p> : <ArtifactFrame key={`${idea.idea_id}:${classroom.identity.owner}:${contentVersion}`} html={html} title={idea.topic} moduleId={moduleId}
                onArtifact={payload => setCandidate({ payload, idea_id: idea.idea_id, received_at: new Date().toISOString(), owner: classroom.identity.owner })} onValidation={validationProtocol} />}</div>
              {validationActive && <div className="max-h-[25vh] overflow-auto bg-[var(--paper)] p-3 text-[var(--ink)]"><p role="status">{validationNotice?.owner === classroom.identity.owner ? validationNotice.message : "先保存参数和预测，再到 M25 查看 Q4。首次结果会单独保留。"}</p><LearningRecordStatus record={classroom}/></div>}
              {idea.mode === "game" && <div className={`max-h-[30vh] shrink-0 overflow-auto bg-[var(--paper)] p-3 text-[var(--ink)] ${styles.records}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{currentCandidate?.idea_id === idea.idea_id ? "已收到本次操作记录，可以关联到本节作业。" : "在实验中生成操作记录后，可关联到本节作业。"}</p><button type="button" className={styles.primary} disabled={currentCandidate?.idea_id !== idea.idea_id || isLocked(delivery)} onClick={attachArtifact}>关联到本节作业</button></div>
                {delivery.body.artifact && <p className="mt-2 text-sm">已关联实验操作产物</p>}<LearningRecordStatus record={delivery} />
              </div>}
            </div> }}>
            <CourseContentView projectName={LIGHTKURVE_SLUG} nodeId={0} knode={knode} knowledgeLevel={level} onClose={() => router.push(`/library/${LIGHTKURVE_SLUG}${mission ? `?mission=space&node=${moduleId}` : ""}`)}
              preparedLesson={{ data, beforeContent, afterContent, assignment: assignmentContent, previewAudioSources: audio }} />
          </CourseMediaContext.Provider>
          <nav aria-label="顺序浏览课程" className="mt-8 flex justify-between gap-4 border-t border-[var(--border)] px-4 py-6 text-sm">{index > 0 ? <Link href={href(modules[index - 1].id)}>← {modules[index - 1].id} 上一节</Link> : <span />}<span>{index + 1} / {modules.length}</span>{index + 1 < modules.length ? <Link href={href(modules[index + 1].id)}>{modules[index + 1].id} 下一节 →</Link> : <span>本课程终点</span>}</nav>
        </div>
      </div>
    </div>
    {mission && <MissionLessonFooter context={mission}/>}
  </main>
}
