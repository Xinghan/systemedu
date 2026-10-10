"use client"
import { useEffect, useRef, useState } from "react"
import type * as THREE from "three"
import { partitionState } from "@/lib/logp-lab"
import { ExactEquation } from "./screening-common"

type State = ReturnType<typeof partitionState> & { cutaway: boolean }
type Controller = { update: (state: State) => void; view: (name: string) => void }

export function PartitionObject3D({ inspect = false }: { inspect?: boolean }) {
  const [logP, setLogP] = useState(inspect ? 0 : 1)
  const [volume, setVolume] = useState(10)
  const [cutaway, setCutaway] = useState(true)
  const [fallback, setFallback] = useState(false)
  const [ready, setReady] = useState(false)
  const host = useRef<HTMLDivElement>(null), controller = useRef<Controller | null>(null)
  const state = partitionState(logP, volume)
  const latest = useRef<State>({ ...state, cutaway })
  useEffect(() => { latest.current = { ...partitionState(logP, volume), cutaway }; controller.current?.update(latest.current) }, [logP, volume, cutaway])
  useEffect(() => {
    if (fallback) return
    let disposed = false, cleanup = () => {}
    void (async () => {
      const T = await import('three')
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')
      if (disposed || !host.current) return
      const container = host.current
      let renderer: THREE.WebGLRenderer
      try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }) } catch { setFallback(true); return }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(getComputedStyle(container).getPropertyValue('--paper-2').trim() || '#f4f0e7')
      renderer.domElement.setAttribute('aria-label', 'Three.js 双液相容器：拖动旋转，剖开外壁观察液面和示踪点')
      container.appendChild(renderer.domElement)
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 100)
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 5; controls.maxDistance = 14
      controls.target.set(0, 1.7, 0)
      const render = () => { if (!disposed) renderer.render(scene, camera) }
      controls.addEventListener('change', render)
      scene.add(new T.HemisphereLight(0xffffff, 0x827767, 2.4))
      const light = new T.DirectionalLight(0xffffff, 3); light.position.set(4, 7, 5); scene.add(light)
      const group = new T.Group(); scene.add(group)
      const floor = new T.Mesh(new T.CylinderGeometry(1.65, 1.65, .08, 64), new T.MeshStandardMaterial({ color: 0xe4ddce, roughness: .8 })); floor.position.y = -.1; scene.add(floor)
      const clear = () => { group.traverse(obj => { const m = obj as THREE.Mesh; m.geometry?.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(a => a.dispose()) }); group.clear() }
      const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => { const m = new T.Mesh(geometry, material); m.position.y = y; group.add(m); return m }
      function update(p: State) {
        clear()
        const waterH = p.waterMl * .12, organicH = p.organicMl * .12, height = waterH + organicH
        // Fixed-radius vessel: height is proportional to the displayed volume.
        mesh(new T.CylinderGeometry(1.15, 1.15, 4, 64, 1, true, p.cutaway ? Math.PI / 2 : 0, p.cutaway ? Math.PI * 1.5 : Math.PI * 2), new T.MeshPhysicalMaterial({ color: 0xe7f0ed, transparent: true, opacity: .20, roughness: .12, side: T.DoubleSide, depthWrite: false }), 2)
        mesh(new T.CylinderGeometry(1.1, 1.1, waterH, 64), new T.MeshStandardMaterial({ color: 0x72afb9, transparent: true, opacity: .28, depthWrite: false }), waterH / 2)
        mesh(new T.CylinderGeometry(1.1, 1.1, organicH, 64), new T.MeshStandardMaterial({ color: 0xe1b160, transparent: true, opacity: .30, depthWrite: false }), waterH + organicH / 2)
        for (const y of [0, waterH, height, 4]) {
          const ring = new T.Mesh(new T.TorusGeometry(1.14, .022, 8, 64), new T.MeshStandardMaterial({ color: y === waterH ? 0xa9814e : 0x8e9d9c, roughness: .45 })); ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring)
        }
        const organicDots = Math.round(100 * p.organicFraction)
        for (let i = 0; i < 100; i++) {
          const organic = i < organicDots, j = organic ? i : i - organicDots
          const count = organic ? organicDots : 100 - organicDots
          const a = j * 2.39996323, r = .87 * Math.sqrt(((j * 37) % 101 + .5) / 101)
          const y = (organic ? waterH : 0) + .09 + (organic ? organicH - .18 : waterH - .18) * ((j + .5) / Math.max(count, 1))
          const dot = mesh(new T.SphereGeometry(.035, 10, 8), new T.MeshStandardMaterial({ color: 0x3b4650, roughness: .65 }), y)
          dot.position.x = Math.sin(a) * r; dot.position.z = Math.cos(a) * r
        }
        renderer.domElement.dataset.organicDots = String(organicDots)
        renderer.domElement.dataset.waterDots = String(100 - organicDots)
        renderer.domElement.dataset.cutaway = String(p.cutaway)
        render()
      }
      function view(name: string) {
        if (name === 'front') camera.position.set(0, 1.8, 8)
        else if (name === 'top') camera.position.set(.01, 9, .01)
        else camera.position.set(5, 4.4, 6)
        controls.update(); render()
      }
      const resize = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); render() }
      const observer = new ResizeObserver(resize); observer.observe(container)
      const lost = (e: Event) => { e.preventDefault(); setFallback(true) }
      renderer.domElement.addEventListener('webglcontextlost', lost)
      controller.current = { update, view }; update(latest.current); view('reset'); resize(); setReady(true)
      cleanup = () => { controller.current = null; observer.disconnect(); controls.dispose(); clear(); floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.dispose(); renderer.domElement.remove() }
    })().catch(() => { if (!disposed) setFallback(true) })
    return () => { disposed = true; cleanup() }
  }, [fallback])
  return <div className="lp-two lp-object" data-medium="threejs" data-model="neutral-equilibrium">
    <section className="lp-object-stage">
      <div className="lp-viewport" ref={host} hidden={fallback} />
      {!fallback && !ready && <p className="lp-loading">正在加载 Three.js 物体…</p>}
      {fallback && <div className="lp-fallback" role="img" aria-label="三维备用剖面：上层正辛醇，下层水；浓度与右侧读数一致"><div style={{height:volume*9}} className="lp-organic">正辛醇相 · {state.organicUmol.toFixed(2)} µmol</div><div className="lp-water">水相 · {state.waterUmol.toFixed(2)} µmol</div></div>}
      <div className="lp-legend"><span>金色：正辛醇相</span><span>蓝色：水相</span><span>深色点：溶质份额</span></div>
      <div className="lp-controls">{[['front','正视液面'],['top','俯视'],['reset','恢复视角']].map(([id,label])=><button key={id} disabled={fallback||!ready} onClick={()=>controller.current?.view(id)}>{label}</button>)}<button onClick={()=>{setReady(false);setFallback(v=>!v)}}>{fallback?'尝试 Three.js':'查看备用剖面'}</button></div>
      <label className="lp-check"><input type="checkbox" checked={cutaway} onChange={e=>setCutaway(e.target.checked)} />剖开容器外壁，查看内部（不移走液体）</label>
      <p className="lp-small">真实 WebGL 物体，可拖动旋转。颜色为辨识两相而设；100 个点按份额取整，不是100个真实分子，不模拟分子运动。</p>
    </section>
    <section className="lp-card"><p className="lp-kicker">THREE.JS · {inspect?'空间检查':'定量教学模型'}</p><h3>{inspect?'两种液相，不是“上下两类分子”':'改变分配偏好，检查量和浓度'}</h3>
      {inspect?<p>液层的位置由两相的密度与装置状态决定。LogP 比较的是<strong>同一种溶质</strong>在两相中的平衡浓度，不是看油浮多高。</p>:<label>设定 logP：<strong>{logP.toFixed(1)}</strong><input aria-label="模型 logP" type="range" min="-2" max="2" step=".5" value={logP} onChange={e=>setLogP(Number(e.target.value))}/></label>}
      <label>正辛醇相体积<select aria-label="正辛醇相体积" value={volume} onChange={e=>setVolume(Number(e.target.value))}>{[5,10,20].map(v=><option key={v} value={v}>{v} mL</option>)}</select></label>
      <p className="lp-small">水相固定 10 mL；溶质总量固定 10 µmol。{inspect?'此页固定 logP = 0。':'P = '+state.p.toFixed(3)}</p>
      <table aria-label="两相物质的量与浓度"><thead><tr><th>相</th><th>量 / µmol</th><th>浓度 / mM</th></tr></thead><tbody><tr><th>正辛醇</th><td>{state.organicUmol.toFixed(3)}</td><td>{state.organicMm.toFixed(3)}</td></tr><tr><th>水</th><td>{state.waterUmol.toFixed(3)}</td><td>{state.waterMm.toFixed(3)}</td></tr></tbody></table>
      <ExactEquation source={String.raw`P=\frac{c_o}{c_w}=10^{\log P}`} />
      <p className="lp-callout">守恒核对：{state.organicUmol.toFixed(3)} + {state.waterUmol.toFixed(3)} = 10.000 µmol。体积不同，“量的比”不等于“浓度的比”。</p>
      <button onClick={()=>{setLogP(inspect?0:1);setVolume(10);setCutaway(true);controller.current?.view('reset')}}>重置模型</button>
    </section>
    <p className="lp-model-note">模型边界：固定条件、稀溶液、同一种未电离溶质、两相已平衡，不考虑反应或缔合；不是流体仿真、分子动力学或真实实验。正辛醇实验不是儿童家庭操作，本页仅作虚拟观察。</p>
  </div>
}
