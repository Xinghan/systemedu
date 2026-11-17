import { useEffect, useMemo, useRef, useState } from "react"
import { Layers, SlidersHorizontal, ArrowUpRight, Pause } from "lucide-react"
import { OPEN, rig, solveHand, type Commands, type FingerId } from "../experiments/mechanical-hand/kinematics"
import type { HandController, HandState } from "../experiments/mechanical-hand/scene"
import { handSnapshot } from "../snapshots"
import { MathFormula } from "../math-formula"
import type { Snapshot } from "../host"
import { Pager, SceneFrame, Sheet } from "./primitives"

export function MobileHand({ initial, onChange, assetBase }: { initial: Snapshot; onChange: (state: Snapshot) => void; assetBase: string }) {
  const [state, setState] = useState(() => handSnapshot(initial))
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [panel, setPanel] = useState<"observe" | "principle" | null>(null), [page, setPage] = useState(0), [playing, setPlaying] = useState(false)
  const host = useRef<HTMLDivElement>(null), controller = useRef<HandController | null>(null), current = useRef(state)
  const poses = useMemo(() => solveHand(state.commands, state.opposition, state.ball), [state.commands, state.opposition, state.ball])
  const finger = rig.fingers.find(item => item.id === state.selected)!, pose = poses[state.selected]
  const disabled = !ready || failed
  useEffect(() => { current.current = state; controller.current?.update(state); onChange(state) }, [state, onChange])
  useEffect(() => {
    if (failed || !host.current) return
    const abort = new AbortController(), target = host.current
    import("../experiments/mechanical-hand/scene").then(({ createHandScene }) => {
      if (abort.signal.aborted) throw new DOMException("Scene closed", "AbortError")
      return createHandScene(target, selected => setState(value => ({ ...value, selected })), () => { setPlaying(false); setFailed(true) }, abort.signal, assetBase)
    }).then(scene => {
      if (abort.signal.aborted) { scene.dispose(); return }
      controller.current = scene; scene.update(current.current); setReady(true)
    }).catch(error => { if (!abort.signal.aborted && error.name !== "AbortError") { setPlaying(false); setFailed(true) } })
    return () => { abort.abort(); controller.current?.dispose(); controller.current = null }
  }, [failed, retry, assetBase])
  useEffect(() => {
    if (!playing || disabled) return
    let frame = 0, last = 0, elapsed = 0
    const tick = (now: number) => {
      if (!document.hidden) {
        elapsed = Math.min(9, elapsed + (last ? Math.min((now - last) / 1000, .05) : 0))
        const commands = Object.fromEntries(rig.fingers.map((item, i) => { const phase = Math.max(0, Math.min(1, (elapsed - i * 1.35) / 2.6)); return [item.id, (1 - Math.cos(phase * Math.PI * 2)) / 2] })) as Commands
        setState(value => ({ ...value, commands }))
        if (elapsed >= 9) { setPlaying(false); return }
      }
      last = now; frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame)
  }, [playing, disabled])
  function patch(value: Partial<HandState>) { setPlaying(false); setState(old => ({ ...old, ...value })) }
  function preset(kind: "open" | "close" | "ball") {
    patch({ ball: kind === "ball", commands: kind === "open" ? { ...OPEN } : { thumb: 1, index: 1, middle: 1, ring: 1, little: 1 }, opposition: kind === "open" ? 0 : kind === "ball" ? .7 : .5 })
  }
  function explain(index: number) { setPlaying(false); setPage(index); setPanel("principle") }
  return <div className="experiment hand-workspace">
    <SceneFrame host={host} ready={ready} failed={failed} retry={() => { setReady(false); setFailed(false); setRetry(n => n + 1) }} poster={`${assetBase}/mechanical-hand/poster.png`}>
      <div className="model-caption"><span className="overline">当前观察</span><strong>{finger.name}</strong></div>
      <div className="camera-buttons" aria-label="观察角度">{([['perspective','立体'],['palm','掌面'],['side','侧面']] as const).map(([id, label]) => <button key={id} disabled={disabled} onClick={() => controller.current?.view(id)}>{label}</button>)}</div>
      <div className="model-hint">拖动旋转 · 双指缩放 · 点选手指</div>
      {playing && <button className="stop-demo" onClick={() => setPlaying(false)} aria-label="暂停逐指演示"><Pause size={15}/>暂停演示</button>}
    </SceneFrame>
    <section className="control-deck" aria-label="机械手操作">
      <div className="finger-picker" aria-label="选择手指">{rig.fingers.map(item => <button key={item.id} aria-pressed={state.selected === item.id} onClick={() => patch({ selected: item.id as FingerId })}>{item.name}</button>)}</div>
      <div className="active-slider"><label htmlFor="finger-command">{finger.name}弯曲 <strong>{Math.round(state.commands[state.selected] * 100)}<small>%</small></strong></label><input id="finger-command" type="range" aria-label={`${finger.name}弯曲指令`} min={0} max={100} value={Math.round(state.commands[state.selected] * 100)} disabled={disabled} onChange={e => patch({ commands: { ...state.commands, [state.selected]: Number(e.target.value) / 100 } })}/></div>
      <button className="live-readout" onClick={() => explain(1)} aria-label="查看收绳计算"><span>{state.ball ? pose.contact ? "已达到接触限位" : "尚未接触参考球" : "理想收绳量"}</span><strong>{pose.pull.toFixed(2)} <small>mm</small></strong><ArrowUpRight size={15}/></button>
      <div className="preset-row" aria-label="姿态预设"><button disabled={disabled} onClick={() => preset("open")}>张开手掌</button><button disabled={disabled} onClick={() => preset("close")}>五指合拢</button><button disabled={disabled} onClick={() => preset("ball")}>包握参考球</button></div>
      <div className="action-row"><button disabled={disabled} aria-pressed={!state.shells} onClick={() => patch({ shells: !state.shells, tendons: state.shells ? true : state.tendons })}><Layers size={17}/>{state.shells ? "看内部" : "显示外壳"}</button><button onClick={() => { setPlaying(false); setPanel("observe") }}><SlidersHorizontal size={17}/>更多操作</button><button onClick={() => explain(0)}>动作原理<ArrowUpRight size={16}/></button></div>
    </section>
    {panel === "observe" && <Sheet title="观察与动作" onClose={() => setPanel(null)}>
      <label className="setting-range">拇指对掌 <strong>{Math.round(state.opposition * 100)}%</strong><input aria-label="拇指对掌" type="range" min={0} max={100} value={state.opposition * 100} disabled={disabled} onChange={e => patch({ selected: "thumb", opposition: Number(e.target.value) / 100 })}/></label>
      <p>对掌让拇指朝向其他手指，与指节弯曲是不同的转动。</p>
      <label className="switch-row">显示牵引绳<input type="checkbox" checked={state.tendons} disabled={disabled} onChange={e => patch({ tendons: e.target.checked })}/></label>
      <label className="switch-row">显示参考球<input type="checkbox" checked={state.ball} disabled={disabled} onChange={e => patch({ ball: e.target.checked })}/></label>
      <button className="wide-button" disabled={disabled} onClick={() => { patch({ commands: { ...OPEN }, ball: false, opposition: .2 }); setPlaying(true); setPanel(null) }}>播放逐指演示</button>
      <button className="wide-button secondary" disabled={disabled} onClick={() => { setState(handSnapshot({ commands: OPEN, opposition: 0, shells: true, tendons: false, selected: "index", ball: false })); controller.current?.view("perspective"); setPanel(null) }}>恢复初始姿态</button>
    </Sheet>}
    {panel === "principle" && <Sheet title={[`${finger.name}怎样弯曲`, "收回的绳长怎样计算", "这个模型能解释什么"][page]} onClose={() => setPanel(null)} footer={<Pager index={page} count={3} onChange={setPage}/>}>
      {page === 0 ? <><p>每个关节都是一根转轴。上游关节转动时，下游指节一起移动。下列角度均相对于前一节。</p><dl className="field-list">{pose.angles.map((angle, i) => <div key={i}><dt>θ{i + 1} · {['根部','中间','末端'][i]}关节</dt><dd>{angle.toFixed(1)}°</dd></div>)}</dl><p>弯曲滑杆给出 0～100% 的指令，关节按预设比例弯曲。碰到参考球时，实际弯曲量会受几何接触限制。</p></> : page === 1 ? <><div className="equation"><MathFormula tex={String.raw`\Delta l = \sum_i r_i\theta_i`} label="收绳量等于各关节力臂与转角乘积之和"/></div><dl className="field-list"><div><dt>Δl · 理想收绳量</dt><dd>{pose.pull.toFixed(2)} mm</dd></div><div><dt>r · 绳相对转轴的力臂</dt><dd>{finger.arms_mm.join(" / ")} mm</dd></div><div><dt>θ · 关节转角</dt><dd>先用角度 × π / 180 换成弧度，再代入公式。</dd></div></dl><p>卷线轮半径为 {rig.drum_radius_mm} mm。当前理想收绳量对应卷线轮旋转 {pose.drumAngle.toFixed(1)}°。</p></> : <><p>橙色线表示牵引绳的走向。卷线轮收绳，关节弯曲。尺寸、关节比例和恒定力臂都是教学设定。</p><p>参考球采用近似几何接触限位，不计算抓力、绳索弹性、摩擦或复位弹簧受力。这个模型不能用于预测真实机械手能抓起多重的物体。</p><p>原理参考 <a href="https://www.eng.yale.edu/grablab/openhand/" target="_blank" rel="noreferrer">Yale OpenHand</a>；外形参考 <a href="https://www.shadowrobot.com/wp-content/uploads/2024/06/20240610-UPDATED-shadow_dexterous_hand_e_technical_specification.pdf" target="_blank" rel="noreferrer">Shadow Hand</a> 与 <a href="https://openbionics.com/en/prosthetic-hands-that-move/" target="_blank" rel="noreferrer">Hero Arm</a>。本模型为原创教学结构。</p></>}
    </Sheet>}
  </div>
}
