import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { type AlgorithmGraph, type Cell, type TensorNode, explainCell, shape } from './graph'

type Tile = {node:TensorNode;mesh:THREE.InstancedMesh;cells:Cell[];group:THREE.Group;dims:THREE.Sprite;windowKey:string}
// This renderer consumes tensors, dependencies and positions only. Algorithm math
// lives in graph adapters; no operation names or Transformer-specific layout here.
export class TensorRenderer {
  private renderer:THREE.WebGLRenderer
  private scene=new THREE.Scene()
  private camera=new THREE.PerspectiveCamera(38,1,.1,500)
  private controls:OrbitControls
  private root=new THREE.Group()
  private trace=new THREE.Group()
  private tiles:Tile[]=[]
  private graph:AlgorithmGraph|null=null
  private computation:AlgorithmGraph|null=null
  private observer:ResizeObserver
  private ray=new THREE.Raycaster()
  private down:[number,number]|null=null
  private textures:THREE.Texture[]=[]
  private disposed=false
  private center=new THREE.Vector3()
  private selected:Cell|null=null
  constructor(private canvas:HTMLCanvasElement,private onPick:(cell:Cell)=>void){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor('#f2f4ed')
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8a9a89,2.3))
    const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(-4,9,16);this.scene.add(light)
    this.scene.add(this.root,this.trace)
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=false;this.controls.minDistance=3;this.controls.maxDistance=140
    this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}
    this.controls.addEventListener('change',this.draw)
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas)
    canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointerup',this.pointerUp);canvas.addEventListener('pointercancel',this.cancelPointer)
    this.resize()
  }
  private resize=()=>{if(this.disposed)return;const {width,height}=this.canvas.getBoundingClientRect();if(width<1||height<1)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();if(this.graph)this.fit();else this.draw()}
  private draw=()=>{if(!this.disposed)this.renderer.render(this.scene,this.camera)}
  private pointerDown=(e:PointerEvent)=>{this.down=[e.clientX,e.clientY]}
  private cancelPointer=()=>{this.down=null}
  private pointerUp=(e:PointerEvent)=>{
    if(!this.down||Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>5){this.down=null;return}this.down=null
    const rect=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera)
    const hit=this.ray.intersectObjects(this.tiles.map(t=>t.mesh))[0]
    if(hit&&hit.instanceId!==undefined){const tile=this.tiles.find(t=>t.mesh===hit.object)!;this.onPick(tile.cells[hit.instanceId])}
  }
  private label(text:string,width=5,fontSize=34,color='#334c42',compact=false){
    const canvas=document.createElement('canvas');canvas.width=compact?128:768;canvas.height=compact?96:100
    const ctx=canvas.getContext('2d')!;ctx.font=`500 ${fontSize}px monospace`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width-20)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture)
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(width,width*canvas.height/canvas.width,1);sprite.renderOrder=3;return sprite
  }
  private clear(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose())}else if(o instanceof THREE.Sprite)o.material.dispose()});group.clear()}
  setGraph(graph:AlgorithmGraph,fit=true){
    this.graph=graph;this.selected=null;this.clear(this.root);this.clear(this.trace);this.textures.forEach(t=>t.dispose());this.textures=[];this.tiles=[]
    for(const node of graph.nodes)this.addTensor(node)
    for(const node of graph.nodes)for(const input of node.displayInputs??node.inputs){const from=graph.nodes.find(n=>n.id===input);if(!from)continue;const a=new THREE.Vector3(...from.position),b=new THREE.Vector3(...node.position);a.z-=.45;b.z-=.45
      const mid=a.clone().lerp(b,.5);mid.z-=1.4
      const curve=new THREE.QuadraticBezierCurve3(a,mid,b),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)),node.inputs.includes(input)?new THREE.LineBasicMaterial({color:node.color,transparent:true,opacity:.32}):new THREE.LineDashedMaterial({color:node.color,transparent:true,opacity:.4,dashSize:.2,gapSize:.17}));line.computeLineDistances();this.root.add(line)
      const near=curve.getPoint(.9),dir=b.clone().sub(near).normalize();this.root.add(new THREE.ArrowHelper(dir,near,near.distanceTo(b),new THREE.Color(node.color),.25,.15))
    }
    if(fit)this.fit();else this.draw()
  }
  private addTensor(node:TensorNode){
    const [rows,cols]=shape(node),nr=Math.min(rows,8),nc=Math.min(cols,12),sx=4.7/nc,sy=node.cellAspect?sx*node.cellAspect:Math.min(.6,sx),height=nr*sy
    const group=new THREE.Group();group.position.set(...node.position);this.root.add(group)
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(sx*.87,sy*.85,.22),new THREE.MeshStandardMaterial({roughness:.65,metalness:.04}),nr*nc)
    const cells:Cell[]=[],matrix=new THREE.Matrix4(),base=new THREE.Color(node.color),max=Math.max(...node.data.flat().filter(Number.isFinite).map(Math.abs),.001)
    for(let r=0;r<nr;r++)for(let c=0;c<nc;c++){
      const value=node.data[r][c],i=r*nc+c,t=Number.isFinite(value)?Math.min(1,Math.abs(value)/max):0
      matrix.makeTranslation((c-(nc-1)/2)*sx,((nr-1)/2-r)*sy,t*.25);mesh.setMatrixAt(i,matrix)
      const color=Number.isFinite(value)?new THREE.Color('#edf0e6').lerp(value<0?new THREE.Color('#b48869'):base,.2+.8*t):new THREE.Color('#cbd0c7');mesh.setColorAt(i,color);cells.push({node:node.id,row:r,col:c})
      if(rows*cols<=25){const label=this.label(Number.isFinite(value)?value.toFixed(1):'−∞',sx*.8,42,'#334c42',true);label.position.set((c-(nc-1)/2)*sx,((nr-1)/2-r)*sy,.5);group.add(label)}
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;group.add(mesh)
    const title=this.label(node.label,5.4);title.position.set(0,height/2+.65,.1);group.add(title)
    const dims=this.label(`${rows} × ${cols}${rows>nr||cols>nc?' · r0–'+(nr-1)+' c0–'+(nc-1):''}`,4.6,29,'#718178');dims.position.set(0,-height/2-.42,.1);group.add(dims)
    const border=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.9,height+.16,.25)),new THREE.LineBasicMaterial({color:node.color,transparent:true,opacity:.42}));group.add(border)
    this.tiles.push({node,mesh,cells,group,dims,windowKey:'0:0'})
  }
  private locate(cell:Cell){const tile=this.tiles.find(t=>t.node.id===cell.node);if(!tile)return null;const index=tile.cells.findIndex(c=>c.row===cell.row&&c.col===cell.col);if(index<0)return null;const m=new THREE.Matrix4();tile.mesh.getMatrixAt(index,m);return new THREE.Vector3().setFromMatrixPosition(m).add(tile.group.position)}
  select(cell:Cell){
    if(!this.graph)return
    this.selected=cell;this.clear(this.trace)
    const e=explainCell(this.computation??this.graph,cell)
    // Move each tensor's displayed window to contain the selected source indices.
    for(const tile of this.tiles){
      const chosen=tile.node.id===cell.node?cell:e.inputs.find(c=>c.node===tile.node.id)
      if(chosen)this.window(tile,chosen.row,chosen.col)
    }
    const output=this.locate(cell)
    const mark=(p:THREE.Vector3,color:number)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshBasicMaterial({color}));m.position.copy(p);m.position.z+=.3;this.trace.add(m)}
    if(output){mark(output,0xdb9742);const seen=new Set<string>();for(const ref of e.inputs){const key=JSON.stringify(ref);if(seen.has(key))continue;seen.add(key);const point=this.locate(ref);if(!point)continue;mark(point,0x386f64);const mid=point.clone().lerp(output,.5);mid.z+=1.2;this.trace.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(point,mid,output).getPoints(20)),new THREE.LineBasicMaterial({color:0x609786,transparent:true,opacity:.55})))}}
    this.draw()
  }
  selectWithDependencies(_view:AlgorithmGraph,full:AlgorithmGraph,cell:Cell){this.computation=full;this.select(cell)}
  private window(tile:Tile,row:number,col:number){
    const [rows,cols]=shape(tile.node),nr=Math.min(rows,8),nc=Math.min(cols,12),r0=Math.min(Math.floor(row/8)*8,rows-nr),c0=Math.min(Math.floor(col/12)*12,cols-nc)
    if(tile.windowKey===`${r0}:${c0}`)return
    tile.windowKey=`${r0}:${c0}`
    const oldMap=tile.dims.material.map,ctx=(oldMap?.image as HTMLCanvasElement).getContext('2d')!
    ctx.clearRect(0,0,768,100);ctx.fillText(`${rows} × ${cols} · r${r0}–${r0+nr-1} c${c0}–${c0+nc-1}`,384,50,748);if(oldMap)oldMap.needsUpdate=true
    const max=Math.max(...tile.node.data.flat().filter(Number.isFinite).map(Math.abs),.001),base=new THREE.Color(tile.node.color)
    tile.cells.forEach((ref,i)=>{ref.row=r0+Math.floor(i/nc);ref.col=c0+i%nc;const v=tile.node.data[ref.row][ref.col],m=new THREE.Matrix4();tile.mesh.getMatrixAt(i,m);m.elements[14]=Number.isFinite(v)?Math.abs(v)/max*.25:0;tile.mesh.setMatrixAt(i,m);tile.mesh.setColorAt(i,Number.isFinite(v)?new THREE.Color('#edf0e6').lerp(v<0?new THREE.Color('#b48869'):base,.2+.8*Math.abs(v)/max):new THREE.Color('#cbd0c7'))})
    tile.mesh.instanceMatrix.needsUpdate=true;if(tile.mesh.instanceColor)tile.mesh.instanceColor.needsUpdate=true
  }
  fit(){
    if(!this.graph?.nodes.length)return
    const box=new THREE.Box3();for(const n of this.graph.nodes){const p=new THREE.Vector3(...n.position);box.expandByPoint(p.clone().add(new THREE.Vector3(3,3,1)));box.expandByPoint(p.clone().sub(new THREE.Vector3(3,3,1)))}
    box.getCenter(this.center);const size=box.getSize(new THREE.Vector3()),distance=Math.max(size.y,size.x/Math.max(.4,this.camera.aspect))/(2*Math.tan(THREE.MathUtils.degToRad(19)))*1.03
    this.camera.position.copy(this.center).add(new THREE.Vector3(distance*.13,distance*.18,distance));this.controls.target.copy(this.center);this.controls.update();this.draw()
  }
  rotate(){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/9);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();this.draw()}
  zoom(factor:number){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();this.draw()}
  animate(progress:number){this.trace.children.forEach(o=>{if(o instanceof THREE.Mesh)o.scale.setScalar(.8+Math.sin(progress*Math.PI*2)*.2)});this.draw()}
  destroy(){this.disposed=true;this.observer.disconnect();this.controls.removeEventListener('change',this.draw);this.controls.dispose();this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointerup',this.pointerUp);this.canvas.removeEventListener('pointercancel',this.cancelPointer);this.clear(this.root);this.clear(this.trace);this.textures.forEach(t=>t.dispose());this.renderer.dispose();this.renderer.forceContextLoss()}
}
