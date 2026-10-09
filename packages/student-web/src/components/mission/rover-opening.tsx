"use client"

/* Cinematic stills intentionally use native responsive images, including CSS scene crops. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Camera, Check, CheckCheck, ChevronRight, Crosshair, FileCheck2, LoaderCircle, Pause, Play, RotateCcw, ScanLine, Volume2, VolumeX, X } from "lucide-react"
import { useLearningRecord, useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { DIALOGUE, EMPTY_MISSION, INITIAL_BODY, MISSION_SCOPE, ROUTES, SITES, finishAttempt, missionBody, photoCrop, readMission, type Checkpoint, type Mission, type Route, type Site, type VoiceLine } from "@/lib/rover-opening"
import s from "./rover-opening.module.css"
import { RoverBriefingFilm } from "./rover-briefing-film"

type Stage = "lobby" | "briefing" | "execute" | Checkpoint
const CHAPTERS = ["任务简报", "观察地形", "制定计划", "带回证据"]
const MEDIA = "/mission/rover"

export function RoverOpening() {
  const { owner } = useLearningIdentity()
  // Changing accounts also resets transient scene state; no cross-account artifacts.
  return <Experience key={owner} />
}

function Experience() {
  const record = useLearningRecord(MISSION_SCOPE, INITIAL_BODY)
  const mission = readMission(record.body.artifact)
  const [stage, setStage] = useState<Stage>("lobby")
  const [sound, setSound] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [focus, setFocus] = useState<Site | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [frame, setFrame] = useState({ x: 63, y: 36, zoom: 1.8 })
  const [confirmReset, setConfirmReset] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [mediaRetry, setMediaRetry] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [photoError, setPhotoError] = useState("")
  const audio = useRef<HTMLAudioElement>(null)
  const sceneImage = useRef<HTMLImageElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const detail = SITES.find(site => site.id === focus)
  const opening = stage === "lobby" || stage === "briefing"
  const arrived = stage === "capture" || stage === "complete"
  const scene = opening ? "engineer" : "terrain"
  const chapter = opening ? 0 : stage === "survey" ? 1 : ["plan", "execute", "stopped"].includes(stage) ? 2 : 3
  const line: VoiceLine = stage === "survey" ? focus ?? "handover" : stage === "plan" || stage === "execute" ? "plan" : stage === "stopped" ? "stopped" : arrived ? stage === "complete" ? "complete" : "arrived" : "welcome"
  const hasProgress = mission.observed.length > 0 || mission.attempts.length > 0
  const editable = !record.pending && !(record.busy && !record.ready)
  const canStart = (record.ready || record.attention) && editable

  function save(next: Mission, nextStage: Stage = next.checkpoint) {
    if (!editable) return
    record.session.update(missionBody(next))
    setStage(nextStage)
  }
  function start(withSound: boolean) {
    setSound(withSound)
    setStage("briefing")
  }
  function observe(id: Site) {
    setFocus(id)
    if (!mission.observed.includes(id)) save({ ...mission, observed: [...mission.observed, id] }, "survey")
  }
  function execute() {
    if (!route || !editable) return
    setProgress(0)
    setPaused(false)
    // Reloading a running simulation returns to planning, never silently resumes a drive.
    save({ ...mission, route, checkpoint: "plan" }, "execute")
  }
  const finish = useEffectEvent(() => {
    if (route) save(finishAttempt(mission, route))
  })
  useEffect(() => {
    if (stage !== "execute" || paused) return
    let elapsed = progress * 10000
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      elapsed += Math.min(now - last, 250)
      last = now
      const next = Math.min(elapsed / 10000, 1)
      setProgress(next)
      if (next >= 1) { clearInterval(timer); finish() }
    }, 60)
    return () => clearInterval(timer)
    // Progress is sampled when execution starts/resumes, not used to restart its timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused])
  useEffect(() => {
    const hide = () => {
      if (document.hidden) { setPaused(true); audio.current?.pause() }
    }
    document.addEventListener("visibilitychange", hide)
    return () => document.removeEventListener("visibilitychange", hide)
  }, [])
  useEffect(() => {
    const node = audio.current
    if (!node) return
    if (sound && stage !== "lobby" && stage !== "briefing") void node.play().catch(error => { if (error.name !== "AbortError") setAudioError(true) })
    else node.pause()
    return () => node.pause()
  }, [line, sound, stage])
  useEffect(() => {
    if (stage !== "lobby") heading.current?.focus({ preventScroll: true })
  }, [stage])
  useEffect(() => {
    let active = true
    void sceneImage.current?.decode().then(() => {
      if (active) { setLoaded(true); setMediaError(false) }
    }).catch(() => { if (active) setMediaError(true) })
    return () => { active = false }
  }, [scene, mediaRetry])
  function toggleSound() {
    if (!sound && !opening) {
      setAudioError(false)
      void audio.current?.play().catch(error => { if (error.name !== "AbortError") setAudioError(true) })
    }
    setSound(!sound)
  }
  function retryAudio() {
    setAudioError(false)
    setSound(true)
    if (audio.current) { audio.current.load(); void audio.current.play().catch(error => { if (error.name !== "AbortError") setAudioError(true) }) }
  }
  function resume() {
    setRoute(mission.route)
    if (mission.photo) setFrame(mission.photo)
    setStage(mission.checkpoint)
  }
  function reset() {
    save({ ...EMPTY_MISSION, observed: [], attempts: [] }, "briefing")
    setRoute(null); setFocus(null); setProgress(0)
    setConfirmReset(false)
  }
  function aim(clientX: number, clientY: number) {
    const rect = viewport.current?.getBoundingClientRect()
    if (!rect) return
    const dx = (clientX - rect.left) / rect.width - .5
    const dy = (clientY - rect.top) / rect.height - .5
    setFrame(f => ({ ...f, x: Math.max(45, Math.min(80, f.x + dx * 5)), y: Math.max(20, Math.min(55, f.y + dy * 4)) }))
  }
  function capture() {
    if (Math.abs(frame.x - 63) > 9 || Math.abs(frame.y - 36) > 10) {
      setPhotoError("取景偏离岩层了。将横向纹理移回画面中央，再拍一张。")
      return
    }
    setPhotoError("")
    save({ ...mission, checkpoint: "complete", photo: frame })
  }
  async function downloadPhoto() {
    setPhotoError("")
    try {
      const image = new Image()
      image.src = `${MEDIA}/terrain-1920.webp`
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = 1200; canvas.height = 800
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("canvas")
      const photo = mission.photo ?? frame
      const { sx, sy, sw, sh } = photoCrop(photo, image.width, image.height)
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 1200, 800)
      ctx.fillStyle = "rgba(8,18,22,.85)"; ctx.fillRect(0, 735, 1200, 65)
      ctx.fillStyle = "#eee8db"; ctx.font = "22px sans-serif"
      ctx.fillText("晨光号 / 我的第一张岩层照片 · 教学模拟 · AI 场景", 30, 777)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("blob")), "image/jpeg", .94))
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = "晨光号-我的岩层照片.jpg"; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setPhotoError("照片暂时无法生成，请检查场景图片是否加载完成后重试。") }
  }
  function downloadRecord() {
    const blob = new Blob([JSON.stringify(missionBody(mission), null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "晨光号-任务档案.json"; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <main className={`${s.experience} ${opening ? s.opening : s.field} ${stage === "complete" ? s.completed : ""}`} data-stage={stage}>
    <audio ref={audio} src={`${MEDIA}/audio/${line}.mp3`} preload="auto" onPlaying={() => { setSpeaking(true); setAudioError(false) }} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} onError={() => setAudioError(true)} />
    <div className={s.backdrop} aria-hidden="true">
      <img ref={sceneImage} key={`${scene}-${mediaRetry}`} src={`${MEDIA}/${scene}-1920.webp`} srcSet={opening ? undefined : `${MEDIA}/${scene}-960.webp 960w, ${MEDIA}/${scene}-1920.webp 1672w`} sizes="100vw" alt="" onLoad={() => { setLoaded(true); setMediaError(false) }} onError={() => setMediaError(true)} className={opening ? s.character : s.terrainBackdrop} />
    </div>
    <div className={s.shade} aria-hidden="true" />
    <header className={s.header}>
      <Link href="/library?view=lines&line=space-exploration" className={s.back} aria-label="返回项目库"><ArrowLeft size={18} /></Link>
      <div className={s.brand}><span className={s.mark}>S<span>•</span></span><div>晨光计划 <span className={s.brandSub}>MARS / 001</span></div></div>
      <div className={s.topActions}>
        <span className={s.simulation}>任务模拟</span>
        <button onClick={toggleSound} className={s.iconButton} aria-label={sound ? "关闭声音" : "开启声音"} aria-pressed={sound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button onClick={() => setSaveOpen(true)} className={s.iconButton} aria-label="查看保存状态"><FileCheck2 size={18} /></button>
      </div>
    </header>

    {!loaded && !mediaError && <div className={s.loading}><LoaderCircle className={s.spin} size={22} /><span>正在进入控制席</span></div>}
    {mediaError && <div className={s.mediaWarning} role="alert">场景图片未加载。<button onClick={() => { setMediaError(false); setMediaRetry(v => v + 1) }}>重新加载</button></div>}

    {stage === "lobby" && <section className={s.lobby}>
      <div className={s.eyebrow}><span /> 地球 · 深空任务控制室</div>
      <h1>下一段探索，<br />交给你。</h1>
      <p>坐进控制席。有人在等你，<br />一起完成晨光号的第一次任务。</p>
      <div className={s.startActions}>
        {hasProgress ? <button className={s.primary} onClick={resume} disabled={!canStart}>继续我的任务 <ArrowRight size={19} /></button> : <button className={s.primary} onClick={() => start(true)} disabled={!canStart}>{!canStart ? <LoaderCircle className={s.spin} size={18} /> : <Play size={17} fill="currentColor" />} 戴上耳机，进入现场</button>}
        <button className={s.quiet} onClick={() => hasProgress ? setConfirmReset(true) : start(false)} disabled={!canStart}>{hasProgress ? "重新开始" : "静音进入 · 保留字幕"}</button>
      </div>
      <div className={s.lobbyMeta}>约 3 分钟 <span>／</span> 无需准备器材 <span>／</span> 你的第一份任务档案</div>
      <div className={s.namePlate}><span>你的任务搭档</span><strong>林岚</strong><small>探测车任务工程师 · 虚构角色</small></div>
    </section>}

    {stage === "briefing" && <RoverBriefingFilm sound={sound} suspended={saveOpen || confirmReset} disabled={!editable}
      onComplete={() => save({ ...mission, checkpoint: "survey" })} />}

    {!opening && <>
      <section className={s.missionHeading}>
        <div className={s.eyebrow}>CHENGUANG / FIELD OPERATIONS</div>
        <h1 ref={heading} tabIndex={-1}>{stage === "survey" ? "先读懂眼前的地形。" : stage === "plan" ? "这一次，由你选路。" : stage === "execute" ? "计划已发送，等待回传。" : stage === "stopped" ? "停下来，也是一种判断。" : stage === "capture" ? "把发现带回来。" : "这是你的第一份任务档案。"}</h1>
        <div className={s.missionObjective}><Crosshair size={14} /> 目标：抵达岩层，拍清横向纹理</div>
      </section>
      <div ref={viewport} className={`${s.viewport} ${arrived ? s.photoViewport : ""}`}>
        <div className={s.cameraTag}><span className={s.dot} /> {arrived ? "SCIENCE CAM" : "NAV CAM"}<span>晨光号 / 教学模拟</span></div>
        {arrived ? <div className={s.photoView}>
          <PhotoCanvas photo={stage === "complete" ? mission.photo ?? frame : frame} retry={mediaRetry} onError={() => setMediaError(true)} />
          {stage === "capture" && <button className={s.aimSurface} aria-label="点击画面调整取景，也可使用下方方向按钮" onClick={e => aim(e.clientX, e.clientY)}><span className={s.reticle}><i /><i /><i /><i /><span /></span></button>}
          {stage === "complete" && <span className={s.photoStamp}><CheckCheck size={16} /> EVIDENCE / 001</span>}
        </div> : <div className={`${s.terrainCanvas} ${stage === "execute" && !paused ? s.driving : ""}`}>
          <img key={mediaRetry} onError={() => setMediaError(true)} src={`${MEDIA}/terrain-1920.webp`} alt="晨光号前方：左边是连续岩面，中间是波纹状沙地，远处为目标岩层" draggable={false} />
          {["plan", "execute", "stopped"].includes(stage) && <svg className={s.routes} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {(["direct", "detour"] as Route[]).map(r => <path key={r} d={ROUTES[r].path} pathLength={100} className={`${s.routeLine} ${route === r ? s.selectedRoute : ""}`} />)}
            {stage === "execute" && route && <path d={ROUTES[route].path} pathLength={100} className={s.traveledRoute} style={{ strokeDasharray: `${progress * (route === "direct" ? 48 : 100)} 100` }} />}
          </svg>}
          {SITES.map(site => <button key={site.id} disabled={stage !== "survey"} onClick={() => observe(site.id)} aria-label={`观察${site.title}`} aria-pressed={focus === site.id} className={`${s.hotspot} ${mission.observed.includes(site.id) ? s.observed : ""} ${focus === site.id ? s.activeHotspot : ""}`} style={{ left: `${site.x}%`, top: `${site.y}%` }}><span>{mission.observed.includes(site.id) ? <Check size={16} /> : <span className={s.hotspotDot} />}</span><b>{site.short}</b></button>)}
        </div>}
        <div className={s.viewCorner} aria-hidden="true" /><div className={s.viewCorner2} aria-hidden="true" />
        {stage === "execute" && <div className={s.execution}><span>{paused ? "模拟已暂停" : progress < .25 ? "计划校验完成" : progress < .6 ? "自主行驶中" : route === "direct" ? "检测到滑移，正在制动" : "接近目标观察点"}</span><div className={s.progressTrack}><i style={{ width: `${progress * 100}%` }} /></div><button onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "继续" : "暂停"}</button></div>}
        {stage === "stopped" && <div className={s.stopLabel}><span /> 保护停车 · 车轮打滑</div>}
      </div>
      <section className={s.controlPanel}>
        <div className={s.radioDialogue}><img src={`${MEDIA}/engineer-960.webp`} alt="林岚工程师" /><div><div className={s.speaker}><Voice speaking={speaking} /><strong>林岚</strong><span>通讯频道 01</span></div><p aria-live="polite">{stage === "execute" ? "我们已发出路线计划。晨光号会自主执行，并在遇到风险时停下。这段回传在教学模拟中已加速。" : DIALOGUE[line]}</p></div></div>
        {stage === "survey" && <div className={s.surveyActions}>
          <div className={s.observationNote}>{detail ? <><Check size={15} /><span>{detail.note}</span></> : <><ScanLine size={16} /><span>点击画面中的三个标记，听听林岚的判断。</span></>}</div>
          <button className={s.primary} disabled={mission.observed.length < 3 || !editable} onClick={() => { setFocus(null); save({ ...mission, checkpoint: "plan" }) }}>{mission.observed.length < 3 ? `已观察 ${mission.observed.length} / 3` : "观察完成，制定路线"}<ArrowRight size={18} /></button>
        </div>}
        {stage === "plan" && <div className={s.planActions}><div className={s.routeOptions} role="group" aria-label="选择路线">{(["direct", "detour"] as Route[]).map((r, i) => <button className={route === r ? s.chosen : ""} key={r} onClick={() => setRoute(r)} aria-pressed={route === r}><span>0{i + 1}</span><div><strong>{ROUTES[r].title}</strong><small>{ROUTES[r].detail}</small></div>{route === r ? <Check size={18} /> : <ChevronRight size={18} />}</button>)}</div><button className={s.primary} disabled={!route || !editable} onClick={execute}>发送这份计划 <ArrowRight size={18} /></button></div>}
        {stage === "stopped" && <div className={s.surveyActions}><div className={s.observationNote}>这次尝试已写入任务档案。换条路，观察结果怎样变化。</div><button className={s.primary} disabled={!editable} onClick={() => { setRoute(null); setProgress(0); save({ ...mission, checkpoint: "plan" }) }}><RotateCcw size={17} /> 返回起点，重新规划</button></div>}
        {stage === "capture" && <div className={s.captureActions}><div className={s.aimControls} aria-label="调整取景"><button aria-label="取景向左" onClick={() => setFrame(f => ({ ...f, x: Math.max(45, f.x - 3) }))}>←</button><button aria-label="取景向右" onClick={() => setFrame(f => ({ ...f, x: Math.min(80, f.x + 3) }))}>→</button><button aria-label="取景向上" onClick={() => setFrame(f => ({ ...f, y: Math.max(20, f.y - 3) }))}>↑</button><button aria-label="取景向下" onClick={() => setFrame(f => ({ ...f, y: Math.min(55, f.y + 3) }))}>↓</button><label>拉近<input aria-label="镜头倍率" type="range" min="1.3" max="2.4" step="0.1" value={frame.zoom} onChange={e => setFrame(f => ({ ...f, zoom: Number(e.target.value) }))} /></label></div><button className={s.primary} disabled={!editable || mediaError} onClick={capture}><Camera size={19} /> 按下快门</button></div>}
        {stage === "complete" && <>
          <div className={s.evidence}><span><Check size={15} /> 3 处观察</span><span><Check size={15} /> {mission.attempts.length} 次路线尝试</span><span><Check size={15} /> 1 张岩层照片</span><button onClick={downloadPhoto}>带走我的照片 <ArrowRight size={14} /></button></div>
          <Link href="/explore/space-exploration/write-driving-rules" className={s.nextLesson}><span><small>接下来的真实课程</small><strong>把判断，写成探测车的行动规则。</strong></span><ArrowRight size={23} /></Link>
          <div className={s.otherLessons}><Link href="/explore/space-exploration/label-the-terrain">先学会识别地形</Link><Link href="/explore/space-exploration/assemble-a-rover">看看怎样制造探测车</Link><button onClick={() => setConfirmReset(true)}>再试一次</button></div>
        </>}
        {photoError && <p role="alert" className={s.errorText}>{photoError}</p>}
      </section>
    </>}

    {stage !== "lobby" && <footer className={s.footer}><ol>{CHAPTERS.map((c, i) => <li className={i === chapter ? s.currentChapter : i < chapter ? s.doneChapter : ""} key={c}><span>{i < chapter ? <Check size={11} /> : `0${i + 1}`}</span>{c}</li>)}</ol><button onClick={() => setSaveOpen(true)} className={s.saveStatus}>{record.busy ? <LoaderCircle size={12} className={s.spin} /> : <span className={s.dot} />}{record.attention ? "保存需要处理" : !record.identity.token ? "仅存本机" : record.dirty ? "等待同步" : "账号记录"}</button></footer>}
    {audioError && !opening && sound && <div className={s.audioNotice}>配音未能播放，字幕仍可用。<button onClick={retryAudio}>重试声音</button><button onClick={() => { setSound(false); setAudioError(false) }} aria-label="关闭声音提示"><X size={14} /></button></div>}
    {saveOpen && <MissionDialog title="任务记录" close={() => setSaveOpen(false)}><button autoFocus className={s.close} onClick={() => setSaveOpen(false)} aria-label="关闭记录"><X /></button><FileCheck2 size={26} /><h2>你的任务记录</h2><p role="status">{record.message}</p><small>只保存这次开场的观察、路线尝试与取景参数，不会将正式课程标记为完成。场景、角色和数据均为教学模拟。</small><div className={s.modalActions}>{record.identity.token && <button className={s.primary} onClick={() => record.ready && !record.conflict ? void record.session.save() : void record.session.refresh(false)} disabled={record.busy}>重试同步</button>}<button className={s.secondary} onClick={downloadRecord}>下载当前备份</button></div>{record.conflict && <p>服务器存在另一版本。当前草稿已保留，先下载备份再决定是否读取。</p>}{record.conflict && <button className={s.quiet} onClick={() => { if (window.confirm("读取服务器版本将替换当前页面中的草稿。请确认已下载需要保留的备份。")) void record.session.refresh(true) }}>读取服务器版本</button>}<button className={s.quiet} onClick={() => { setSaveOpen(false); setStage("lobby") }}>返回开场</button></MissionDialog>}
    {confirmReset && <MissionDialog title="重新体验" close={() => setConfirmReset(false)}><RotateCcw size={26} /><h2>重新开始这次任务？</h2><p>当前开场草稿会重新计数。正式课程的学习记录不受影响。</p><div className={s.modalActions}><button autoFocus className={s.secondary} onClick={() => setConfirmReset(false)}>保留，继续任务</button><button className={s.primary} onClick={reset} disabled={!editable}>重新开始</button></div></MissionDialog>}
  </main>
}
function Voice({ speaking }: { speaking: boolean }) {
  return <span className={`${s.voice} ${speaking ? s.speaking : ""}`} aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ "--bar": i } as CSSProperties} />)}</span>
}

function PhotoCanvas({ photo, retry, onError }: { photo: NonNullable<Mission["photo"]>; retry: number; onError: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let active = true
    const image = new Image()
    image.src = `${MEDIA}/terrain-1920.webp`
    void image.decode().then(() => {
      const ctx = canvas.current?.getContext("2d")
      if (!active || !ctx) return
      const { sx, sy, sw, sh } = photoCrop(photo, image.width, image.height)
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 1200, 800)
    }).catch(() => { if (active) onError() })
    return () => { active = false }
  }, [photo, retry, onError])
  return <canvas ref={canvas} width={1200} height={800} className={s.photoCanvas} role="img" aria-label="我的岩层取景照片，教学模拟场景" />
}

function MissionDialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className={s.nativeDialog} aria-label={title} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close() }}><section className={s.modal}>{children}</section></dialog>
}
