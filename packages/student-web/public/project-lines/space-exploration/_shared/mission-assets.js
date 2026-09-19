// 概念教学设备；结构细节用于观察，不代表特定航天器的工程尺寸。
export function createMissionAssets(T) {
  const textures = [];
  const texture = (size, draw, color = false) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
    draw(canvas.getContext("2d"), size);
    const map = new T.CanvasTexture(canvas); if (color) map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4; textures.push(map); return map;
  };
  let seed = 6149;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const foil = texture(256, (c, s) => {
    c.fillStyle = "#888"; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) { const x = random()*s, y = random()*s; c.strokeStyle = `rgba(${i%2 ? '255,255,255' : '0,0,0'},.13)`; c.lineWidth = 1 + random()*3; c.beginPath(); c.moveTo(x,y); c.lineTo(x+random()*25-12,y+random()*30-15); c.stroke(); }
  });
  const solar = texture(512, (c, s) => {
    c.fillStyle = "#101b30"; c.fillRect(0,0,s,s);
    for (let y=0;y<8;y++) for(let x=0;x<5;x++) {
      const g = c.createLinearGradient(x*102,y*64,x*102+98,y*64+60); g.addColorStop(0,"#203859"); g.addColorStop(.5,"#253e62"); g.addColorStop(1,"#111f3e"); c.fillStyle=g; c.fillRect(x*102+3,y*64+3,96,58);
      c.strokeStyle="#69768b"; c.lineWidth=.8; for(let j=0;j<7;j++){c.beginPath();c.moveTo(x*102+7,y*64+7+j*7);c.lineTo(x*102+95,y*64+7+j*7);c.stroke();}
      c.fillStyle="#b0a88a";c.fillRect(x*102+27,y*64+3,1.5,58);c.fillRect(x*102+73,y*64+3,1.5,58);
    }
  }, true);
  const M = {
    ivory: new T.MeshStandardMaterial({color:0xc9cec7,metalness:.34,roughness:.46}),
    gold: new T.MeshStandardMaterial({color:0xd4b268,metalness:.88,roughness:.34,bumpMap:foil,bumpScale:.17}),
    metal: new T.MeshStandardMaterial({color:0x979c9f,metalness:.85,roughness:.32}),
    dark: new T.MeshStandardMaterial({color:0x20292c,metalness:.5,roughness:.6}),
    tire: new T.MeshStandardMaterial({color:0x444447,metalness:.7,roughness:.72}),
    glass: new T.MeshPhysicalMaterial({color:0x183c4d,metalness:.65,roughness:.12,clearcoat:1}),
    copper: new T.MeshStandardMaterial({color:0x9e5d36,metalness:.7,roughness:.46}),
    solar: new T.MeshStandardMaterial({map:solar,color:0x637caa,metalness:.22,roughness:.58}),
  };
  const mesh = (geometry, material, position = [0,0,0], parent) => {
    const m = new T.Mesh(geometry,material); m.position.set(...position); m.castShadow = true; m.receiveShadow = true; parent?.add(m); return m;
  };
  const box = (w,h,d, material, position, parent) => mesh(new T.BoxGeometry(w,h,d),material,position,parent);
  const cyl = (a,b,h, material, position, parent, segments=32) => mesh(new T.CylinderGeometry(a,b,h,segments),material,position,parent);
  const rod = (a,b,r,material,parent) => {
    const p=new T.Vector3(...a),q=new T.Vector3(...b), v=q.clone().sub(p);
    const m=cyl(r,r,v.length(),material,p.clone().add(q).multiplyScalar(.5).toArray(),parent,12);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;
  };
  const cable=(points,r,material,parent)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,6,false),material,[0,0,0],parent);
  const blanket=(radius,height,p,parent)=>{
    const g=new T.CylinderGeometry(radius,radius,height,96,28),a=g.attributes.position;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),z=a.getZ(i),y=a.getY(i),theta=Math.atan2(z,x);
      if(Math.hypot(x,z)<.001)continue;
      const sector=((theta+Math.PI*5+Math.PI/8)%(Math.PI/4))-Math.PI/8;
      const radial=radius*Math.cos(Math.PI/8)/Math.cos(sector)+.013*Math.sin(y*53+theta*11+Math.sin(theta*7)*2)*Math.sin(y*8+theta*3)+.006*Math.sin(y*77-theta*19);
      a.setXYZ(i,Math.cos(theta)*radial,y,Math.sin(theta)*radial);
    }
    g.computeVertexNormals();return mesh(g,M.gold,p,parent);
  };
  const roundedBox = (w,h,d,material,p,parent) => {
    const shape=new T.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.045});g.translate(0,0,-d/2);return mesh(g,material,p,parent);
  };
  const bolts=(positions,parent,r=.027)=>{
    const inst=new T.InstancedMesh(new T.CylinderGeometry(r,r,.018,6),M.metal,positions.length),o=new T.Object3D();
    positions.forEach((p,i)=>{o.position.set(...p);o.updateMatrix();inst.setMatrixAt(i,o.matrix);});inst.castShadow=true;parent.add(inst);
  };
  const lens=(parent,x,y,z,r=.105)=>{
    const rim=cyl(r*1.35,r*1.35,.13,M.dark,[x,y,z],parent);rim.rotation.x=Math.PI/2;
    const tube=cyl(r,r,.145,M.metal,[x,y,z-.025],parent);tube.rotation.x=Math.PI/2;
    const glass=cyl(r*.87,r*.87,.01,M.glass,[x,y,z-.105],parent);glass.rotation.x=Math.PI/2;
  };
  const badge = (text,w,h,parent,p) => {
    const map=texture(256,c=>{c.fillStyle="#d9dbd2";c.fillRect(0,0,256,256);c.fillStyle="#293b40";c.font="bold 63px monospace";c.textAlign="center";c.fillText(text,128,150);},true);
    const m=mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,roughness:.8}),p,parent);m.rotation.x=-Math.PI/2;
  };

  function lander() {
    const group=new T.Group();group.name="精细着陆器";
    cyl(1.03,1.03,.16,M.metal,[0,1.1,0],group,8);
    blanket(.99,.85,[0,1.59,0],group);
    cyl(1.05,1.05,.09,M.ivory,[0,2.06,0],group,8);
    const fasteners=[];
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4, x=Math.cos(a)*.95,z=Math.sin(a)*.95;
      rod([x,1.18,z],[x,2.04,z],.026,M.metal,group);fasteners.push([x,2.12,z]);
    }
    bolts(fasteners,group,.04);
    roundedBox(.53,.24,.55,M.ivory,[.2,2.23,.23],group);
    roundedBox(.42,.26,.35,M.dark,[-.45,2.25,.1],group);
    for(let i=0;i<8;i++)box(.035,.17,.35,M.metal,[-.62+i*.049,2.28,.1],group);
    lens(group,.15,2.28,-.62,.1);lens(group,-.15,2.28,-.62,.1);
    for(const s of [-1,1]) {
      cable([[s*.45,2.09,-.2],[s*.72,2.18,-.35],[s*.86,1.75,-.5],[s*.7,1.19,-.7]],.024,M.copper,group);
      cable([[s*.37,2.1,.3],[s*.73,2.2,.48],[s*.82,1.53,.58],[s*.63,1.15,.64]],.036,M.dark,group);
      roundedBox(.26,.39,.075,M.dark,[s*.53,1.61,-.86],group);
      for(let i=0;i<6;i++)box(.28,.02,.11,M.metal,[s*.53,1.45+i*.06,-.9],group);
    }
    for(const s of [-1,1]) {
      rod([s*.85,1.85,0],[s*2.45,1.85,0],.05,M.metal,group);
      const wing=new T.Group();wing.position.set(s*2.1,1.88,0);wing.rotation.z=s*.055;group.add(wing);
      box(1.5,.065,2.05,M.metal,[0,0,0],wing);box(1.42,.02,1.97,M.solar,[0,.046,0],wing);
      for(const z of [-1,0,1])box(1.5,.045,.032,M.metal,[0,.067,z],wing);
      for(const x of [-.75,0,.75])box(.026,.045,2.05,M.metal,[x,.067,0],wing);
      rod([s*.82,1.23,0],[s*2.5,1.84,0],.028,M.dark,group);
    }
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      const foot=[sx*1.72,.12,sz*1.72], hip=[sx*.69,1.45,sz*.69];
      rod(hip,foot,.063,M.metal,group);rod([sx*.76,1.06,sz*.15],foot,.039,M.dark,group);rod([sx*.15,1.06,sz*.76],foot,.039,M.dark,group);
      rod([sx*1.15,.88,sz*1.15],[sx*1.48,.42,sz*1.48],.105,M.gold,group);
      cyl(.34,.38,.11,M.metal,[foot[0],.08,foot[2]],group);
      cyl(.19,.24,.045,M.dark,[foot[0],.15,foot[2]],group);
      bolts([[foot[0]-.2,.15,foot[2]],[foot[0]+.2,.15,foot[2]]],group);
    }
    // 喷管内外层与冷却环，轴线与垂直推力一致。
    const profile=[[.49,.3],[.43,.42],[.3,.62],[.18,.78],[.17,.96]].map(p=>new T.Vector2(...p));
    mesh(new T.LatheGeometry(profile,40),new T.MeshStandardMaterial({color:0x66696a,metalness:.8,roughness:.42,side:T.DoubleSide}),[0,0,0],group);
    for(let i=0;i<6;i++) {
      const ring=mesh(new T.TorusGeometry(.185+i*.021,.013,6,40),M.copper,[0,.94-i*.045,0],group);ring.rotation.x=Math.PI/2;
    }
    rod([.35,2.1,.45],[.35,3.15,.45],.027,M.metal,group);
    cyl(.06,.06,.11,M.dark,[.35,3.17,.45],group);
    const dish=mesh(new T.SphereGeometry(.36,32,16,0,Math.PI*2,0,Math.PI*.34),new T.MeshStandardMaterial({color:0xd4d1bf,metalness:.65,roughness:.4,side:T.DoubleSide}),[.57,2.33,.15],group);dish.rotation.z=-.4;
    rod([-.42,2.2,.5],[-.42,2.6,.5],.025,M.metal,group);
    badge("SE-02",.5,.36,group,[.15,2.365,.23]);
    const flame=new T.Group();group.add(flame);flame.visible=false;
    const flameMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec2 vUv;uniform float time;void main(){float f=pow(vUv.y,0.65);float wave=.84+.16*sin(vUv.y*55.-time*40.);vec3 c=mix(vec3(.2,.45,1.),vec3(1.,.76,.35),vUv.y);gl_FragColor=vec4(c,f*.8*wave);}"});
    const plume=mesh(new T.CylinderGeometry(.27,.045,2.7,32,1,true),flameMat,[0,-1.04,0],flame);plume.castShadow=false;
    const glow=new T.PointLight(0xffb864,0,9,2);glow.position.set(0,.1,0);group.add(glow);
    return {group,flame,flameMat,glow};
  }

  function rover() {
    const group=new T.Group();group.name="六轮探索车";const wheels=[];
    roundedBox(1.58,.45,2.28,M.gold,[0,1.02,.1],group);
    roundedBox(1.78,.12,2.48,M.ivory,[0,1.34,.06],group);
    box(1.48,.12,1.97,M.dark,[0,.76,.1],group);
    const deckBolts=[];for(const x of [-.77,.77])for(let z=-1.02;z<1.18;z+=.22)deckBolts.push([x,1.435,z]);bolts(deckBolts,group);
    for(const side of [-1,1]) {
      const x=side*1.12;
      rod([side*.7,1.04,-.25],[x,.75,-.5],.075,M.metal,group);
      rod([x,.75,-.5],[x,.5,-1.05],.068,M.metal,group);
      rod([x,.75,-.5],[x,.73,.75],.068,M.metal,group);
      rod([x,.73,.75],[x,.5,.2],.055,M.metal,group);
      rod([x,.73,.75],[x,.5,1.4],.055,M.metal,group);
      for(const z of [-1.05,.2,1.4]) {
        const wheel=new T.Group();wheel.position.set(x,.48,z);group.add(wheel);wheels.push(wheel);
        const tire=cyl(.46,.46,.35,M.tire,[0,0,0],wheel,48);tire.rotation.z=Math.PI/2;
        for(const s of [-1,1]) {
          const rim=cyl(.31,.31,.02,M.metal,[s*.185,0,0],wheel,32);rim.rotation.z=Math.PI/2;
          const hub=cyl(.13,.15,.07,M.gold,[s*.205,0,0],wheel,20);hub.rotation.z=Math.PI/2;
          const ring=mesh(new T.TorusGeometry(.395,.018,8,48),M.metal,[s*.18,0,0],wheel);ring.rotation.y=Math.PI/2;
          for(let j=0;j<8;j++){const a=j*Math.PI/4;rod([s*.205,Math.sin(a)*.15,Math.cos(a)*.15],[s*.185,Math.sin(a)*.31,Math.cos(a)*.31],.017,M.dark,wheel);}
        }
        const cleats=new T.InstancedMesh(new T.BoxGeometry(.37,.023,.05),M.tire,28),o=new T.Object3D();
        for(let j=0;j<28;j++){const a=j/28*Math.PI*2;o.position.set(0,Math.cos(a)*.465,Math.sin(a)*.465);o.rotation.x=a;o.updateMatrix();cleats.setMatrixAt(j,o.matrix);}cleats.castShadow=true;wheel.add(cleats);
      }
      const axle=cyl(.14,.14,.17,M.dark,[side*.92,1.04,-.25],group);axle.rotation.z=Math.PI/2;
      for(let i=0;i<3;i++) {
        const plate=box(.017,.3,.52,M.ivory,[side*.824,1.04,-.6+i*.66],group);
        const label=box(.02,.025,.34,M.dark,[side*.84,1.1,-.6+i*.66],group);label.name="侧面设备铭牌";plate.name="可拆维护盖";
      }
      cable([[side*.72,1.35,-.6],[side*.85,1.18,-.4],[side*.96,.98,.4],[side*1.12,.73,.75]],.026,M.copper,group);
      cable([[side*.6,1.38,.62],[side*.9,1.21,.74],[side*.93,1.02,1.1]],.025,M.dark,group);
    }
    for(let i=0;i<9;i++)box(1.1,.07,.035,M.metal,[0,1.46,.5+i*.055],group);
    roundedBox(.68,.28,.66,M.ivory,[.36,1.57,.15],group);
    box(.4,.06,.7,M.solar,[-.48,1.48,.3],group);
    const mast=new T.Group();mast.position.set(0,1.42,-.6);group.add(mast);
    cyl(.075,.09,.97,M.metal,[0,.46,0],mast);cyl(.13,.13,.13,M.dark,[0,.88,0],mast);
    roundedBox(.69,.29,.3,M.ivory,[0,1.08,0],mast);lens(mast,-.18,1.09,-.18,.105);lens(mast,.18,1.09,-.18,.105);
    cable([[.1,0,.06],[.16,.4,.07],[.12,.8,.04],[.28,.97,.03]],.02,M.dark,mast);
    cyl(.13,.13,.17,M.metal,[0,1.3,0],mast);
    lens(group,-.57,1.09,-1.14,.07);lens(group,.57,1.09,-1.14,.07);
    rod([-.57,1.43,.71],[-.57,2.12,.71],.027,M.metal,group);
    mesh(new T.SphereGeometry(.055,12,8),M.dark,[-.57,2.15,.71],group);
    const dish=mesh(new T.SphereGeometry(.28,24,12,0,Math.PI*2,0,Math.PI*.38),new T.MeshStandardMaterial({color:0xded8bd,metalness:.6,roughness:.42,side:T.DoubleSide}),[.57,1.65,.82],group);dish.rotation.z=-.35;
    // 前方收拢的观测臂与仪器，不增加隐藏的操作前置。
    rod([-.56,.95,-1.05],[-.78,.75,-1.55],.055,M.metal,group);rod([-.78,.75,-1.55],[.1,.65,-1.6],.048,M.metal,group);
    const tool=cyl(.18,.18,.18,M.dark,[.22,.68,-1.6],group);tool.rotation.z=Math.PI/2;
    for(const p of [[-.56,.95,-1.05],[-.78,.75,-1.55],[.1,.65,-1.6]]){const joint=cyl(.1,.1,.16,M.gold,p,group);joint.rotation.z=Math.PI/2;}
    cable([[-.5,1.3,-.75],[-.69,1.06,-1.17],[-.84,.81,-1.56],[-.2,.68,-1.64]],.024,M.dark,group);
    badge("SE-03",.61,.4,group,[.35,1.76,.17]);
    group.scale.setScalar(.72);
    return {group,wheels,mast};
  }
  return {T,M,textures,random,texture,mesh,box,cyl,rod,lander,rover};
}
