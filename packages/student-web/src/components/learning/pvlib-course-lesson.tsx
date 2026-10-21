"use client"

import Link from "next/link"
import { energyContext } from "@/lib/project-lines/energy-mission"
import { EnergyLessonBrief, EnergyLessonFooter } from "@/components/mission/energy-mission-lesson"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { LearningScope } from "@/lib/api/learning-records"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { PVLIB_SLUG, pvlibArtifactMessage, pvlibArtifactReady, pvlibSavedArtifact, pvlibIdeaLabMode, pvlibLabMode, type PvlibArtifact, type PvlibLabMode, type PvlibModule, type PvlibQuestion, type PvlibRecordConfig, type PvlibStage, type PvlibView } from "@/lib/pvlib-preview"
import { pvlibClassroomContent, pvlibClassroomTarget } from "@/lib/pvlib-classroom"
import type { ResponsePrompt } from "@/lib/project-lines/guided-course"
import { responseComplete } from "@/lib/project-lines/guided-response"
import type { CourseContent, KnodeInfo, KnowledgeLevel, SlideEntry } from "@/lib/types/api"
import { CourseContentView } from "./course-content-view"
import { CourseMediaContext } from "./course-media-context"
import { CourseVideoResource } from "./course-video-resource"
import { GuidedResponsePrompt } from "./guided-response-prompt"
import { LearningRecordStatus } from "./learning-record-status"
import styles from "./pvlib-course-lesson.module.css"

type RecordSession = ReturnType<typeof useLearningRecord>
type ArtifactCandidate = { payload: PvlibArtifact; idea_id: string; received_at: string; owner: string }

function isLocked(record: RecordSession) { return !record.ready || record.pending || record.conflict }
function canSubmit(record: RecordSession, complete: boolean) { return complete && !isLocked(record) && !record.busy }

/** Same 1280×800 srcdoc scaling as ScaledIframe, with an opaque sandbox and a source ref. */
function ArtifactFrame({ html, title, moduleId, ideaId, savedArtifact, onArtifact }: { html: string; title: string; moduleId: string; ideaId: string; savedArtifact?: PvlibArtifact | null; onArtifact?: (artifact: PvlibArtifact) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0)
  const [restoreReady, setRestoreReady] = useState(false)
  const restored = useRef<string | null>(null)
  useEffect(() => {
    const element = box.current!
    const resize = () => { const rect = element.getBoundingClientRect(); setScale(Math.min(rect.width / 1280, rect.height / 800)) }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!onArtifact) return
    function receive(event: MessageEvent<unknown>) {
      // Never use origin: sandboxed srcdoc messages have origin "null".
      if (!frame.current || event.source !== frame.current.contentWindow) return
      if (pvlibArtifactReady(event.data, moduleId, ideaId)) {
        setRestoreReady(true)
        return
      }
      const artifact = pvlibArtifactMessage(event.data, moduleId)
      if (artifact) onArtifact?.(artifact)
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [moduleId, ideaId, onArtifact])
  useEffect(() => {
    // The child may be ready before the account record arrives. Send only the
    // saved payload after both are ready, never the account token or answers.
    if (!restoreReady || !savedArtifact || !onArtifact) return
    const signature = JSON.stringify(savedArtifact)
    if (restored.current === signature) return
    restored.current = signature
    frame.current?.contentWindow?.postMessage({ type: "systemedu-pvlib-artifact-restore", module_id: moduleId, idea_id: ideaId, artifact: savedArtifact }, "*")
  }, [restoreReady, savedArtifact, moduleId, ideaId, onArtifact])
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

function AssessmentRecord({ moduleId, contentVersion, questions, kind }: { moduleId: string; contentVersion: string; questions: PvlibQuestion[]; kind: "quiz" | "exam" }) {
  const record = useLearningRecord({ library_slug: PVLIB_SLUG, module_id: moduleId, activity_id: `pvlib-${kind}`, kind, content_version: contentVersion }, {
    answers: questions.map(question => ({ question_id: question.id, question: question.question, answer: "" })),
    client_context: { source: "pvlib-course", assessment: kind },
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
  return <section className={styles.recordSection} data-pvlib-assessment={kind}>
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

export interface PvlibCourseLessonProps {
  published?: boolean; downloadControl?: ReactNode
  moduleId: string; courseTitle: string; modules: PvlibModule[]; stages: PvlibStage[]; plannedNodes?: number; knodeDir: string
  content: CourseContent; slides: SlideEntry[]; images: Record<string, string>; audio: Record<string, string>; assignment: string
  recordConfig: PvlibRecordConfig; contentVersion: string; initialView?: PvlibView; initialLabMode?: PvlibLabMode
}

/** Both local review and published courses use the established classroom. */
export function PvlibCourseLesson({ moduleId, courseTitle, modules, stages, knodeDir, content, slides, assignment, recordConfig, contentVersion, initialView = "reading", initialLabMode = "game", published = false, downloadControl }: PvlibCourseLessonProps) {
  const router = useRouter()
  const search = useSearchParams()
  const energy = energyContext(PVLIB_SLUG,moduleId,search.get("mission")==="energy")
  const [level, setLevel] = useState<KnowledgeLevel>("K1")
  const [candidate, setCandidate] = useState<ArtifactCandidate | null>(null)
  const offeredLevels = (["K1", "K2", "K3", "K4", "K5"] as KnowledgeLevel[]).filter(candidate => candidate === "K1" || content.theories?.some(theory => theory.level_bodies?.some(body => body.level === candidate)))
  const scope = (kind: LearningScope["kind"], activity: string): LearningScope => ({ library_slug: PVLIB_SLUG, module_id: moduleId, activity_id: activity, kind, content_version: contentVersion })
  const classroom = useLearningRecord(scope("classroom", "pvlib-notebook"), {
    answers: recordConfig.questions.map((question, index) => ({ question_id: `q${index + 1}`, question, answer: "" })),
    client_context: { source: "pvlib-course" },
  })
  const delivery = useLearningRecord(scope("assignment", "pvlib-delivery"), {
    answers: [{ question_id: "deliverable", question: recordConfig.output, answer: "" }], client_context: { source: "pvlib-course" },
  })

  const index = modules.findIndex(module => module.id === moduleId)
  const current = modules[index]
  const stage = stages.find(stage => stage.id === current.stage)
  const href = (id: string) => `${published ? `/learn/${PVLIB_SLUG}` : "/preview/pvlib"}/${encodeURIComponent(id)}${energy?"?mission=energy":""}`
  const classroomContent = useMemo(() => pvlibClassroomContent(content), [content])
  const data = useMemo(() => ({ status: "ready" as const, course_content: classroomContent, slides, knode_dir: knodeDir }), [classroomContent, slides, knodeDir])
  const knode: KnodeInfo = { id: 0, module_id: moduleId, title: current.title, summary: recordConfig.output, difficulty_level: 0, content_type: "lesson", acceptance_type: "artifact", estimated_minutes: 0, xp_reward: 0, prerequisite_indices: [] }
  const target = pvlibClassroomTarget(content, search.get("view") ?? initialView, pvlibLabMode(search.get("mode") ?? initialLabMode))
  useEffect(() => { if (target) document.getElementById(target)?.scrollIntoView({ block: "center" }) }, [target])
  const labIdeas = content.ideas.filter(idea => pvlibIdeaLabMode(idea) && content.rendered_sections[idea.idea_id]?.html)
  const currentCandidate = candidate?.owner === classroom.identity.owner ? candidate : null
  const notebookComplete = recordConfig.questions.every((_, questionIndex) => responseComplete(classroom.body, questionIndex, recordConfig.response_prompts?.[questionIndex]))
  function attachArtifact() {
    if (!currentCandidate || isLocked(delivery)) return
    const { payload, idea_id, received_at } = currentCandidate
    delivery.session.update({ ...delivery.body, artifact: { source: "pvlib-interactive", module_id: moduleId, payload, idea_id, received_at } })
  }
  const deliveryPrompt: ResponsePrompt = {
    title: "让同伴能找到作品，也能查到你的依据",
    hint: "用短句即可。文件在本机时，仍需把文件本身交给验收同伴；填写路径不会上传文件。",
    example: `格式示例（请换成本人记录）：my-work/${moduleId}/evidence.json；输入是带时区的气象表；我核对了时间与单位；模型结果仍需要实测数据检验。`,
    layout: "brief",
    fields: [
      { id: "location", label: "作品文件或共享链接", type: "short", placeholder: `本节要交付：${recordConfig.output}` },
      { id: "method", label: "我用了什么输入，亲手做了哪一步", type: "text", placeholder: "写数据来源、时间与单位、模型设置或实际操作" },
      { id: "finding", label: "哪项证据支持我的结果", type: "text", placeholder: "写图名、数据行、数值与单位；没有测出也如实填写" },
      { id: "limit", label: "还不能确定什么", type: "short", placeholder: "写一个尚未排除的原因或下一步检查" },
    ],
  }
  const beforeContent = <div className={styles.records}>
        {!!recordConfig.foundations?.length && <section className={styles.recordSection} aria-label="按需补学基础"><h2>先确认自己会这几步</h2><p className={styles.note}>每项都有一个小检查。已经能独立完成就继续；卡住时展开例子，再按本节指引使用实践包操作。</p>{recordConfig.foundations.map(bridge => <details key={bridge.id} className={styles.foundation}><summary>{bridge.title}</summary><div className={styles.prose}><FoundationBody markdown={bridge.body_markdown} /></div></details>)}</section>}

  </div>
  const afterContent = <div className={styles.records}>
        {!!recordConfig.resources?.length && <section className={styles.recordSection}><h2>带着问题看资料</h2>{recordConfig.resources.map(resource => resource.kind === "video" ? <CourseVideoResource key={resource.url} resource={resource} /> : <article key={resource.url} className={styles.resource}><p className={styles.eyebrow}>{resource.publisher}</p><h3><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} ↗</a></h3><p>{resource.purpose}</p><p className={styles.note}>{resource.prompt}</p><details><summary>中文阅读要点</summary><p>{resource.fallback}</p></details></article>)}</section>}
        <section id="learning-notebook" className={styles.recordSection} data-pvlib-notebook>
          <p className={styles.eyebrow}>FIELD NOTES</p><h2>把观察写进课堂记录</h2><p className={styles.note}>先写自己的判断，再补上证据。输入会自动保存，保存位置见下方状态。</p>
          {recordConfig.questions.map((question, questionIndex) => <div key={question} className={styles.response}><h3>{questionIndex + 1}. {question}</h3><GuidedResponsePrompt body={classroom.body} index={questionIndex} prompt={recordConfig.response_prompts?.[questionIndex]} question={question} locked={isLocked(classroom)} onChange={body => classroom.session.update(body)} /></div>)}
          <button type="button" className={styles.primary} disabled={!canSubmit(classroom, notebookComplete)} onClick={() => void classroom.session.submit()}>{classroom.session.token ? "提交课堂记录" : "保存课堂记录到本机"}</button>
          <LearningRecordStatus record={classroom} />
        </section>
  </div>
  const assignmentContent = <section id="course-assignment" className={styles.records} data-node-assignment>
    <h2 className="text-2xl font-semibold">本节作业与学习记录</h2>
    <div id="course-downloads" className="scroll-mt-24">
      {downloadControl || <a className={styles.download} href="/preview/pvlib/media?path=downloads%2Fpvlib-practice-kit.zip" download="pvlib-practice-kit.zip">下载 pvlib 实践包 ↓</a>}
    </div>
        <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{assignment}</ReactMarkdown></div>
        <section className={styles.recordSection} data-pvlib-delivery>
          <p className={styles.eyebrow}>YOUR EVIDENCE</p><h2>提交本节作品</h2><p className={styles.note}>{recordConfig.output}</p>
          <GuidedResponsePrompt body={delivery.body} index={0} prompt={deliveryPrompt} question="作品说明与证据" locked={isLocked(delivery)} onChange={body => delivery.session.update(body)} />
          {delivery.body.artifact ? <div className={styles.attachedArtifact}><strong>已关联实验操作产物</strong><p className={styles.note}>产物随本节作业一起保存，账号同步结果见下方状态。</p><details><summary>查看操作数据</summary><pre>{JSON.stringify(delivery.body.artifact, null, 2)}</pre></details><button type="button" disabled={isLocked(delivery)} onClick={() => delivery.session.update({ ...delivery.body, artifact: null })}>移除关联</button></div> : labIdeas.some(idea => idea.mode === "game") ? <p className={styles.note}>还没有关联实验产物。<button type="button" className={styles.textButton} onClick={() => document.getElementById(`idea-${labIdeas.find(idea => idea.mode === "game")?.idea_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>前往动手实验 →</button></p> : <p className={styles.note}>本节以实际文件、Notebook 或复查记录为作品；请在上方写明位置与证据。</p>}
          <button type="button" className={styles.primary} disabled={!canSubmit(delivery, responseComplete(delivery.body, 0, deliveryPrompt))} onClick={() => void delivery.session.submit()}>{delivery.session.token ? "提交本节作业" : "保存本节作业到本机"}</button>
          <LearningRecordStatus record={delivery} />
        </section>
        {!!recordConfig.quiz.length && <AssessmentRecord moduleId={moduleId} contentVersion={contentVersion} questions={recordConfig.quiz} kind="quiz" />}
        {!!recordConfig.exam?.length && <AssessmentRecord moduleId={moduleId} contentVersion={contentVersion} questions={recordConfig.exam} kind="exam" />}
  </section>

  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]" data-pvlib-classroom={moduleId}>
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8">
      {energy && <EnergyLessonBrief context={energy}/>}
      <nav aria-label="课程位置" className="mb-5 flex flex-wrap items-center gap-3 text-sm text-[var(--sub)]">
        <Link href={`/library/${PVLIB_SLUG}${energy ? `?mission=energy&node=${moduleId}` : ""}`}>← {courseTitle}</Link><span> / {stage?.title} · {moduleId}</span>
      </nav>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-auto lg:self-start" aria-label="课程目录">
          <label className="mb-4 block text-sm">课程节点<select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3" aria-label="切换课程节点" value={moduleId} onChange={event => router.push(href(event.target.value))}>{stages.map(stage => <optgroup key={stage.id} label={stage.title}>{modules.filter(module => module.stage === stage.id).map(module => <option key={module.id} value={module.id}>{module.id} · {module.title}</option>)}</optgroup>)}</select></label>
          <label className="mb-5 block text-sm">理论深度<select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3" aria-label="理论深度" value={level} onChange={event => setLevel(event.target.value as KnowledgeLevel)}>{offeredLevels.map(value => <option key={value} value={value}>{value} · {({ K1: "直观理解", K2: "建立联系", K3: "基础推导与计算", K4: "进阶数学与模型", K5: "深入研究" })[value]}</option>)}</select></label>
          <div className="hidden lg:block">{stages.map(stage => <details key={stage.id} open={stage.id === current.stage} className="border-t border-[var(--border)] py-3"><summary className="cursor-pointer text-sm font-semibold">{stage.title}</summary>{modules.filter(module => module.stage === stage.id).map(module => <Link key={module.id} href={href(module.id)} aria-current={module.id === moduleId ? "page" : undefined} className={`mt-2 block rounded-lg p-3 text-sm leading-relaxed ${module.id === moduleId ? "bg-[var(--primary-soft)] text-[var(--primary-ink)]" : "text-[var(--sub)] hover:bg-[var(--card)]"}`}><span className="mr-2 font-mono text-xs">{module.id}</span>{module.title}</Link>)}</details>)}</div>
        </aside>
        <div className="min-w-0" data-unified-course>
          <CourseMediaContext.Provider value={{ initialIdeaId: target?.startsWith("idea-") ? target.slice(5) : undefined,
            renderFrame: (idea, html) => <div className="flex h-full min-h-0 flex-col" data-pvlib-experiment={idea.idea_id}>
              <div className="min-h-0 flex-1"><ArtifactFrame key={`${idea.idea_id}:${delivery.identity.owner}:${contentVersion}`} html={html} title={idea.topic} moduleId={moduleId} ideaId={idea.idea_id}
                savedArtifact={idea.mode === "game" && delivery.ready ? pvlibSavedArtifact(delivery.body.artifact, moduleId, idea.idea_id) : null}
                onArtifact={idea.mode === "game" ? payload => setCandidate({ payload, idea_id: idea.idea_id, received_at: new Date().toISOString(), owner: classroom.identity.owner }) : undefined} /></div>
              {idea.mode === "game" && <div className={`max-h-[30vh] shrink-0 overflow-auto bg-[var(--paper)] p-3 text-[var(--ink)] ${styles.records}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{currentCandidate?.idea_id === idea.idea_id ? "已收到本次操作记录，可以关联到本节作业。" : "在实验中生成操作记录后，可关联到本节作业。"}</p><button type="button" className={styles.primary} disabled={currentCandidate?.idea_id !== idea.idea_id || isLocked(delivery)} onClick={attachArtifact}>关联到本节作业</button></div>
                {delivery.body.artifact && <p className="mt-2 text-sm">已关联实验操作产物</p>}<LearningRecordStatus record={delivery} />
              </div>}
            </div> }}>
            <CourseContentView projectName={PVLIB_SLUG} nodeId={0} knode={knode} knowledgeLevel={level} onClose={() => router.push(`/library/${PVLIB_SLUG}${energy ? `?mission=energy&node=${moduleId}` : ""}`)}
              preparedLesson={{ data, beforeContent, afterContent, assignment: assignmentContent }} />
          </CourseMediaContext.Provider>
          <nav aria-label="顺序浏览课程" className="mt-8 flex justify-between gap-4 border-t border-[var(--border)] px-4 py-6 text-sm">{index > 0 ? <Link href={href(modules[index - 1].id)}>← {modules[index - 1].id} 上一节</Link> : <span />}<span>{index + 1} / {modules.length}</span>{index + 1 < modules.length ? <Link href={href(modules[index + 1].id)}>{modules[index + 1].id} 下一节 →</Link> : <span>本课程终点</span>}</nav>
        </div>
      </div>
    </div>
    {energy && <EnergyLessonFooter context={energy}/>}
  </main>
}
