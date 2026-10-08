"use client"
import { useEffect, useRef, useState } from "react"
import type * as THREE from "three"
import { torqueFormat, torqueNm } from "@/lib/tendon-torque"

type Params = { radius: number; angle: number; exploded: boolean }
type Controller = { update: (p: Params) => void; view: (name: string) => void }

export function TorqueObject3D() {
  const [radius,setRadius]=useState(1)
  const [angle,setAngle]=useState(90)
  const [exploded,setExploded]=useState(false)
  const [fallback,setFallback]=useState(false)
  const [ready,setReady]=useState(false)
  const host=useRef<HTMLDivElement>(null)
  const controller=useRef<Controller|null>(null)
  const latest=useRef<Params>({radius:1,angle:90,exploded:false})
  useEffect(()=>{ latest.current={radius,angle,exploded}; controller.current?.update(latest.current) },[radius,angle,exploded])
  useEffect(()=>{
    if(fallback) return
    let disposed=false
    let cleanup=()=>{}
    void (async()=>{
      const T=await import("three")
      const {OrbitControls}=await import("three/addons/controls/OrbitControls.js")
      if(disposed||!host.current) return
      const container=host.current
      let renderer: THREE.WebGLRenderer
      try { renderer=new T.WebGLRenderer({antialias:true,alpha:false}) } catch { setFallback(true); return }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
      renderer.setClearColor(0xf7fafb)
      renderer.domElement.setAttribute("aria-label","可拖动旋转的舵机摇臂三维教学模型")
      container.appendChild(renderer.domElement)
      const scene=new T.Scene()
      const camera=new T.PerspectiveCamera(38,1,.01,100)
      const controls=new OrbitControls(camera,renderer.domElement)
      controls.enableDamping=false; controls.enablePan=false; controls.minDistance=4; controls.maxDistance=14
      controls.target.set(.7,0,.6)
      const render=()=>renderer.render(scene,camera)
      controls.addEventListener("change",render)
      scene.add(new T.HemisphereLight(0xffffff,0x6d879a,2.4))
      const light=new T.DirectionalLight(0xffffff,3); light.position.set(4,8,5); scene.add(light)
      const base=new T.Mesh(new T.BoxGeometry(1.35,1.15,1.9),new T.MeshStandardMaterial({color:0x344f66,roughness:.65}))
      base.position.set(0,-.9,0); scene.add(base)
      for(const z of [-1.07,1.07]){
        const flange=new T.Mesh(new T.BoxGeometry(1.75,.13,.28),new T.MeshStandardMaterial({color:0x45657c,roughness:.65}));flange.position.set(0,-.48,z);scene.add(flange)
        for(const x of [-.6,.6]){const screw=new T.Mesh(new T.CylinderGeometry(.065,.065,.16,16),new T.MeshStandardMaterial({color:0xa7b9c4,metalness:.6,roughness:.4}));screw.position.set(x,-.43,z);scene.add(screw)}
      }
      const cap=new T.Mesh(new T.BoxGeometry(1.33,.2,1.87),new T.MeshStandardMaterial({color:0x5d788b,roughness:.6}));cap.position.set(0,-.26,0);scene.add(cap)
      const shaft=new T.Mesh(new T.CylinderGeometry(.19,.19,.7,32),new T.MeshStandardMaterial({color:0x9dabb7,metalness:.6,roughness:.3}))
      shaft.position.y=-.18;scene.add(shaft)
      const grid=new T.GridHelper(6,12,0xd4e1e5,0xe3ecef);grid.position.y=-1.5;scene.add(grid)
      const group=new T.Group();scene.add(group)
      function disposeGroup() { group.traverse((obj)=>{ const m=obj as THREE.Mesh; m.geometry?.dispose(); if(m.material) (Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose()) });group.clear() }
      function line(points: THREE.Vector3[],color:number,dashed=false) {
        const geometry=new T.BufferGeometry().setFromPoints(points)
        const material=dashed?new T.LineDashedMaterial({color,dashSize:.1,gapSize:.07}):new T.LineBasicMaterial({color})
        const item=new T.Line(geometry,material);if(dashed)item.computeLineDistances();group.add(item)
      }
      function update(p:Params) {
        disposeGroup()
        const y=p.exploded?1.2:.23
        const horn=new T.Mesh(new T.BoxGeometry(p.radius+.35,.16,.32),new T.MeshStandardMaterial({color:0xe4b258,roughness:.65}))
        horn.position.set(p.radius/2,y,0);group.add(horn)
        const hub=new T.Mesh(new T.CylinderGeometry(.28,.28,.19,32),new T.MeshStandardMaterial({color:0xd79f44}));hub.position.y=y;group.add(hub)
        const pin=new T.Mesh(new T.CylinderGeometry(.09,.09,.32,24),new T.MeshStandardMaterial({color:0x5e7789}));pin.position.set(p.radius,y,0);group.add(pin)
        const a=p.angle*Math.PI/180, u=new T.Vector3(Math.cos(a),0,Math.sin(a))
        const origin=new T.Vector3(0,y+.15,0), attach=new T.Vector3(p.radius,y+.15,0)
        const foot=attach.clone().addScaledVector(u,-p.radius*Math.cos(a))
        line([origin,attach],0x193b52)
        line([attach.clone().addScaledVector(u,-2.5),attach.clone().addScaledVector(u,2.5)],0xd47748,true)
        line([origin,foot],0x128a99,true)
        group.add(new T.ArrowHelper(u,attach,1.5,0xd76838,.25,.13))
        if(p.exploded) line([new T.Vector3(0,.25,0),origin],0x8699a8,true)
        render()
      }
      function view(name:string) {
        if(name==="top")camera.position.set(.7,8,.601)
        else if(name==="side")camera.position.set(4.5,.4,6.5)
        else camera.position.set(3.5,3.5,4.4)
        controls.update();render()
      }
      const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render()}
      const observer=new ResizeObserver(resize);observer.observe(container)
      const lost=(event:Event)=>{event.preventDefault();setFallback(true)}
      renderer.domElement.addEventListener("webglcontextlost",lost)
      controller.current={update,view};update(latest.current);view("reset");resize();setReady(true)
      cleanup=()=>{controller.current=null;observer.disconnect();controls.dispose();disposeGroup();scene.traverse(obj=>{const m=obj as THREE.Mesh;m.geometry?.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose())});renderer.domElement.removeEventListener("webglcontextlost",lost);renderer.dispose();renderer.domElement.remove()}
    })().catch(()=>{if(!disposed)setFallback(true)})
    return()=>{disposed=true;cleanup()}
  },[fallback])
  const a=angle*Math.PI/180, px=120+radius*100, py=120
  const fx=px-radius*100*Math.cos(a)**2,fy=py+radius*100*Math.cos(a)*Math.sin(a)
  return <div className="tq-grid"><div>
    <div className="tq-viewport" ref={host} hidden={fallback} />
    {fallback&&<svg className="tq-viewport" viewBox="0 0 500 330" role="img" aria-label="三维不可用时的俯视力臂图"><defs><marker id="tq-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#cd653c"/></marker></defs><line x1="120" y1="120" x2={px} y2={py} stroke="#e4b258" strokeWidth="20"/><circle cx="120" cy="120" r="14" fill="#244e65"/><line x1={px-170*Math.cos(a)} y1={py+170*Math.sin(a)} x2={px+170*Math.cos(a)} y2={py-170*Math.sin(a)} stroke="#cd653c" strokeDasharray="5 5"/><line x1={px} y1={py} x2={px+100*Math.cos(a)} y2={py-100*Math.sin(a)} stroke="#cd653c" strokeWidth="3" markerEnd="url(#tq-arrow)"/><line x1="120" y1="120" x2={fx} y2={fy} stroke="#128a99" strokeWidth="3" strokeDasharray="5 4"/><text x="25" y="260">俯视：金色摇臂 · 橙色拉力 · 青色垂直力臂</text><text x="25" y="290">r⊥ = {torqueFormat(radius*Math.sin(a))} cm</text></svg>}
    <div className="tq-toolbar">{[ ["top","俯视：看力臂"],["side","侧视：看装配"],["reset","恢复视角"] ].map(([v,t])=><button key={v} onClick={()=>controller.current?.view(v)} disabled={fallback||!ready}>{t}</button>)}<button onClick={()=>setFallback(v=>!v)}>{fallback?"尝试三维模型":"查看二维备用图"}</button></div>
  </div><aside className="tq-panel"><p className="tq-eyebrow">THREE.JS · 空间检查</p><h3>半径不是永远等于力臂</h3><p>拖动画面转动视角。俯视看作用线，侧视看转轴怎样连接摇臂。</p><label>摇臂半径 r：{radius.toFixed(1)} cm<input aria-label="三维摇臂半径" type="range" min="0.5" max="2" step="0.1" value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label><label>拉力与半径夹角 φ：{angle}°<input aria-label="拉力夹角" type="range" min="0" max="90" step="15" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><label className="tq-check"><input type="checkbox" checked={exploded} onChange={e=>setExploded(e.target.checked)}/>分解装配：抬起摇臂看转轴</label><dl className="tq-readouts"><div><dt>垂直力臂</dt><dd>{torqueFormat(radius*Math.sin(a))} cm</dd></div><div><dt>固定拉力 10 N 的力矩</dt><dd>{torqueFormat(torqueNm(10,radius,angle))} N·m</dd></div></dl><p className="tq-note">青色虚线：转轴到拉力作用线的垂直距离。分解视图只为观察装配，不表示运行姿态。物体尺寸示意，半径与计算参数一致。</p></aside></div>
}
