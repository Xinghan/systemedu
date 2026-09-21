'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { solarPower, windPower, type Config, type Mode } from '@/lib/project-lines/renewable-model'
import styles from './renewable-workspace.module.css'

/** Modelled objects, lighting and inspection camera; no generated photo substituted for interaction. */
export function RenewableScene({config:c,mode,playing}:{config:Config;mode:Mode;playing:boolean}){
  const host=useRef<HTMLDivElement>(null),live=useRef({c,playing}),[fallback,setFallback]=useState(false)
  useEffect(()=>{live.current={c,playing}},[c,playing])
  useEffect(()=>{
    const el=host.current;if(!el)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})}catch{setFallback(true);return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.setClearColor('#e9e6dc');el.appendChild(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(...(['solar','wind','storage'].includes(mode)?[2.8,2.1,3.3]:[3.5,2.5,4]) as [number,number,number])
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.65,0);controls.enableDamping=true;controls.minDistance=2.4;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=false
    scene.add(new THREE.HemisphereLight(0xfff4df,0x637d83,1.8));const sun=new THREE.DirectionalLight(0xfff1dc,2.1);sun.position.set(-3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.025;scene.add(sun)
    const mat=(color:string,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness})
    const ivory=mat('#efede3'),coral=mat('#b96b4e'),teal=mat('#467b75'),dark=mat('#293c41'),cell=mat('#173e58',.25,.26),copper=mat('#b99159',.45),green=mat('#485d49'),rubber=mat('#303b36')
    function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:number[],parent:THREE.Object3D=scene){const o=new THREE.Mesh(g,m);o.position.set(p[0],p[1],p[2]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
    const box=(x:number,y:number,z:number,m:THREE.Material,p:number[],parent?:THREE.Object3D)=>mesh(new THREE.BoxGeometry(x,y,z),m,p,parent)
    const cyl=(r:number,h:number,m:THREE.Material,p:number[],parent?:THREE.Object3D)=>mesh(new THREE.CylinderGeometry(r,r,h,48),m,p,parent)
    mesh(new THREE.PlaneGeometry(200,200),mat('#dedbce'),[0,-.035,0]).rotation.x=-Math.PI/2
    box(['solar','wind','storage'].includes(mode)?2.2:4,.12,1.8,ivory,[0,.03,0]);for(const x of (['solar','wind','storage'].includes(mode)?[-.85,.85]:[-1.6,1.6]))for(const z of [-.65,.65])cyl(.07,.08,rubber,[x,-.015,z])
    const solar=new THREE.Group();solar.position.x=mode==='solar'?0:-1;scene.add(solar)
    box(1.2,.09,.9,coral,[0,.14,0],solar);for(const x of [-.46,.46]){box(.08,.75,.35,coral,[x,.52,0],solar);const bolt=cyl(.055,.13,copper,[x,.88,0],solar);bolt.rotation.z=Math.PI/2}
    const panel=new THREE.Group();panel.position.y=.88;solar.add(panel);box(1.18,.065,1.18,coral,[0,0,0],panel);box(1.04,.03,1.04,dark,[0,.045,0],panel)
    for(let x=0;x<5;x++)for(let z=0;z<5;z++){box(.182,.012,.182,cell,[-.4+x*.2,.067,-.4+z*.2],panel);for(let a=0;a<3;a++)box(.175,.002,.002,mat('#81a1a9',.4),[-.4+x*.2,.075,-.445+z*.2+a*.043],panel)}
    for(let i=0;i<17;i++)box(1.19,.002,.003,mat('#c78a72'),[0,-.025+i*.003, .592],panel)
    const wind=new THREE.Group();wind.position.set(mode==='wind'?0:1.05,0,0);scene.add(wind)
    box(.9,.09,.85,teal,[0,.14,0],wind);box(.15,1.15,.2,teal,[0,.7,.16],wind);const motor=cyl(.12,.38,mat('#a2aca8',.6),[0,1.25,.12],wind);motor.rotation.x=Math.PI/2
    const rotor=new THREE.Group();rotor.position.set(0,1.25,-.14);wind.add(rotor);const hub=cyl(.12,.11,teal,[0,0,0],rotor);hub.rotation.x=Math.PI/2
    const blades:THREE.Object3D[]=[];for(let i=0;i<3;i++){const arm=new THREE.Group();arm.rotation.z=i*Math.PI*2/3;rotor.add(arm);const blade=box(.15,.48,.025,teal,[0,.34,0],arm);blades.push(blade);cyl(.025,.04,copper,[0,.07,0],arm)}
    for(const z of [-.29,.08])mesh(new THREE.TorusGeometry(.75,.026,8,96),ivory,[0,1.25,z],wind)
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;box(.015,1.45,.012,ivory,[0,1.25,-.31],wind).rotation.z=angle}
    for(let i=0;i<3;i++)mesh(new THREE.TorusGeometry(.24+i*.17,.009,6,64),ivory,[0,1.25,-.315],wind)
    const board=new THREE.Group();board.position.set(0,.18,.75);scene.add(board);box(.9,.07,.43,ivory,[0,0,0],board);box(.65,.025,.32,green,[0,.047,0],board)
    for(const x of [-.2,.1]){cyl(.066,.18,dark,[x,.15,0],board);cyl(.05,.004,mat('#aaa9a0',.5),[x,.243,0],board)}
    for(let i=0;i<6;i++)box(.025,.04,.04,copper,[-.25+i*.09,.08,.13],board)
    const led=mesh(new THREE.SphereGeometry(.055,24,16),new THREE.MeshStandardMaterial({color:'#f2c45b',emissive:'#e3aa34',emissiveIntensity:1.6}),[.32,.13,0],board)
    const paths=[new THREE.Vector3(-.7,.18,.15),new THREE.Vector3(-.5,.19,.5),new THREE.Vector3(-.3,.24,.65)]
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(paths),32,.014,8,false),coral,[0,0,0]);mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(paths.map(p=>p.clone().add(new THREE.Vector3(.07,0,0)))),32,.012,8,false),dark,[0,0,0])
    solar.visible=!['wind','storage'].includes(mode);wind.visible=!['solar','storage'].includes(mode);if(mode==='storage'){board.scale.setScalar(2.5);board.position.set(0,.25,0)}
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(el);resize()
    const lost=(e:Event)=>{e.preventDefault();setFallback(true)};renderer.domElement.addEventListener('webglcontextlost',lost)
    let raf=0,previous=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame=(time:number)=>{raf=requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min(.04,(time-previous)/1000);previous=time;const {c,playing}=live.current;panel.rotation.x=c.tilt*Math.PI/180;blades.forEach(b=>{b.rotation.y=c.pitch*Math.PI/180;b.scale.y=1});rotor.scale.setScalar(c.radius/55);if(playing&&!reduced)rotor.rotation.z+=dt*2.5;led.scale.setScalar(playing&&!reduced?1+Math.sin(time/250)*.1:1);controls.update();renderer.render(scene,camera)};raf=requestAnimationFrame(frame)
    return()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()}
  },[mode])
  return <div className={styles.sceneFrame}><div ref={host} className={styles.scene} role="img" aria-label="可转动查看的桌面太阳能、打印风机和储能装置三维示意；下方参数改变装置与模拟"/>{fallback&&<svg className={styles.fallback} viewBox="0 0 700 330" role="img" aria-label="二维替代视图，操作与模拟仍然可用"><defs><linearGradient id="panel" x2="1" y2="1"><stop stopColor="#2b718e"/><stop offset="1" stopColor="#102c42"/></linearGradient></defs><rect width="700" height="330" fill="#e9e6dc"/><path d="M100 265H600" stroke="#bab7a9"/><g transform={`translate(210 175) rotate(${-c.tilt})`}><rect x="-75" y="-45" width="150" height="90" rx="5" fill="url(#panel)" stroke="#bb7558" strokeWidth="9"/>{[-50,-25,0,25,50].map(x=><path key={x} d={`M${x} -42V42`} stroke="#a4bec7"/>)}</g><path d="M210 170V260M480 110V260" stroke="#53857e" strokeWidth="14"/><circle cx="480" cy="125" r="76" fill="none" stroke="#c3c9bc" strokeWidth="8"/>{[0,120,240].map(a=><path key={a} d="M475 125L465 64Q484 42 493 78L485 125" fill="#53857e" transform={`rotate(${a} 480 125)`}/>)}<text x="40" y="35" fill="#33463e">二维替代视图 · 参数仍可操作</text><text x="40" y="310" fill="#33463e">光 {solarPower(c,45,1).toFixed(1)} mW　风 {windPower(c,3.2).toFixed(1)} mW · 教学模型</text></svg>}<span className={styles.sceneHint}>拖动查看 · 双指缩放 · 参数可用方向键调整</span></div>
}
