"use client"
import { useEffect, useRef, useState } from 'react'
import type * as Three from 'three'
import type { MoleculeModel } from '@/lib/project-lines/biomed-model'
import styles from './biomed-workspace.module.css'

const COLORS: Record<string,string> = { C:'#344b50', O:'#cf634c', N:'#477eab', H:'#e9e4d8' }
export type MoleculePose = { camera: number[]; up: number[]; target: number[]; mode: '3d' | '2d' }
export const INITIAL_POSE: MoleculePose = { camera:[9,7,12],up:[0,1,0],target:[0,0,0],mode:'3d' }

export function MoleculeDiagram({ model, selected = -1, onSelect }: { model: MoleculeModel; selected?:number; onSelect?:(index:number)=>void }) {
  const heavy = model.atoms.filter(a=>a.flat)
  const x=heavy.map(a=>a.flat![0]), y=heavy.map(a=>a.flat![1])
  const cx=(Math.min(...x)+Math.max(...x))/2, cy=(Math.min(...y)+Math.max(...y))/2
  const scale=Math.min(360/(Math.max(...x)-Math.min(...x)+1),230/(Math.max(...y)-Math.min(...y)+1))
  const p=(i:number)=>({x:220+(model.atoms[i].flat![0]-cx)*scale,y:155-(model.atoms[i].flat![1]-cy)*scale})
  return <svg viewBox="0 0 440 310" className={styles.moleculeSvg} role="img" aria-label={`${model.name}二维连接图，氢省略`}>
    <title>{`${model.name}真实结构连接图，氢省略；虚线表示芳香键`}</title>
    {model.bonds.filter(b=>model.atoms[b.a].flat&&model.atoms[b.b].flat).map((b,i)=>{const a=p(b.a),c=p(b.b),len=Math.hypot(c.x-a.x,c.y-a.y),dx=-(c.y-a.y)/len*4,dy=(c.x-a.x)/len*4;return <g key={i} stroke="#687c7c" strokeWidth="3" strokeLinecap="round"><line x1={a.x} y1={a.y} x2={c.x} y2={c.y}/>{b.order>1&&<line x1={a.x+dx} y1={a.y+dy} x2={c.x+dx} y2={c.y+dy} strokeWidth="2" strokeDasharray={b.order===1.5?'4 4':undefined}/>}</g>})}
    {model.atoms.map((a,i)=>a.flat&&<g key={i} onClick={()=>onSelect?.(i)} style={{cursor:onSelect?'pointer':'default'}}>{selected===i&&<circle cx={p(i).x} cy={p(i).y} r="22" fill="#edd4a2"/>}<circle cx={p(i).x} cy={p(i).y} r="14" fill={COLORS[a.element]||'#7d9180'}/><text x={p(i).x} y={p(i).y+4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">{a.element}</text></g>)}
    <text x="220" y="299" textAnchor="middle" fill="#647272" fontSize="11">2D 连接图 · 省略氢 · 不表示真实空间角度</text>
  </svg>
}

export function BiomedMoleculeView({ model, selected, onSelect, initialPose=INITIAL_POSE, onPose }: { model:MoleculeModel; selected:number; onSelect:(i:number)=>void; initialPose?:MoleculePose; onPose:(pose:MoleculePose)=>void }) {
  const host=useRef<HTMLDivElement>(null), selectRef=useRef(onSelect),poseRef=useRef(onPose)
  useEffect(()=>{selectRef.current=onSelect;poseRef.current=onPose},[onSelect,onPose])
  const [fallback,setFallback]=useState(initialPose.mode==='2d'),[reset,setReset]=useState(0)
  const paint=useRef<((i:number)=>void)|null>(null)
  useEffect(()=>{paint.current?.(selected)},[selected])
  useEffect(()=>{
    if(fallback||!host.current){if(fallback)poseRef.current({...INITIAL_POSE,mode:'2d'});return}
    let disposed=false, cleanup=()=>{}
    Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]).then(([T,{OrbitControls}])=>{
      if(disposed||!host.current)return
      const el=host.current,renderer=new T.WebGLRenderer({antialias:true,alpha:true})
      renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#e7ebe3',1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25
      el.appendChild(renderer.domElement)
      renderer.domElement.setAttribute('aria-label',`${model.name}可旋转三维模型`)
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,100)
      const pose=reset?INITIAL_POSE:initialPose
      camera.position.fromArray(pose.camera);camera.up.fromArray(pose.up)
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=false;controls.minDistance=7;controls.maxDistance=30;controls.target.fromArray(pose.target)
      scene.add(new T.HemisphereLight(0xfffff0,0x496365,2.5))
      const key=new T.DirectionalLight(0xffeed3,4);key.position.set(6,10,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key)
      const rim=new T.DirectionalLight(0xb8dcdd,3);rim.position.set(-7,3,-5);scene.add(rim)
      const group=new T.Group();scene.add(group)
      const atoms:Three.Mesh[]=[]
      for(const atom of model.atoms){const material=new T.MeshStandardMaterial({color:COLORS[atom.element]||'#6b9574',roughness:.23,metalness:.22});const mesh=new T.Mesh(new T.SphereGeometry(atom.element==='H'?.22:.38,32,24),material);mesh.position.fromArray(atom.position);mesh.castShadow=true;group.add(mesh);atoms.push(mesh)}
      const stick=(a:Three.Vector3,b:Three.Vector3,color:string,radius:number)=>{const diff=b.clone().sub(a),mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,diff.length(),16),new T.MeshStandardMaterial({color,metalness:.3,roughness:.26}));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),diff.normalize());mesh.castShadow=true;group.add(mesh)}
      for(const bond of model.bonds){const a=new T.Vector3().fromArray(model.atoms[bond.a].position),b=new T.Vector3().fromArray(model.atoms[bond.b].position);const direction=b.clone().sub(a).normalize();let offset=new T.Vector3().crossVectors(direction,new T.Vector3(0,0,1));if(offset.length()<.1)offset=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0));offset.normalize().multiplyScalar(.085);const offsets=bond.order===2?[-1,1]:[0];for(const n of offsets){const start=a.clone().addScaledVector(offset,n),end=b.clone().addScaledVector(offset,n),mid=start.clone().add(end).multiplyScalar(.5);stick(start,mid,COLORS[model.atoms[bond.a].element],.075);stick(mid,end,COLORS[model.atoms[bond.b].element],.075)}}
      const floor=new T.Mesh(new T.CylinderGeometry(5.2,5.35,.18,96),new T.MeshStandardMaterial({color:0xc9d3c5,roughness:.8,metalness:.05}));floor.position.y=-3.8;floor.receiveShadow=true;scene.add(floor)
      const ring=new T.Mesh(new T.TorusGeometry(5.18,.025,8,100),new T.MeshStandardMaterial({color:0xb99557,metalness:.7,roughness:.3}));ring.rotation.x=Math.PI/2;ring.position.y=-3.68;scene.add(ring)
      const render=()=>{if(!disposed)renderer.render(scene,camera)}
      paint.current=(index)=>{atoms.forEach((mesh,i)=>{const mat=mesh.material as Three.MeshStandardMaterial;mat.emissive.set(i===index?0xb97822:0);mat.emissiveIntensity=i===index?.55:0});render()};paint.current(selected)
      const resize=()=>{const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();render()}
      const observer=new ResizeObserver(resize);observer.observe(el)
      const changed=()=>{render();poseRef.current({camera:camera.position.toArray(),up:camera.up.toArray(),target:controls.target.toArray(),mode:'3d'})}
      controls.addEventListener('change',changed)
      let start=[0,0]
      const down=(e:PointerEvent)=>{start=[e.clientX,e.clientY]}
      const up=(e:PointerEvent)=>{if(Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(atoms)[0];if(hit)selectRef.current(atoms.indexOf(hit.object as Three.Mesh))}
      const lost=(e:Event)=>{e.preventDefault();setFallback(true)}
      renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('webglcontextlost',lost)
      controls.update();resize()
      cleanup=()=>{paint.current=null;observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()}
    }).catch(()=>{if(!disposed)setFallback(true)})
    return()=>{disposed=true;cleanup()}
    // 初始视角只在换分子或复位时读取；保存草稿不会重建场景。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[model.id,fallback,reset])
  return <div className={styles.viewer}><div ref={host} className={styles.canvas}>{fallback&&<MoleculeDiagram model={model} selected={selected} onSelect={onSelect}/>}</div><div className={styles.viewerToolbar}><span>{fallback?'二维结构模式':'拖动旋转 · 滚轮或双指缩放'}</span><button type="button" onClick={()=>{setFallback(!fallback);setReset(n=>n+1)}}>{fallback?'尝试 3D':'查看 2D'}</button><button type="button" onClick={()=>setReset(n=>n+1)}>复位视角</button></div><p className={styles.caption}>计算构象 · C 碳（深青）/ O 氧（珊瑚）/ N 氮（蓝）/ H 氢（浅色）。原子大小为显示约定，芳香键在 3D 中简化为连接杆；精确连接请看 2D。</p></div>
}
