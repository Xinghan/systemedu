"use client"
import {useEffect,useRef,useState} from "react"
import type {RoverDesign} from "@/lib/project-lines/rover-system"
import styles from "./rover-system-workspace.module.css"

export function RoverBuildView({design}:{design:RoverDesign}){
  const host=useRef<HTMLDivElement>(null),rotate=useRef<(n:number)=>void>(()=>{}),[exploded,setExploded]=useState(false),[fallback,setFallback]=useState(false)
  const width=Number(design.width),thickness=Number(design.thickness),large=design.wheel==='large',extended=design.battery==='extended'
  useEffect(()=>{
    let disposed=false,cleanup=()=>{}
    void(async()=>{
      const T=await import('three'),{OrbitControls}=await import('three/addons/controls/OrbitControls.js')
      if(disposed||!host.current)return
      const container=host.current
      try{
        const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xe4dac5);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2
        container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','当前尺寸的双电机探测车结构，可拖动旋转');renderer.domElement.setAttribute('role','img')
        const scene=new T.Scene(),camera=new T.PerspectiveCamera(37,1,1,1800);camera.position.set(130,155,175)
        const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=190;controls.maxDistance=600;controls.target.set(0,exploded?45:25,0)
        scene.add(new T.HemisphereLight(0xfff9e8,0x65756b,2.6));const sun=new T.DirectionalLight(0xfff1d3,3.3);sun.position.set(100,280,90);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:600});scene.add(sun)
        const materials=[0xd77f55,0x1f3431,0x293033,0xb59d60,0x557f68,0xdedbd0,0x9da2a0].map((color,i)=>new T.MeshStandardMaterial({color,roughness:i===3||i===6?.32:.74,metalness:i===3||i===6?.7:.08}))
        const add=(geometry:import('three').BufferGeometry<import('three').NormalBufferAttributes>,mi:number,pos:number[])=>{const m=new T.Mesh(geometry,materials[mi]);m.position.set(pos[0],pos[1],pos[2]);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
        const box=(x:number,y:number,z:number,mi:number,pos:number[])=>add(new T.BoxGeometry(x,y,z),mi,pos)
        const cyl=(r:number,h:number,mi:number,pos:number[])=>add(new T.CylinderGeometry(r,r,h,48),mi,pos)
        const cable=(points:number[][],color:number)=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));return add(new T.TubeGeometry(curve,24,.65,8,false),color,[0,0,0])}
        const lift=exploded?30:0,deckY=29+lift
        const shape=new T.Shape();shape.moveTo(-width/2,-75);shape.lineTo(width/2,-75);shape.lineTo(width/2,75);shape.lineTo(-width/2,75);shape.closePath()
        for(const x of [-width/2+12,width/2-12])for(const z of [-55,-35,0,35,55]){const h=new T.Path();h.absarc(x,z,1.7,0,Math.PI*2,true);shape.holes.push(h)}
        const hole=(x:number,z:number,w:number,h:number)=>{const p=new T.Path();p.moveTo(x-w/2,z-h/2);p.lineTo(x-w/2,z+h/2);p.lineTo(x+w/2,z+h/2);p.lineTo(x+w/2,z-h/2);p.closePath();shape.holes.push(p)}
        for(const x of [-width/2+8,width/2-8])for(const z of [-43,-25])hole(x,z,4,10);for(const x of [-20,20])hole(x,24,4,28)
        const plate=add(new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}),0,[0,deckY,0]);plate.rotation.x=-Math.PI/2
        for(const x of [-width/2+12,width/2-12])for(const z of [-55,0,55]){cyl(3,2,6,[x,deckY+thickness+1,z]);cyl(1.5,7,6,[x,deckY-1,z])}
        for(const side of [-1,1]){
          const wheelX=side*(width/2+7),r=large?21:16
          box(25,10,12,6,[side*(width/2-17),r,-35]);box(10,12,12,3,[side*(width/2-3),r,-35]);const axle=cyl(1.5,20,6,[side*(width/2+3),r,-35]);axle.rotation.z=Math.PI/2
          const tire=cyl(r,9,2,[wheelX,r,-35]);tire.rotation.z=Math.PI/2
          const hub=cyl(r*.6,10,5,[wheelX,r,-35]);hub.rotation.z=Math.PI/2;const center=cyl(3,11,3,[wheelX,r,-35]);center.rotation.z=Math.PI/2
          for(let i=0;i<28;i++){const a=i/28*Math.PI*2;const cleat=box(10,1.4,2.5,2,[wheelX,r+Math.cos(a)*r,-35+Math.sin(a)*r]);cleat.rotation.x=a}
          box(4,3,25,1,[side*(width/2-14),27,-35]);cable([[side*(width/2-18),24,-31],[side*24,deckY+9,-26],[side*23,deckY+thickness+8,-2]],3)
        }
        cyl(5,18,6,[0,16,53]);add(new T.SphereGeometry(6,24,16),6,[0,6,53]);box(17,3,17,5,[0,26,53])
        const boardY=deckY+thickness+4+(exploded?16:0)
        box(21,2,51,4,[0,boardY,-15]);box(8,2,8,2,[0,boardY+2,-13]);box(8,4,6,6,[0,boardY+3,-41]);for(const side of [-1,1])for(let i=0;i<20;i++)box(1.5,4,1.5,3,[side*9,boardY+2,-39+i*2.54])
        box(16,2,21,4,[26,boardY,-10]);box(6,3,7,2,[26,boardY+3,-10]);box(18,6,5,1,[26,boardY+4,1]);for(const x of [20,24,28,32])cyl(1,1,6,[x,boardY+7,1])
        const batteryY=deckY+thickness+10+(exploded?25:0);box(extended?40:32,16,48,1,[0,batteryY,37]);for(const x of [-10,10])box(4,1,52,5,[x,batteryY+8.5,37]);cable([[16,batteryY,35],[32,boardY+13,20],[30,boardY+7,0]],0);cable([[-16,batteryY,35],[-26,boardY+12,6],[-8,boardY+4,-5]],2)
        box(width-16,3,12,0,[0,deckY+3,-80]);box(width-16,16,3,0,[0,deckY+9,-84.5]);for(const x of [-22,22]){box(12,6,6,2,[x,deckY+5,-67]);cable([[x,deckY+8,-67],[x*.7,boardY+10,-48],[8,boardY+4,-30]],3)}
        const floor=add(new T.PlaneGeometry(2000,2000),5,[0,-.1,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false
        const render=()=>{if(disposed)return;const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)}
        rotate.current=(delta)=>{const v=camera.position.clone().sub(controls.target);v.applyAxisAngle(new T.Vector3(0,1,0),delta);camera.position.copy(v.add(controls.target));controls.update();render()}
        controls.addEventListener('change',render);const resize=new ResizeObserver(render);resize.observe(container);controls.update();render();container.dataset.renderer='webgl'
        cleanup=()=>{resize.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove()}
      }catch{setFallback(true)}
    })()
    return()=>{disposed=true;cleanup()}
  },[width,thickness,large,extended,exploded])
  return <figure className={styles.buildView}><div className={styles.viewTools}><button type="button" onClick={()=>rotate.current(-.35)}>向左旋转</button><button type="button" onClick={()=>rotate.current(.35)}>向右旋转</button><button type="button" aria-pressed={exploded} onClick={()=>setExploded(!exploded)}>{exploded?'合拢结构':'展开结构'}</button></div>{fallback?<svg viewBox="0 0 300 240" role="img" aria-label="当前设计的双轮底盘俯视图"><rect x={150-width/2} y="35" width={width} height="150" rx="4" fill="#c58160" stroke="#543c32"/>{[-1,1].map(s=><g key={s}><rect x={150+s*(width/2+7)-5} y="60" width="10" height={large?42:32} fill="#283730"/>{[-55,-35,0,35,55].map(y=><circle key={y} cx={150+s*(width/2-12)} cy={110+y} r="2" fill="#faf9f5"/>)}</g>)}<rect x="139" y="70" width="21" height="51" fill="#547d65"/><rect x="130" y="125" width="40" height="48" fill="#293b36"/><text x="35" y="215" fontSize="12">宽 {width} mm · 厚 {thickness} mm · 矢量结构图</text></svg>:<div ref={host} className={styles.scene}/> }<figcaption>当前设计的结构示意，可旋转查看。电池、轮子和尺寸随选择变化；加工配合以实测为准。</figcaption></figure>
}
