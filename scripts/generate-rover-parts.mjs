// 从明确的二维轮廓生成毫米单位的参考网格；不替代实机试配。
import * as T from '../packages/student-web/node_modules/three/build/three.module.js'
import { STLExporter } from '../packages/student-web/node_modules/three/examples/jsm/exporters/STLExporter.js'
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('packages/student-web/public/project-lines/space-exploration/assemble-a-rover/hardware')
fs.mkdirSync(root,{recursive:true})
function rect(w,h){const s=new T.Shape();s.moveTo(0,0);s.lineTo(w,0);s.lineTo(w,h);s.lineTo(0,h);s.closePath();return s}
function hole(s,x,y,d){const p=new T.Path();p.absarc(x,y,d/2,0,Math.PI*2,true);s.holes.push(p)}
function slot(s,x,y,w,h){const p=new T.Path();p.moveTo(x,y);p.lineTo(x,y+h);p.lineTo(x+w,y+h);p.lineTo(x+w,y);p.closePath();s.holes.push(p)}
function closeTriangulation(g){
  // Earcut 的共线孔桥可能产生 T 接点；将边上所有已有顶点显式接入三角面。
  const p=g.getAttribute('position'),triangles=[],unique=new Map()
  for(let i=0;i<p.count;i++){const v=new T.Vector3(p.getX(i),p.getY(i),p.getZ(i));v.set(...v.toArray().map(n=>Math.round(n*1e5)/1e5));unique.set(v.toArray().join(','),v)}
  const all=[...unique.values()],output=[]
  for(let i=0;i<p.count;i+=3)triangles.push([0,1,2].map(j=>new T.Vector3(...[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].map(n=>Math.round(n*1e5)/1e5))))
  for(const vs of triangles){if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).lengthSq()<1e-12)continue;const boundary=[];let split=false
    for(let i=0;i<3;i++){const a=vs[i],b=vs[(i+1)%3],edge=b.clone().sub(a),length=edge.lengthSq();const points=all.map(v=>({v,t:v.clone().sub(a).dot(edge)/length})).filter(({v,t})=>t>1e-5&&t<1-1e-5&&a.clone().addScaledVector(edge,t).distanceToSquared(v)<1e-8).sort((x,y)=>x.t-y.t);boundary.push(a,...points.map(x=>x.v));if(points.length)split=true}
    if(!split)output.push(...vs.flatMap(v=>v.toArray()));else{const center=vs[0].clone().add(vs[1]).add(vs[2]).multiplyScalar(1/3);for(let i=0;i<boundary.length;i++)output.push(...center.toArray(),...boundary[i].toArray(),...boundary[(i+1)%boundary.length].toArray())}
  }
  const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(output,3));result.computeVertexNormals();return result
}
function save(name,s,depth,rotate=false){let g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:24,steps:1});if(rotate)g.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(0,1,0),new T.Vector3(0,0,1),new T.Vector3(1,0,0)));const closed=closeTriangulation(g);const mesh=new T.Mesh(closed);mesh.updateMatrixWorld();const data=new STLExporter().parse(mesh,{binary:true});fs.writeFileSync(path.join(root,name+'.stl'),Buffer.from(data.buffer));g.dispose();closed.dispose()}
const deck=rect(100,150)
for(const x of [12,88])for(const y of [20,40,75,110,130])hole(deck,x,y,3.4)
for(const x of [6,90])for(const y of [27,45])slot(deck,x,y,4,10)
for(const x of [28,68])slot(deck,x,85,4,28)
save('deck-100x150x3',deck,3)
const strap=rect(32,12);hole(strap,4,6,3.4);hole(strap,28,6,3.4);save('strap-32x12x3',strap,3)
const coupon=rect(60,16);for(let i=0;i<5;i++)hole(coupon,8+i*11,8,3+i*.2);save('fit-coupon',coupon,3)
// 单个 L 形闭合轮廓，旋转后底座平放。无布尔相交面。
const bumper=new T.Shape();bumper.moveTo(0,0);bumper.lineTo(12,0);bumper.lineTo(12,16);bumper.lineTo(9,16);bumper.lineTo(9,3);bumper.lineTo(0,3);bumper.closePath();save('bumper-84x12x16',bumper,84,true)
console.log('已生成四个毫米单位 STL；须先打印试配片。')
