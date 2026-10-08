"use client"
import { useEffect, useRef, useState } from "react"
import type * as THREE from "three"
import { molecularPlaneNormal, type MolecularGeometry } from "@/lib/molecule-skeleton"
import { drawSmilesSvg } from "@/lib/rdkit"

export function MoleculeDiagram({smiles,highlight=[],explicitHydrogens=false}:{smiles:string;highlight?:number[];explicitHydrogens?:boolean}) {
  const [result,setResult]=useState<{smiles:string;svg:string}|null>(null)
  const key=highlight.join(","),inputKey=`${smiles}:${explicitHydrogens}:${key}`
  useEffect(()=>{let active=true;drawSmilesSvg(smiles,{width:460,height:240,explicitHydrogens,highlightAtoms:key?key.split(",").map(Number):[]}).then(svg=>{if(active)setResult({smiles:inputKey,svg})}).catch(()=>{if(active)setResult({smiles:inputKey,svg:""})});return()=>{active=false}},[smiles,key,explicitHydrogens,inputKey])
  return result?.smiles===inputKey&&result.svg?<div className="ms-structure" role="img" aria-label={`RDKit ${explicitHydrogens?"含氢":"骨架"}结构式：${smiles}`} dangerouslySetInnerHTML={{__html:result.svg}}/>:<div className="ms-structure">{result?.smiles===inputKey?`结构图暂不可用；SMILES：${smiles}`:"RDKit 正在绘制精确结构…"}</div>
}

type Options={showH:boolean;selected:number|null}
type Controller={update:(options:Options)=>void;view:(name:string)=>void}
export function MolecularObject3D({molecule,showH,selected,onSelect,readOnly=false,presetView="reset",observationPlane}:{molecule:MolecularGeometry;showH:boolean;selected:number|null;onSelect?:(id:number)=>void;readOnly?:boolean;presetView?:"reset"|"face"|"edge"|"oblique";observationPlane?:readonly[number,number,number]}) {
  const host=useRef<HTMLDivElement>(null),controller=useRef<Controller|null>(null)
  const callback=useRef(onSelect),latest=useRef<Options>({showH,selected})
  const latestView=useRef(presetView)
  const planeKey=observationPlane?.join(',')
  const [fallback,setFallback]=useState(false),[ready,setReady]=useState(false)
  useEffect(()=>{callback.current=onSelect},[onSelect])
  useEffect(()=>{latest.current={showH,selected};controller.current?.update(latest.current)},[showH,selected])
  useEffect(()=>{latestView.current=presetView;controller.current?.view(presetView)},[presetView])
  useEffect(()=>{
    if(fallback)return
    let disposed=false,cleanup=()=>{}
    void(async()=>{
      const T=await import("three"),{OrbitControls}=await import("three/addons/controls/OrbitControls.js")
      if(disposed||!host.current)return
      const container=host.current
      let renderer:THREE.WebGLRenderer
      try{renderer=new T.WebGLRenderer({antialias:true,alpha:false})}catch{setFallback(true);return}
      renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(readOnly?new T.Color(getComputedStyle(container).getPropertyValue('--paper').trim()||'#faf8f2'):0xf2f7f6)
      renderer.domElement.setAttribute("aria-label",`${molecule.name}：PubChem 计算坐标三维模型${readOnly?'，只读预设视角':'，可拖动旋转并点击原子'}`)
      renderer.domElement.setAttribute("role","img");container.appendChild(renderer.domElement)
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(37,1,.01,100)
      // Lecture mode never attaches OrbitControls listeners (including touch/wheel).
      const controls=readOnly?null:new OrbitControls(camera,renderer.domElement)
      if(controls){controls.enablePan=false;controls.enableDamping=false;controls.minDistance=3;controls.maxDistance=18}
      scene.add(new T.HemisphereLight(0xffffff,0x739186,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,5,7);scene.add(light)
      const center=new T.Vector3();molecule.atoms.forEach(a=>center.add(new T.Vector3(...a.position)));center.divideScalar(molecule.atoms.length)
      const positions=molecule.atoms.map(a=>new T.Vector3(...a.position).sub(center))
      const extent=Math.max(...positions.map(p=>p.length()))+.4,viewDistance=Math.max(5.3,extent*3.5)
      const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[]
      const spheres:THREE.Mesh[]=[]
      const colors:Record<string,number>={C:0x374e60,H:0xf3f4ee,O:0xca574b,N:0x537fb8}
      const sphereGeom=new T.SphereGeometry(1,30,22);geometries.push(sphereGeom)
      molecule.atoms.forEach(a=>{
        const material=new T.MeshStandardMaterial({color:colors[a.element]||0x6c9e82,roughness:.4,metalness:.05});materials.push(material)
        const sphere=new T.Mesh(sphereGeom,material),r=a.element==="H"?.18:.3
        sphere.scale.setScalar(r);sphere.position.copy(positions[a.id]);sphere.userData.atom=a.id;scene.add(sphere);spheres.push(sphere)
      })
      const sticks:Array<{mesh:THREE.Mesh;bond:typeof molecule.bonds[number]}>=[]
      const bondMaterial=new T.MeshStandardMaterial({color:0x8a9b9e,roughness:.45});materials.push(bondMaterial)
      molecule.bonds.forEach(b=>{
        const start=positions[b.a],end=positions[b.b],delta=end.clone().sub(start),len=delta.length()
        // Benzene's equivalent aromatic C-C connections must not imply alternating physical lengths.
        const geometry=new T.CylinderGeometry(.07,.07,len,14);geometries.push(geometry)
        const mesh=new T.Mesh(geometry,bondMaterial);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());scene.add(mesh);sticks.push({mesh,bond:b})
      })
      const render=()=>{if(!disposed)renderer.render(scene,camera)}
      controls?.addEventListener("change",render)
      function update(o:Options){
        spheres.forEach((s,i)=>{s.visible=o.showH||molecule.atoms[i].element!=="H";const mat=s.material as THREE.MeshStandardMaterial;mat.emissive.setHex(i===o.selected?0xa06419:0);mat.emissiveIntensity=i===o.selected?.5:0})
        sticks.forEach(({mesh,bond})=>{mesh.visible=o.showH||(molecule.atoms[bond.a].element!=="H"&&molecule.atoms[bond.b].element!=="H")});render()
      }
      function view(name:string){
        let normal=new T.Vector3(...molecularPlaneNormal(molecule)),edge=positions[1].clone().sub(positions[0]).normalize()
        if(planeKey){
          const [a,b,c]=planeKey.split(',').map(Number)
          const u=positions[a]?.clone().sub(positions[b]),v=positions[c]?.clone().sub(positions[b])
          if(u&&v&&u.clone().cross(v).lengthSq()>1e-10){normal=u.clone().cross(v).normalize();edge=u.normalize()}
        }
        if(name==="face"){camera.up.copy(edge);camera.position.copy(normal.multiplyScalar(viewDistance))}
        else if(name==="edge"){camera.up.copy(normal);camera.position.copy(edge.multiplyScalar(viewDistance))}
        else if(name==="oblique"){camera.up.copy(edge);camera.position.copy(normal.addScaledVector(edge,.45).normalize().multiplyScalar(viewDistance))}
        else{camera.up.set(0,1,0);camera.position.set(viewDistance*.65,viewDistance*.4,viewDistance*.7)}
        camera.lookAt(0,0,0);controls?.update();render()
      }
      let pointerStart=[0,0]
      const down=(e:PointerEvent)=>{pointerStart=[e.clientX,e.clientY]}
      const pick=(e:PointerEvent)=>{
        if(Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return
        const rect=renderer.domElement.getBoundingClientRect(),pointer=new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),ray=new T.Raycaster()
        ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(spheres.filter(s=>s.visible))[0]
        if(hit)callback.current?.(hit.object.userData.atom)
      }
      if(!readOnly){renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointerup",pick)}
      const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render()}
      const observer=new ResizeObserver(resize);observer.observe(container)
      const lost=(e:Event)=>{e.preventDefault();setFallback(true)};renderer.domElement.addEventListener("webglcontextlost",lost)
      controller.current={update,view};update(latest.current);view(latestView.current);resize();setReady(true)
      cleanup=()=>{controller.current=null;observer.disconnect();controls?.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointerup",pick);renderer.domElement.removeEventListener("webglcontextlost",lost);renderer.dispose();renderer.domElement.remove()}
    })().catch(()=>{if(!disposed)setFallback(true)})
    return()=>{disposed=true;cleanup()}
  },[molecule,fallback,readOnly,planeKey])
  return <div className="ms-object" data-readonly-3d={readOnly} data-webgl-ready={ready&&!fallback} data-camera-preset={readOnly?presetView:undefined}><div ref={host} className="ms-viewport" hidden={fallback}/>{fallback&&<div className="ms-fallback"><strong>当前显示二维备用结构</strong><MoleculeDiagram smiles={molecule.smiles}/><p>WebGL 不可用或已切到备用图。计数与坐标数据仍可在右侧读取。</p></div>}<div className="ms-legend"><span><i style={{background:"#374e60"}}/>碳 C</span><span><i style={{background:"#f3f4ee"}}/>氢 H</span><span><i style={{background:"#ca574b"}}/>氧 O</span><span>球大小仅为辨认，不代表真实半径</span></div>{!readOnly&&<div className="se-controls"><button className="secondary" disabled={fallback||!ready} onClick={()=>controller.current?.view("face")}>正面观察</button><button className="secondary" disabled={fallback||!ready} onClick={()=>controller.current?.view("edge")}>沿侧面观察</button><button className="secondary" disabled={fallback||!ready} onClick={()=>controller.current?.view("reset")}>恢复空间视角</button><button className="secondary" onClick={()=>setFallback(v=>!v)}>{fallback?"尝试 3D":"二维备用图"}</button></div>}<p className="ms-caption">{fallback?"备用显示":readOnly?"Three.js / WebGL · 只读预设视角":"Three.js / WebGL · 拖动旋转，滚轮缩放，点选原子"} · 坐标单位 Å</p></div>
}
