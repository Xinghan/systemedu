'use client'
import { useEffect, useRef, useState } from 'react'
import type { BufferGeometry } from 'three'
import { gearOutline, energyDimensions } from '@/lib/project-lines/energy-geometry'
import { gearRatio, type EnergyConfig, type EnergyResult } from '@/lib/project-lines/energy-model'
import styles from './energy-workspace.module.css'

export function EnergyDiagram({ config, angle = 0 }: { config: EnergyConfig; angle?: number }) {
  const d = energyDimensions(config), x = config.teeth / 2 + 10, y = d.depth / 2
  const gears = [{ x, z: config.teeth, a: angle, color: '#cc7754' }, { x: x+d.center, z: config.teeth, a: -angle*config.teeth/18+Math.PI/18, color: '#618675' }, { x: x+d.center, z:18,a:-angle*config.teeth/18+Math.PI/18,color:'#e9c389'}, {x:x+2*d.center,z:18,a:angle*gearRatio(config),color:'#d7a561'}]
  return <svg viewBox={`-3 -4 ${d.width+6} ${d.depth+22}`} role="img" aria-label="两级打印齿轮俯视图；中间两个齿轮同轴固定，上下错层"><rect x="0" y="0" width={d.width} height={d.depth} rx="5" fill="#e4dfce" stroke="#b8b5a2" strokeWidth=".5"/>{gears.map((g,i)=><g key={i} transform={`translate(${g.x} ${y}) rotate(${g.a*180/Math.PI})`}><polygon points={gearOutline(g.z).map(p=>p.join(',')).join(' ')} fill={g.color} stroke="#38493f" strokeWidth=".22"/><circle r="4" fill="#ece6d4"/><circle r="1.6" fill="#69766b"/>{[0,120,240].map(a=><circle key={a} cx={5*Math.cos(a*Math.PI/180)} cy={5*Math.sin(a*Math.PI/180)} r="1" fill="#59645e"/>)}</g>)}<text x={d.width/2} y={d.depth+10} textAnchor="middle" fontSize="5" fill="#465b50">{config.teeth}:18 × {config.teeth}:18 · 理想增速 {gearRatio(config).toFixed(2)} 倍</text></svg>
}
export function EnergyMachineView({ config, result, time }: { config: EnergyConfig; result?: EnergyResult; time: number }) {
  const host=useRef<HTMLDivElement>(null), paint=useRef<((t:number,r?:EnergyResult)=>void)|null>(null)
  const [flat,setFlat]=useState(false),[reset,setReset]=useState(0)
  useEffect(()=>{paint.current?.(time,result)},[time,result])
  useEffect(()=>{
    if(flat||!host.current)return
    let dead=false,cleanup=()=>{}
    Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]).then(([T,{OrbitControls}])=>{
      if(dead||!host.current)return
      const el=host.current,renderer=new T.WebGLRenderer({antialias:true,alpha:false})
      renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor('#e9e7dd'); renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25
      el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','可旋转的 3D 打印发电机构')
      const scene=new T.Scene(),d=energyDimensions(config),x0=config.teeth/2+10,yy=d.depth/2
      const camera=new T.PerspectiveCamera(36,1,.1,2000);camera.position.set(d.width*.55,-d.depth*.85,150);camera.up.set(0,0,1)
      const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(d.width/2,yy,22);controls.minDistance=90;controls.maxDistance=500;controls.enablePan=false
      scene.add(new T.HemisphereLight(0xfff9e5,0x6b7c70,2.5));const sun=new T.DirectionalLight(0xffedcf,4);sun.position.set(-50,-80,220);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-180,right:240,top:180,bottom:-180,near:1,far:700});sun.shadow.normalBias=.15;scene.add(sun)
      const fill=new T.DirectionalLight(0xcbdfe4,2);fill.position.set(260,80,140);scene.add(fill)
      const plastic=(color:string)=>{const m=new T.MeshStandardMaterial({color,roughness:.75,metalness:0});m.onBeforeCompile=s=>{s.vertexShader='varying float printHeight;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nprintHeight=position.z;');s.fragmentShader='varying float printHeight;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.rgb *= 0.986 + 0.014*sin(printHeight*31.416);')};return m}
      const cream=plastic('#dcd7c1'),coral=plastic('#c77051'),green=plastic('#63816c'),yellow=plastic('#cba368'),metal=new T.MeshStandardMaterial({color:'#939a98',metalness:.65,roughness:.35})
      const add=(g:BufferGeometry,m:InstanceType<typeof T.Material>,x:number,y:number,z:number,parent:InstanceType<typeof T.Object3D>=scene)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
      const cylinder=(r:number,h:number,m:InstanceType<typeof T.Material>,x:number,y:number,z:number,parent:InstanceType<typeof T.Object3D>=scene)=>{const g=new T.CylinderGeometry(r,r,h,48);g.rotateX(Math.PI/2);return add(g,m,x,y,z,parent)}
      const floor=add(new T.BoxGeometry(700,600,5),new T.MeshStandardMaterial({color:'#d7d4c7',roughness:.93}),d.width/2,yy,-5);floor.receiveShadow=true
      add(new T.BoxGeometry(d.width,d.depth,3),cream,d.width/2,yy,1.5)
      const groups:InstanceType<typeof T.Group>[]=[]
      const gear=(n:number,x:number,z:number,m:InstanceType<typeof T.Material>)=>{const group=new T.Group();group.position.set(x,yy,z);scene.add(group);const pts=gearOutline(n),s=new T.Shape(pts.map(p=>new T.Vector2(...p)));const h=new T.Path();h.absarc(0,0,(3+config.clearance)/2,0,Math.PI*2,true);s.holes.push(h);for(const a of [0,120,240]){const h=new T.Path();h.absarc(5*Math.cos(a*Math.PI/180),5*Math.sin(a*Math.PI/180),1.15,0,Math.PI*2,true);s.holes.push(h)}const g=new T.ExtrudeGeometry(s,{depth:6,bevelEnabled:true,bevelSegments:2,bevelSize:.12,bevelThickness:.12,steps:1,curveSegments:20});add(g,m,0,0,0,group);groups.push(group);return group}
      cylinder(5,32.5,cream,x0,yy,19.25);cylinder(5,26.5,cream,x0+d.center,yy,16.25)
      cylinder(1.5,47,metal,x0,yy,26);cylinder(1.5,43,metal,x0+d.center,yy,24)
      const first=gear(config.teeth,x0,36,coral);gear(config.teeth,x0+d.center,30,green);gear(18,x0+d.center,36,yellow);gear(18,x0+2*d.center,30,yellow)
      add(new T.BoxGeometry(30,38,3),green,x0+2*d.center,yy,4.5);cylinder(10,24,metal,x0+2*d.center,yy,18);cylinder(1,9,metal,x0+2*d.center,yy,32)
      for(const y of [yy-9,yy+9]){const ring=new T.Mesh(new T.TorusGeometry(10.4,.7,8,48),plastic('#b78b59'));ring.position.set(x0+2*d.center,y,17);ring.rotation.x=Math.PI/2;scene.add(ring)}
      cylinder(7,8,cream,0,0,10,first);add(new T.BoxGeometry(26,10,4),cream,11,0,16,first);cylinder(5,14,coral,22,0,25,first)
      for(const x of [6,d.width-6])for(const y of [6,d.depth-6]){cylinder(3.5,44,cream,x,y,25);cylinder(2.7,2,metal,x,y,48)}
      // 教学观察时显示透明保护范围；实物护罩为不透明打印件，课程提供拆装说明。
      const guard=new T.MeshStandardMaterial({color:'#aec5bd',transparent:true,opacity:.14,roughness:.8,depthWrite:false});add(new T.BoxGeometry(d.width,d.depth,2),guard,d.width/2,yy,47)
      for(const [color,offset] of [['#b55442',-3],['#3c4948',3]] as const){const curve=new T.CatmullRomCurve3([new T.Vector3(x0+2*d.center,yy+offset,9),new T.Vector3(d.width-6,yy+offset,6),new T.Vector3(d.width+6,yy+18+offset,1)]);add(new T.TubeGeometry(curve,30,.55,8,false),plastic(color),0,0,0)}
      const render=()=>{if(!dead)renderer.render(scene,camera)}
      paint.current=(t,r)=>{let angle=0;if(r)for(let i=1;i<=Math.min(Math.floor(t),r.points.length-1);i++)angle+=(r.points[i-1].crank+r.points[i].crank)/2*Math.PI/30;else angle=t*.07;groups[0].rotation.z=angle;groups[1].rotation.z=-angle*config.teeth/18+Math.PI/18;groups[2].rotation.z=groups[1].rotation.z;groups[3].rotation.z=angle*gearRatio(config);render()}
      const resize=()=>{const b=el.getBoundingClientRect();renderer.setSize(b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();render()};const ro=new ResizeObserver(resize);ro.observe(el);controls.addEventListener('change',render)
      const lost=(e:Event)=>{e.preventDefault();setFlat(true)};renderer.domElement.addEventListener('webglcontextlost',lost);controls.update();paint.current(time,result);resize()
      cleanup=()=>{paint.current=null;ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()}
    }).catch(()=>{if(!dead)setFlat(true)})
    return()=>{dead=true;cleanup()}
    // 参数改变重建几何，播放只更新旋转。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[config.teeth,config.clearance,config.meshGap,flat,reset])
  return <div className={styles.viewer}><div className={styles.canvas} ref={host}>{flat&&<EnergyDiagram config={config} angle={time*.07}/>}</div><div className={styles.toolbar}><span>{flat?'二维结构图 · 错层齿轮以俯视表示':'拖动近看机构 · 双指缩放'}</span><button type="button" onClick={()=>setFlat(!flat)}>{flat?'尝试 3D':'切换 2D'}</button><button type="button" onClick={()=>setReset(v=>v+1)}>复位</button></div><small>打印结构设计预览 · 护罩透明仅便于观察，实物为打印件。模型尚未实物试制。</small></div>
}
