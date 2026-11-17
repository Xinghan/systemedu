import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw, Layers, Boxes, ArrowUpRight } from "lucide-react"
import { DURATION, STAGES, PARTS, stageAt, type Part } from "../experiments/mars-landing/content"
import type { SceneController } from "../experiments/mars-landing/scene"
import { landingSnapshot } from "../snapshots"
import type { Snapshot } from "../host"
import { Pager, SceneFrame, Sheet } from "./primitives"

export function MobileLanding({ initial, onChange, assetBase }: { initial: Snapshot; onChange: (state: Snapshot) => void; assetBase: string }) {
  const [state, setState] = useState(() => landingSnapshot(initial)), [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [panel, setPanel] = useState<"stage" | "parts" | null>(null), [page, setPage] = useState(0)
  const host = useRef<HTMLDivElement>(null), controller = useRef<SceneController | null>(null), current = useRef(state)
  const phase = stageAt(state.time), stage = STAGES[phase], disabled = !ready || failed
  const select = useCallback((selected: Part) => { setPlaying(false); setState(value => ({ ...value, selected })) }, [])
  useEffect(() => {
    current.current = state; controller.current?.seek(state.time); controller.current?.shell(state.hidden); controller.current?.select(state.selected); onChange(state)
  }, [state, onChange])
  useEffect(() => {
    if (failed || !host.current) return
    const abort = new AbortController(), target = host.current
    import("../experiments/mars-landing/scene").then(({ createLandingScene }) => {
      if (abort.signal.aborted) throw new DOMException("Scene closed", "AbortError")
      return createLandingScene(target, select, () => { setPlaying(false); setFailed(true) }, abort.signal, assetBase)
    }).then(scene => {
      if (abort.signal.aborted) { scene.dispose(); return }
      controller.current = scene; scene.seek(current.current.time); scene.shell(current.current.hidden); scene.select(current.current.selected); setReady(true)
    }).catch(error => { if (!abort.signal.aborted && error.name !== "AbortError") { setPlaying(false); setFailed(true) } })
    return () => { abort.abort(); controller.current?.dispose(); controller.current = null }
  }, [failed, retry, assetBase, select])
  useEffect(() => {
    if (!playing || disabled) return
    let frame = 0, last = 0
    const tick = (now: number) => {
      if (!document.hidden) {
        const time = Math.min(DURATION, current.current.time + (last ? Math.min((now - last) / 1000, .05) : 0) * current.current.speed)
        current.current = { ...current.current, time }; setState(current.current)
        if (time === DURATION) { setPlaying(false); return }
      }
      last = now; frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame)
  }, [playing, disabled])
  function jump(time: number) { setPlaying(false); setState(value => ({ ...value, time, answer: false, selected: null })); controller.current?.view("follow") }
  function inspect(part: Part) {
    const times: Record<Part, number> = { rover: 34, descent: 14, parachute: 1, backshell: 2, heatshield: 6, bridle: 25 }
    setPlaying(false); setState(value => ({ ...value, selected: part, time: times[part], answer: false })); controller.current?.view("follow"); setPanel(null)
  }
  function open(panel: "stage" | "parts") { setPlaying(false); setPage(0); setPanel(panel) }
  return <div className="experiment landing-workspace">
    <SceneFrame host={host} ready={ready} failed={failed} retry={() => { setReady(false); setFailed(false); setRetry(n => n + 1) }} poster={`${assetBase}/mars-landing/poster.png`}>
      <button className="model-caption caption-button" onClick={() => open(state.selected ? "parts" : "stage")}><span className="overline">{state.selected ? "选中部件" : `阶段 0${phase + 1}`}</span><strong>{state.selected ? PARTS[state.selected].name : stage.title}<ArrowUpRight size={15}/></strong></button>
      <div className="camera-buttons" aria-label="观察角度">{([['follow','整体'],['side','侧面'],['top','俯视']] as const).map(([id, label]) => <button key={id} disabled={disabled} onClick={() => controller.current?.view(id)}>{label}</button>)}</div>
      <div className="model-hint">拖动旋转 · 点选部件 · 时间与空间均为示意</div>
    </SceneFrame>
    <section className="control-deck" aria-label="着陆演示操作">
      <div className="stage-picker" aria-label="选择着陆阶段">{STAGES.map((item, i) => <button key={item.id} aria-label={item.title} aria-current={phase === i ? "step" : undefined} onClick={() => jump(item.seek)}><span>0{i + 1}</span><b>{['伞降','抛罩','动力下降','缆绳下放','触地'][i]}</b></button>)}</div>
      <div className="playback"><button className="play-button" disabled={disabled} aria-label={playing ? "暂停演示" : "播放演示"} onClick={() => { if (state.time === DURATION) { current.current = { ...state, time: 0 }; setState(current.current) } setPlaying(v => !v) }}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button><input aria-label="着陆演示时间轴" type="range" min={0} max={DURATION} step={.05} value={state.time} disabled={disabled} onChange={e => jump(Number(e.target.value))}/><button className="speed-button" aria-label={`播放速度 ${state.speed} 倍，点击切换`} onClick={() => setState(s => ({ ...s, speed: s.speed === .5 ? 1 : s.speed === 1 ? 2 : .5 }))}>{state.speed}×</button><button className="icon-button" aria-label="从头开始" disabled={disabled} onClick={() => jump(0)}><RotateCcw size={18}/></button></div>
      <div className="time-caption"><span>{state.time.toFixed(1)} / 42.0 s</span><span>演示时间，非实际飞行时长</span></div>
      <button className="stage-summary" onClick={() => open("stage")}><span><small>此刻正在发生</small><strong>{stage.verb}</strong></span><ArrowUpRight size={19}/></button>
      <div className="action-row"><button disabled={disabled} aria-pressed={state.hidden} onClick={() => setState(s => ({ ...s, hidden: !s.hidden }))}><Layers size={17}/>{state.hidden ? "显示外壳" : "看内部"}</button><button onClick={() => open("parts")}><Boxes size={17}/>部件目录</button><button onClick={() => { open("stage"); setPage(1) }}>想一想<ArrowUpRight size={16}/></button></div>
    </section>
    {panel === "stage" && <Sheet title={page === 0 ? stage.title : page === 1 ? "理解这一阶段" : "对照真实着陆"} onClose={() => setPanel(null)} footer={<Pager index={page} count={3} onChange={setPage}/>}>
      {page === 0 ? <><p className="detail-lead">{stage.verb}</p><p>{stage.body}</p><div className="fact-card"><small>真实任务参考</small><p>{stage.fact}</p></div></> : page === 1 ? <><h3>{stage.question}</h3><p>先回想刚才模型里的连接关系，再查看解释。</p><button className="wide-button secondary" aria-expanded={state.answer} onClick={() => setState(s => ({ ...s, answer: !s.answer }))}>{state.answer ? "收起解释" : "查看解释"}</button>{state.answer && <p className="answer">{stage.answer}</p>}</> : <><p>本模型依据真实着陆顺序编排；尺寸、距离和时长均有简化，不是飞行仿真或实际遥测。火星车桅杆在着陆时保持收起。</p><ul className="source-list"><li><a href="https://www.youtube.com/watch?v=4czjS9h4Fpg" target="_blank" rel="noreferrer">NASA 着陆实拍 ↗</a></li><li><a href="https://science.nasa.gov/resource/powered-descent-for-perseverance-illustration/" target="_blank" rel="noreferrer">动力下降说明 ↗</a></li><li><a href="https://science.nasa.gov/resource/perseverance-heat-shield-separation-illustration/" target="_blank" rel="noreferrer">隔热罩分离 ↗</a></li><li><a href="https://science.nasa.gov/resource/perseverance-touching-down-on-mars-illustration/" target="_blank" rel="noreferrer">触地与飞离 ↗</a></li></ul></>}
    </Sheet>}
    {panel === "parts" && <Sheet title="部件目录" onClose={() => setPanel(null)}>
      {state.selected && <div className="fact-card"><h3>{PARTS[state.selected].name}</h3><p>{PARTS[state.selected].detail}</p></div>}
      <p>选择部件，模型会定位到适合观察它的阶段。</p>
      <div className="part-grid">{(Object.keys(PARTS) as Part[]).map(part => <button key={part} aria-pressed={state.selected === part} onClick={() => inspect(part)}>{PARTS[part].name}<ArrowUpRight size={15}/></button>)}</div>
    </Sheet>}
  </div>
}
