import { GRID, TARGETS } from "./models.mjs";

export function createTerrain(A,scene,kind) {
  const {T,texture,random,mesh}=A;
  const groundMap=texture(1024,(c,s)=>{
    c.fillStyle="#9e8a73";c.fillRect(0,0,s,s);
    for(let i=0;i<43000;i++) {
      const n=Math.floor(75+random()*100),a=.05+random()*.25;
      c.fillStyle=`rgba(${n+10},${n},${Math.max(0,n-12)},${a+.1})`;
      const x=random()*s,y=random()*s,r=.3+random()*2.5;c.fillRect(x,y,r,r*.6);
    }
    c.lineWidth=.55;
    for(let i=0;i<180;i++) {
      c.strokeStyle=i%3 ? "#82614619" : "#e9c29b28";c.beginPath();
      for(let x=0;x<=s;x+=8){const y=i*6+Math.sin(x*.013+i*.37)*3.5;if(x)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();
    }
  },true);
  groundMap.wrapS=groundMap.wrapT=T.RepeatWrapping;groundMap.repeat.set(14,14);
  const terrainMat=new T.MeshStandardMaterial({color:0xd3bca0,map:groundMap,bumpMap:groundMap,bumpScale:.27,roughness:.97,metalness:0,vertexColors:true});
  const geometry=new T.PlaneGeometry(180,180,156,156);geometry.rotateX(-Math.PI/2);
  const pos=geometry.attributes.position, colors=[];
  const color=new T.Color();
  const heightAt=(x,z)=>{
    const dx=Math.max(0,-x-4,x-24),dz=Math.max(0,-z-4,z-19);
    const outside=kind==="lander" ? Math.max(0,Math.hypot(x,z)-5) : Math.hypot(dx,dz);
    const relief=Math.min(1,outside/9)*(1.4*Math.sin(x*.11+z*.14)+.65*Math.sin(x*.32-z*.23)+.3*Math.sin(x*.65+z*.41));
    return -.06+Math.max(-.6,relief);
  };
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i);
    pos.setY(i,heightAt(x,z));
    color.setHSL(.075+Math.sin(x*.03)*.008,.10,.80+Math.sin(x*.27+z*.21)*.09);colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const ground=mesh(geometry,terrainMat,[0,0,0],scene);ground.castShadow=false;
  const sky=new T.Mesh(new T.SphereGeometry(125,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:"varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec3 v;void main(){float h=normalize(v).y;vec3 low=vec3(.69,.47,.33),high=vec3(.19,.19,.19);vec3 c=mix(low,high,smoothstep(-.1,.8,h));float sun=pow(max(dot(normalize(v),normalize(vec3(-.6,.25,-.7))),0.),80.);c+=vec3(.22,.18,.12)*sun;gl_FragColor=vec4(c,1.);}"}));scene.add(sky);
  const strata=texture(512,(c,s)=>{
    c.fillStyle="#998673";c.fillRect(0,0,s,s);
    for(let y=0;y<s;y++){
      const shade=105+Math.sin(y*.13)*12+Math.sin(y*.61)*7+random()*13;
      c.fillStyle=`rgb(${shade+25},${shade+10},${shade})`;c.fillRect(0,y,s,1);
    }
    for(let i=0;i<18000;i++){c.fillStyle=i%2?"#ead7b527":"#372c222b";c.fillRect(random()*s,random()*s,random()*3+.5,random()*1.5+.5);}
    for(let i=0;i<23;i++){c.strokeStyle="#423f3550";c.lineWidth=.5+random();const x=random()*s,y=random()*s;c.beginPath();c.moveTo(x,y);c.lineTo(x+6,y+9);c.lineTo(x+3,y+19);c.stroke();}
  },true);
  const rockMat=new T.MeshStandardMaterial({color:0xc1b09b,map:strata,bumpMap:strata,bumpScale:.07,roughness:.97,vertexColors:true});
  function rockGeometry(radius,height,phase) {
    const g=new T.CylinderGeometry(radius,radius,height,32,24),p=g.attributes.position,cs=[];
    const col=new T.Color();
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),level=y/height+.5;
      const shoulder=1-.48*level**3+.1*Math.sin(level*5);
      const f=shoulder*(1+.14*Math.sin(a*3+phase)+.1*Math.cos(a*5+phase)+.04*Math.sin(y*35+phase));
      const topRoughness=level**2*(.09*Math.sin(a*5+phase)+.06*Math.cos(a*3));
      p.setXYZ(i,x*f+.13*level*Math.sin(phase),y+topRoughness,z*f+.12*level*Math.cos(phase));
      const layer=.79+.035*Math.sin(y*35+phase)+.025*Math.sin(a*3);col.setHSL(.075,.09,layer);cs.push(col.r,col.g,col.b);
    }
    g.setAttribute("color",new T.Float32BufferAttribute(cs,3));g.computeVertexNormals();return g;
  }
  // 障碍仅来自 GRID，路径上的碎石都是不改变碰撞的小尺度地表细节。
  if(kind==="rover") {
    GRID.blocks.forEach(([x,z],i)=>{const height=.9+(i%3)*.22,r=mesh(rockGeometry(.98,height,i),rockMat,[x*2.4,height/2-.06,z*2.4],scene);r.rotation.y=i*.8;});
    const t=TARGETS.ridge;
    const ridge=mesh(rockGeometry(1.15,1.6,2.3),rockMat,[t.x*2.4,.74,t.z*2.4],scene);ridge.rotation.y=.35;
    const sandMat=new T.MeshStandardMaterial({color:0xca9b65,map:groundMap,bumpMap:groundMap,bumpScale:.22,roughness:1});
    const duneG=new T.SphereGeometry(1.25,64,32);duneG.scale(1.3,.58,.85);const dune=mesh(duneG,sandMat,[TARGETS.dune.x*2.4,.02,TARGETS.dune.z*2.4],scene);dune.rotation.y=-.3;
  }
  const pebbleG=new T.IcosahedronGeometry(1,0),pebbleM=new T.MeshStandardMaterial({color:0x776957,roughness:1});
  const pebbles=new T.InstancedMesh(pebbleG,pebbleM,1200),o=new T.Object3D();
  for(let i=0;i<1200;i++) {
    const x=random()*100-40,z=random()*100-40, r=.025+random()**4*.28;
    // 可驾驶矩形和着陆中心内只出现细碎颗粒，避免视觉上的隐形障碍。
    const safe=kind==="rover" ? x>-2&&x<23&&z>-2&&z<18 : Math.hypot(x,z)<5;
    const size=safe?Math.min(.075,r):r;
    o.position.set(x,heightAt(x,z)+size*.25,z);o.scale.set(size,size*.6,size*.85);o.rotation.set(random()*2,random()*6,random());o.updateMatrix();pebbles.setMatrixAt(i,o.matrix);
  }
  pebbles.receiveShadow=true;scene.add(pebbles);
  const mountainPositions=[],mountainColors=[],indices=[],segments=256,rows=9;
  for(let j=0;j<rows;j++)for(let i=0;i<=segments;i++) {
    const a=i/segments*Math.PI*2,r=48+j*7;
    const ridge=(8+5*Math.sin(a*3)+2.5*Math.sin(a*7+.8)+2*Math.sin(a*19))*(Math.sin(j/(rows-1)*Math.PI)*.8+.2);
    const h=Math.max(0,ridge-2)+Math.sin(a*31+j*.7)*.6;
    mountainPositions.push(Math.cos(a)*r,h-1,Math.sin(a)*r);
    color.setHSL(.075,.10,.68+Math.sin(h*2.7)*.025);mountainColors.push(color.r,color.g,color.b);
    if(j<rows-1&&i<segments){const k=j*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  const mountains=new T.BufferGeometry();mountains.setAttribute("position",new T.Float32BufferAttribute(mountainPositions,3));mountains.setAttribute("color",new T.Float32BufferAttribute(mountainColors,3));mountains.setIndex(indices);mountains.computeVertexNormals();
  const mountain=mesh(mountains,new T.MeshStandardMaterial({color:0xa4927b,roughness:1,vertexColors:true,side:T.DoubleSide}),[0,0,0],scene);mountain.castShadow=false;
  if(kind==="lander") {
    const pad=new T.Group();scene.add(pad);
    // 浮于土表的教学目标标记，不伪装成火星上的真实设施。
    const ring=new T.Mesh(new T.RingGeometry(2.65,2.68,96),new T.MeshBasicMaterial({color:0xe5c98f,transparent:true,opacity:.65,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;pad.add(ring);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=mesh(new T.BoxGeometry(.045,.025,.35),new T.MeshBasicMaterial({color:0xd7cda8}),[Math.cos(a)*3,.04,Math.sin(a)*3],pad);m.rotation.y=-a+Math.PI/2;}
  }
  return {ground};
}

export function createEnvironment(T,renderer) {
  const c=document.createElement("canvas");c.width=512;c.height=256;const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,"#a6b1ba");g.addColorStop(.48,"#dcc7a5");g.addColorStop(.53,"#9e7453");g.addColorStop(1,"#3e3229");x.fillStyle=g;x.fillRect(0,0,512,256);
  const glow=x.createRadialGradient(80,86,0,80,86,60);glow.addColorStop(0,"#fff6d9");glow.addColorStop(1,"#fff6d900");x.fillStyle=glow;x.fillRect(0,0,160,160);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromEquirectangular(map);map.dispose();pmrem.dispose();return target;
}
