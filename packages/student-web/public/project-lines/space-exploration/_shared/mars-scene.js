import { GRID, TARGETS } from "./models.mjs";
import { createMissionAssets } from "./mission-assets.js";
import { createTerrain, createEnvironment } from "./mission-terrain.js";
import { createInstruments, vehicleSVG } from "./mission-vector.js";

export const VISUAL_VERSION = "mars-expedition/2";

export async function createMarsScene(kind) {
  const root=document.querySelector("#scene"),cameraRoot=document.querySelector("#camera-view"),modeLabel=document.querySelector("#render-mode");
  const instrument=createInstruments(root,kind),reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  let canvas,preview,last=null,renderImpl=()=>{},takeSnapshot=()=>"",disposeGraphics=()=>{},destroyed=false,fallbackActive=false,frame=0;
  let view="follow",orbit=0,elevation=0,zoom=1;
  const controls=document.createElement("div");controls.className="scene-controls";controls.setAttribute("aria-label","观察视角");
  controls.innerHTML=`<div class="view-options"><button type="button" data-view="follow" aria-pressed="true">${kind==="lander"?"着陆视角":"跟随车"}</button><button type="button" data-view="overview" aria-pressed="false">全景</button><button type="button" data-view="inspect" aria-pressed="false">设备近看</button></div><div class="orbit-options"><button type="button" data-orbit="-1" aria-label="向左环视">↶</button><button type="button" data-orbit="1" aria-label="向右环视">↷</button><button type="button" data-zoom="1" aria-label="拉近设备">＋</button><button type="button" data-zoom="-1" aria-label="拉远设备">−</button></div>`;
  root.append(controls);root.dataset.visualVersion=VISUAL_VERSION;root.dataset.view=view;root.dataset.kind=kind;
  const api={
    render(data){last=data;instrument.update(data);renderImpl(data);},
    snapshot(){return takeSnapshot();},
    dispose(){destroyed=true;cancelAnimationFrame(frame);resize.disconnect();disposeGraphics();},
  };
  controls.querySelectorAll("[data-view]").forEach(b=>{b.onclick=()=>{view=b.dataset.view;orbit=0;elevation=0;zoom=1;root.dataset.view=view;controls.querySelectorAll("[data-view]").forEach(n=>n.setAttribute("aria-pressed",String(n===b)));if(last)renderImpl(last);};});
  controls.querySelectorAll("[data-orbit]").forEach(b=>{b.onclick=()=>{orbit+=Number(b.dataset.orbit)*.25;if(last)renderImpl(last);};});
  controls.querySelectorAll("[data-zoom]").forEach(b=>{b.onclick=()=>{zoom=Math.max(.65,Math.min(1.65,zoom-Number(b.dataset.zoom)*.15));if(last)renderImpl(last);};});
  function createCanvases() {
    canvas?.remove();preview?.remove();canvas=document.createElement("canvas");preview=document.createElement("canvas");
    canvas.setAttribute("aria-label",kind==="lander"?"可旋转的精细着陆器与火星地表":"六轮火星车、地形与驾驶轨迹");
    root.prepend(canvas);if(cameraRoot)cameraRoot.prepend(preview);
    let drag=null;
    canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!drag)return;orbit+=(e.clientX-drag.x)*.006;elevation=Math.max(-.35,Math.min(.65,elevation+(e.clientY-drag.y)*.003));drag={x:e.clientX,y:e.clientY};if(last)renderImpl(last);};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  }
  async function fallback() {
    if(fallbackActive||destroyed)return;fallbackActive=true;cancelAnimationFrame(frame);disposeGraphics();createCanvases();
    const vector=new Image();vector.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(vehicleSVG(kind));await vector.decode();
    if(destroyed)return;
    root.dataset.renderer="canvas";modeLabel.textContent="精细 2D 模式 · 操作与结果保留";
    controls.querySelector(".orbit-options").hidden=true;
    canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=canvas.onpointercancel=null;
    canvas.setAttribute("aria-label",kind==="lander"?"着陆器与下降位置的矢量示意":"六轮火星车与当前路线的矢量示意");
    renderImpl=data=>drawFallback(canvas,cameraRoot?preview:null,vector,kind,data,root,view);
    takeSnapshot=()=>{if(last)renderImpl(last);return(cameraRoot?preview:canvas).toDataURL("image/jpeg",.92);};
    if(last)renderImpl(last);
  }
  createCanvases();
  try {
    if(new URLSearchParams(location.search).get("renderer")==="canvas")throw new Error("指定兼容画面");
    const T=await import("../spot-a-world/vendor/three.module.min.js");
    const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance",preserveDrawingBuffer:true});
    const mobile=root.clientWidth<600,gl=renderer.getContext(),debug=gl.getExtension("WEBGL_debug_renderer_info");
    const software=debug&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    // 先降低软件渲染器的像素与阴影成本，保留设备结构和材质。
    const nativeRatio=Math.min(devicePixelRatio||1,mobile?1.5:1.6);
    let interactionRatio=software ? .75 : nativeRatio;
    renderer.setPixelRatio(nativeRatio);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    root.dataset.pixelRatio=String(renderer.getPixelRatio());
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    const scene=new T.Scene();scene.background=new T.Color(0x99775d);scene.fog=new T.FogExp2(0xa78970,.008);
    const environment=createEnvironment(T,renderer);scene.environment=environment.texture;scene.environmentIntensity=.75;
    scene.add(new T.HemisphereLight(0xb9ccd4,0x76523b,1.55));
    const sun=new T.DirectionalLight(0xffe1b5,3.2);sun.position.set(-22,30,14);sun.castShadow=true;const shadowSize=software?512:mobile?768:1024;sun.shadow.mapSize.set(shadowSize,shadowSize);
    sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=16;sun.shadow.camera.bottom=-12;sun.shadow.camera.far=90;sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;scene.add(sun);scene.add(sun.target);
    const A=createMissionAssets(T);createTerrain(A,scene,kind);const rig=kind==="lander"?A.lander():A.rover();scene.add(rig.group);
    const camera=new T.PerspectiveCamera(42,1,.08,260),pov=new T.PerspectiveCamera(63,1.6,.08,180);
    let previewRenderer=null;
    if(cameraRoot){previewRenderer=new T.WebGLRenderer({canvas:preview,antialias:true,preserveDrawingBuffer:true});previewRenderer.setSize(480,300,false);previewRenderer.outputColorSpace=T.SRGBColorSpace;previewRenderer.toneMapping=T.ACESFilmicToneMapping;previewRenderer.toneMappingExposure=1.12;}
    const annotations=new T.Group();scene.add(annotations);
    let ring=null;
    if(kind==="rover"){
      ring=new T.Mesh(new T.RingGeometry(1.38,1.43,72),new T.MeshBasicMaterial({color:0xffd995,transparent:true,opacity:.7,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;annotations.add(ring);
    }
    const trail=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xc8e3c5,transparent:true,opacity:.62}));annotations.add(trail);
    const trackMat=new T.MeshBasicMaterial({color:0x604331,transparent:true,opacity:.3,depthWrite:false});
    const tracks=new T.InstancedMesh(new T.PlaneGeometry(.15,1),trackMat,1000);tracks.count=0;tracks.frustumCulled=false;scene.add(tracks);
    const dustG=new T.BufferGeometry(),dustArray=new Float32Array(120*3);dustG.setAttribute("position",new T.BufferAttribute(dustArray,3));
    const dustTex=A.texture(64,(c,s)=>{const g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,"#ffffff");g.addColorStop(.3,"#ffffffaa");g.addColorStop(1,"#ffffff00");c.fillStyle=g;c.fillRect(0,0,s,s);});
    const dust=new T.Points(dustG,new T.PointsMaterial({map:dustTex,color:0xd9aa7d,size:.7,transparent:true,opacity:.23,depthWrite:false}));dust.visible=false;scene.add(dust);
    let current=null,heading=0,goalHeading=0,previousData=null,pathKey="",time=0,dirty=true,previewDirty=true,drawCount=0,previousTime=performance.now(),moving=false;
    const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
    const updateTracks=data=>{
      const route=data.path||[],key=route.map(p=>p.x+","+p.z).join(";");if(key===pathKey)return;pathKey=key;
      trail.geometry.dispose();trail.geometry=new T.BufferGeometry().setFromPoints(route.map(p=>new T.Vector3(p.x*2.4,.04,p.z*2.4)));
      const o=new T.Object3D();let count=0;
      for(let i=1;i<route.length&&count<998;i++){
        const a=route[i-1],b=route[i],dx=(b.x-a.x)*2.4,dz=(b.z-a.z)*2.4,len=Math.hypot(dx,dz);if(!len)continue;
        for(const side of [-1,1]){o.position.set((a.x+b.x)*1.2+side*dz/len*.8,.025,(a.z+b.z)*1.2-side*dx/len*.8);o.rotation.set(-Math.PI/2,0,-Math.atan2(dx,dz));o.scale.set(1,len,1);o.updateMatrix();tracks.setMatrixAt(count++,o.matrix);}
      }
      tracks.count=count;tracks.instanceMatrix.needsUpdate=true;
    };
    function positionCamera() {
      const y=rig.group.position.y,aspect=camera.aspect;
      let target,offset;
      if(view==="overview"){
        target=kind==="lander"?new T.Vector3(0,4,0):new T.Vector3(9.6,0,7.2);
        offset=kind==="lander"?new T.Vector3(17,15,22):new T.Vector3(21,24,24);
      }else{
        target=rig.group.position.clone().add(new T.Vector3(0,kind==="lander"?1.35:1.1,0));
        const near=view==="inspect";
        offset=kind==="lander"?(near?new T.Vector3(5.8,3.1,-7):new T.Vector3(8.5,4.5,-10.5)):(near?new T.Vector3(3.1,1.65,-4):new T.Vector3(5.7,3.2,-6.6));
        if(kind==="lander"&&!near){target.y=Math.max(1.35,y*.5+1.35);offset.y+=y*.75;}
      }
      sun.target.position.copy(rig.group.position);sun.target.position.y*=.4;sun.position.copy(sun.target.position).add(new T.Vector3(-16,24,12));
      offset.applyAxisAngle(new T.Vector3(0,1,0),orbit);offset.y+=offset.length()*elevation;
      offset.multiplyScalar(zoom*(aspect<.9?1.22:1));camera.position.copy(target).add(offset);camera.lookAt(target);
      // 下降和持续点火上升都保持设备完整；高度变化不能把机身裁出画面。
      if(kind==="lander"&&view!=="inspect"){
        const corners=[];for(const x of [-2.9,2.9])for(const z of [-2.1,2.1])for(const dy of [0,3.3])corners.push(new T.Vector3(x,y+dy,z));
        corners.push(new T.Vector3(0,0,0));
        for(let i=0;i<4;i++){
          camera.updateMatrixWorld();let extent=0;
          for(const p of corners){const q=p.clone().project(camera);extent=Math.max(extent,Math.abs(q.x),Math.abs(q.y));}
          if(extent<.86)break;offset.multiplyScalar(extent/.86*1.02);camera.position.copy(target).add(offset);camera.lookAt(target);
        }
      }
    }
    function updateModel(snap,dt) {
      if(!current||snap)current={x:last.x||0,z:last.z||0,height:last.height||0,yaw:last.yaw||0};
      const alpha=reduced||snap?1:1-Math.exp(-dt*11),oldX=current.x,oldZ=current.z;
      current.x+=(last.x-current.x||0)*alpha;current.z+=(last.z-current.z||0)*alpha;current.height=last.height||0;current.yaw+=wrap((last.yaw||0)-current.yaw)*alpha;
      heading+=wrap(goalHeading-heading)*alpha;
      if(kind==="lander") {
        rig.group.position.y=Math.max(0,current.height)*.18-.085;
        const firing=Boolean(last.braking&&last.fuel>0&&last.status==="flying");
        rig.flame.visible=firing;rig.flameMat.uniforms.time.value=time;rig.glow.intensity=firing?9:0;
        rig.flame.scale.y=firing?(reduced?1:.93+.07*Math.sin(time*37)):1;
        dust.visible=(firing&&last.height<22)||(last.height===0&&time<1.2);
        dust.material.opacity=firing?Math.max(0,.3-last.height*.009):.14;
      }else{
        rig.group.position.set(current.x*2.4,-.075,current.z*2.4);rig.group.rotation.y=-heading;rig.mast.rotation.y=heading-current.yaw;
        const distance=Math.hypot(current.x-oldX,current.z-oldZ)*2.4;rig.wheels.forEach(w=>{w.rotation.x-=distance/(.46*.72);});
        const t=TARGETS[last.target||"ridge"];ring.position.set(t.x*2.4,.04,t.z*2.4);updateTracks(last);
        moving=Math.hypot(current.x-last.x,current.z-last.z)>.003||Math.abs(wrap(current.yaw-(last.yaw||0)))>.005;
        dust.visible=moving&&!reduced;dust.position.set(current.x*2.4,0,current.z*2.4);dust.material.opacity=.13;
      }
      if(dust.visible){for(let i=0;i<120;i++){const a=i*2.399,life=(time*.38+i/120)%1,r=.4+life*(kind==="lander"?4:1.5);dustArray[i*3]=Math.cos(a)*r;dustArray[i*3+1]=.12+Math.sin(life*Math.PI)*.55;dustArray[i*3+2]=Math.sin(a)*r;}dustG.attributes.position.needsUpdate=true;}
      positionCamera();
    }
    function draw(snap=false,dt=1/60) {
      if(!last||destroyed||fallbackActive)return;
      const width=Math.max(1,root.clientWidth),height=Math.max(1,root.clientHeight);
      if(Math.abs(canvas.width-width*renderer.getPixelRatio())>1||Math.abs(canvas.height-height*renderer.getPixelRatio())>1){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;}
      updateModel(snap,dt);renderer.render(scene,camera);
      if(previewRenderer&&(previewDirty||moving||snap)){
        pov.position.set(current.x*2.4,1.73,current.z*2.4);pov.lookAt(current.x*2.4+Math.sin(current.yaw)*10,1.22,current.z*2.4-Math.cos(current.yaw)*10);
        rig.group.visible=false;annotations.visible=false;dust.visible=false;tracks.visible=false;
        previewRenderer.render(scene,pov);
        rig.group.visible=true;annotations.visible=true;tracks.visible=true;previewDirty=false;
      }
      root.dataset.drawCalls=String(renderer.info.render.calls);root.dataset.triangles=String(renderer.info.render.triangles);
    }
    renderImpl=data=>{
      if(kind==="rover"&&previousData&&(data.x!==previousData.x||data.z!==previousData.z))goalHeading=Math.atan2(data.x-previousData.x,-(data.z-previousData.z));
      previousData={x:data.x,z:data.z};dirty=true;previewDirty=true;
      if(data.instant)draw(true);
    };
    takeSnapshot=()=>{if(previewRenderer)previewRenderer.setSize(960,600,false);draw(true);const image=(cameraRoot?preview:canvas).toDataURL("image/jpeg",.9);if(previewRenderer){previewRenderer.setSize(480,300,false);previewDirty=true;dirty=true;}return image;};
    let frameTotal=0,frameSamples=0,wasDrawing=false;
    function tick(now) {
      if(destroyed||fallbackActive)return;
      const elapsed=now-previousTime,dt=Math.min(.08,elapsed/1000);previousTime=now;time+=dt;
      if(wasDrawing&&elapsed<500){frameTotal+=elapsed;frameSamples++;}
      if(frameSamples===30){
        const mean=frameTotal/frameSamples;root.dataset.frameIntervalMs=mean.toFixed(1);
        if(mean>45&&interactionRatio>.6)interactionRatio=Math.max(.6,interactionRatio*.8);
        frameTotal=0;frameSamples=0;
      }
      // 停下来观察时恢复清晰度；动态过程中再按实测降低像素成本。
      const desiredRatio=moving||(kind==="lander"&&last?.active)?interactionRatio:nativeRatio;
      if(renderer.getPixelRatio()!==desiredRatio){renderer.setPixelRatio(desiredRatio);root.dataset.pixelRatio=String(desiredRatio);dirty=true;}
      wasDrawing=Boolean(last&&!document.hidden&&(dirty||moving||(kind==="lander"&&last.active&&!reduced)));
      if(last&&!document.hidden&&(dirty||moving||(kind==="lander"&&last.active&&!reduced))){const began=performance.now();draw(false,dt);if(++drawCount%20===0)root.dataset.frameMs=(performance.now()-began).toFixed(1);dirty=false;}
      frame=requestAnimationFrame(tick);
    }
    disposeGraphics=()=>{
      const geometries=new Set(),materials=new Set(),maps=new Set(A.textures);
      scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)maps.add(value);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());environment.dispose();sun.shadow.map?.dispose();renderer.dispose();previewRenderer?.dispose();
    };
    const lost=e=>{e.preventDefault();fallback().catch(()=>{modeLabel.textContent="画面恢复失败，请重新打开项目";});};canvas.addEventListener("webglcontextlost",lost);if(cameraRoot)preview.addEventListener("webglcontextlost",lost);
    root.dataset.renderer="webgl";modeLabel.textContent="互动 3D · 教学场景";frame=requestAnimationFrame(tick);
  }catch(error){console.info("3D 场景使用兼容模式：",error.message);await fallback();}
  const resize=new ResizeObserver(()=>{if(last)renderImpl(last);});resize.observe(root);
  window.addEventListener("pagehide",event=>{if(!event.persisted)api.dispose();});
  return api;
}

function drawFallback(canvas,preview,vehicle,kind,data,root,view) {
  const w=root.clientWidth,h=root.clientHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;
  const c=canvas.getContext("2d");c.scale(dpr,dpr);
  const background=(ctx,width,height)=>{
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,"#383a39");sky.addColorStop(.56,"#b38a69");sky.addColorStop(1,"#a77550");ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    for(let layer=0;layer<4;layer++) {ctx.fillStyle=["#806d5d","#90765c","#a7815e","#b1875f"][layer];ctx.beginPath();ctx.moveTo(0,height);for(let i=0;i<=40;i++){const x=i*width/40,y=height*(.44+layer*.07)-Math.abs(Math.sin(i*.63+layer)*Math.cos(i*.29))*height*.08;ctx.lineTo(x,y);}ctx.lineTo(width,height);ctx.closePath();ctx.fill();}
    for(let i=0;i<1200;i++){const x=((i*197)%997)/997*width,y=height*(.61+((i*151)%991)/991*.39);ctx.fillStyle=i%3?"#61473130":"#f3d4a12a";ctx.fillRect(x,y,1+(i%4),.7);}
  };
  background(c,w,h);
  if(kind==="lander") {
    const size=Math.min(w*(view==="inspect"?.87:view==="overview"?.4:.59),h*(view==="inspect"?1.1:.83)),y=view==="inspect"?h*.48:h*.47-(Math.min(100,data.height)/100)*h*.13;
    c.save();c.globalAlpha=Math.max(.12,.5-data.height*.004);c.fillStyle="#403e31";c.beginPath();c.ellipse(w*.51,h*.83,size*.34,size*.07,0,0,Math.PI*2);c.fill();c.restore();
    c.strokeStyle="#e9d5a1";c.lineWidth=1;c.beginPath();c.ellipse(w*.51,h*.84,size*.43,size*.1,0,0,Math.PI*2);c.stroke();
    c.drawImage(vehicle,w/2-size/2,y-size*.38,size,size*280/410);
    if(data.braking&&data.fuel>0&&data.status==="flying"){const x=w*.493,fy=y+size*.17,g=c.createLinearGradient(x,fy,x,fy+size*.2);g.addColorStop(0,"#fff5bd");g.addColorStop(.25,"#e2af66bb");g.addColorStop(1,"#7091be00");c.fillStyle=g;c.beginPath();c.moveTo(x-8,fy);c.lineTo(x,fy+size*.2);c.lineTo(x+8,fy);c.fill();}
  }else{
    const scale=Math.min(w/18,h/18),project=(x,z)=>({x:w*.44+(x-z)*scale,y:h*(w<600?.46:.32)+(x+z)*scale*.42});
    c.strokeStyle="#ead1a130";c.lineWidth=.7;
    for(let z=0;z<7;z++)for(let x=0;x<9;x++){const p=project(x,z);c.strokeRect(p.x-1,p.y-1,2,2);}
    c.strokeStyle="#d9e1b7";c.lineWidth=2;c.beginPath();(data.path||[]).forEach((p,i)=>{const v=project(p.x,p.z);if(i)c.lineTo(v.x,v.y);else c.moveTo(v.x,v.y);});c.stroke();
    const rock=(x,y,size)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?"#ad8159":"#946a4b";c.beginPath();c.ellipse(x+Math.sin(i)*size*.07,y-i*size*.08,size*(1-i*.06),size*.25,-.14,0,Math.PI*2);c.fill();}};
    for(const [x,z]of GRID.blocks){const p=project(x,z);rock(p.x,p.y,scale*.65);}
    for(const t of Object.values(TARGETS)){const p=project(t.x,t.z);rock(p.x,p.y,scale*.9);}
    const p=project(data.x,data.z),size=view==="inspect"?Math.min(w*.78,420):Math.max(105,scale*3.2);
    if(view==="inspect")c.drawImage(vehicle,w/2-size/2,h*.5-size*.35,size,size*280/410);else c.drawImage(vehicle,p.x-size*.5,p.y-size*.5,size,size*280/410);
    if(preview){preview.width=960;preview.height=600;const d=preview.getContext("2d");background(d,960,600);
      for(const [id,t]of Object.entries(TARGETS)){const dx=t.x-data.x,dz=t.z-data.z,a=Math.atan2(dx,-dz)-data.yaw,dist=Math.hypot(dx,dz);if(Math.cos(a)<.25)continue;const px=480+Math.tan(a)*720,s=220/Math.max(.6,dist);for(let i=0;i<12;i++){d.fillStyle=id==="ridge"?(i%2?"#aa805c":"#bb976e"):(i%2?"#c29b66":"#caa671");d.beginPath();d.ellipse(px+Math.sin(i*1.3)*s*.03,350-i*s*.075,s*(1-i*.035),s*.16,0,0,Math.PI*2);d.fill();}}
      d.fillStyle="#e8dbb9";d.font="14px monospace";d.fillText("SIMULATED / "+data.x+","+data.z+" / "+Math.round(data.yaw*180/Math.PI)+" deg",24,572);
    }
  }
}
