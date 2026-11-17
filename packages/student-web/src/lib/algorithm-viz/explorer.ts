import type { Concept, ModelInput, Selection, Snapshot } from '../transformer-viz/bridge'
import { type AlgorithmGraph, type Cell, type Explanation, explainCell, shape } from './graph'
import { decodeModel, runTransformer } from './transformer'
import { transformerScene } from './scenes'
import { convolutionGraph } from './convolution'
import { TensorRenderer } from './renderer'

export type NativeSelection=Selection&{explanation:Explanation;nodeId:string}
export type NativeSnapshot=Omit<Snapshot,'selection'>&{selection:NativeSelection|null;mode:'transformer'|'convolution';stepTitle:string;nodes:{id:string;label:string;shape:[number,number]}[];explanation:Explanation|null;sources:{label:string;cell:Cell}[]}
export interface NativeExplorer {
  destroy():void; focus(id:Concept):void; overview():void; play():void; scrub(value:number):void; speed(value:number):void; rotate():void; zoom(factor:number):void; input(text:string):void; step():void
  attentionInput(layer?:number,head?:number):ModelInput;attentionWeights(layer?:number,head?:number):number[][]
  slice(layer:number,head:number):void; mode(value:'transformer'|'convolution'):void; select(cell:Cell):void; follow(cell:Cell):void; convolution(value:number):void
}
export async function createExplorer(canvas:HTMLCanvasElement,onFrame:(snapshot:NativeSnapshot)=>void,onPick:(selection:NativeSelection)=>void,signal?:AbortSignal):Promise<NativeExplorer>{
  const response=await fetch('/standalone/transformer-lab/model/gpt-nano-sort-model.json',{signal})
  if(!response.ok)throw new Error('模型权重加载失败')
  const model=decodeModel(await response.json());if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
  let run=runTransformer(model,[2,1,0,1,1,2]),mode:'transformer'|'convolution'='transformer',concept:Concept|null=null,layer=0,head=0,convValue=5
  let full:AlgorithmGraph=run.graph,view=transformerScene(full,null),time=0,running=false,rate=1,disposed=false,raf=0,last=0,lastEmit=0,selected:NativeSelection|null=null,explanation:Explanation|null=null,playCell=''
  const renderer=new TensorRenderer(canvas,cell=>select(cell,true))
  const sliding=()=>mode==='convolution'&&view.sequence.includes('conv')
  const duration=()=>sliding()?18:Math.max(1,view.sequence.length)*4
  function emit(){onFrame({time,duration:duration(),running,concept,tokens:run.tokens,probabilities:run.probabilities,selection:selected,mode,stepTitle:explanation?full.nodes.find(n=>n.id===explanation!.cell.node)?.label??'':'选择张量，逐格观察计算',nodes:view.nodes.map(n=>({id:n.id,label:n.label,shape:shape(n)})),explanation,sources:[...new Set(explanation?.inputs.map(c=>c.node)??[])].map(id=>({label:full.nodes.find(n=>n.id===id)!.label,cell:explanation!.inputs.find(c=>c.node===id)!}))})}
  function select(cell:Cell,openPanel=false){
    const node=full.nodes.find(n=>n.id===cell.node);if(!node)return
    explanation=explainCell(full,cell);renderer.selectWithDependencies(view,full,cell)
    if(mode==='transformer'){
      selected={name:node.label,shape:shape(node),index:[cell.row,cell.col],value:explanation.value,concept:node.category as Concept,explanation,nodeId:node.id}
      if(openPanel){running=false;onPick(selected)}
    }
    emit()
  }
  function rebuild(fit=true){const previous=explanation?.cell;full=mode==='transformer'?run.graph:convolutionGraph(convValue);view=mode==='transformer'?transformerScene(full,concept,layer,head):full;time=0;running=false;playCell='';selected=null;explanation=null;renderer.setGraph(view,fit);if(!fit&&previous&&view.nodes.some(n=>n.id===previous.node&&n.data[previous.row]?.[previous.col]!==undefined))select(previous);else emit()}
  function frame(now:number){if(disposed)return;const dt=last?Math.min(.15,(now-last)/1000):0;last=now
    if(running){time=Math.min(duration(),time+dt*rate);if(time>=duration())running=false;animate();renderer.animate(time);if(now-lastEmit>100){emit();lastEmit=now}}
    raf=requestAnimationFrame(frame)
  }
  function animate(){
    const position=Math.min(time,Math.max(0,duration()-.000001)),index=Math.min(view.sequence.length-1,Math.floor(position/4)),id=sliding()?'conv':view.sequence[index],node=full.nodes.find(n=>n.id===id)
    if(!node)return
    const row=sliding()?Math.min(2,Math.floor(position/2)/3|0):mode==='convolution'?0:Math.min(run.tokens.length-1,node.data.length-1),col=sliding()?Math.min(8,Math.floor(position/2))%3:Math.min(node.data[0].length-1,Math.floor((position%4)/4*Math.min(12,node.data[0].length)))
    const key=`${id}:${row}:${col}`;if(key!==playCell){playCell=key;select({node:id,row,col})}
  }
  renderer.setGraph(view);emit();raf=requestAnimationFrame(frame)
  return {
    destroy(){disposed=true;cancelAnimationFrame(raf);renderer.destroy()},
    focus(id){mode='transformer';concept=id;rebuild()},overview(){concept=null;rebuild()},
    play(){if(time>=duration())time=0;running=!running;emit()},scrub(v){running=false;time=Math.max(0,Math.min(v,duration()));animate();emit()},speed(v){rate=Math.max(.25,Math.min(4,v))},rotate(){renderer.rotate()},zoom(f){renderer.zoom(f)},
    input(text){if(!/^[ABC]{1,6}$/.test(text))throw new Error('请输入 1–6 个 A、B 或 C。');run=runTransformer(model,[...text].map(c=>'ABC'.indexOf(c)));rebuild(false)},
    step(){if(run.tokens.length>=model.config.block_size)return;const next=run.probabilities.indexOf(Math.max(...run.probabilities));run=runTransformer(model,[...run.tokens,next]);rebuild(false)},
    attentionInput(l=0,h=0){const get=(part:string)=>run.graph.nodes.find(n=>n.id===`b${l}.h${h}.${part}`)!.data;return {id:'native-model',title:`自主计算 · Block ${l+1} · Head ${h+1}`,Q:get('Q'),K:get('K'),V:get('V')}},
    attentionWeights(l=0,h=0){return run.graph.nodes.find(n=>n.id===`b${l}.h${h}.weights`)!.data},
    slice(l,h){layer=Math.max(0,Math.min(2,l));head=Math.max(0,Math.min(2,h));if(mode==='transformer')rebuild()},
    mode(value){mode=value;rebuild()},select(cell){running=false;select(cell,true)},follow(cell){running=false;const node=full.nodes.find(n=>n.id===cell.node);if(!node)return;const inputs=node.inputs.map(id=>full.nodes.find(n=>n.id===id)!);view={...full,nodes:[...inputs.map((n,i)=>({...n,position:[-4,(inputs.length-1)*3-i*6,0] as [number,number,number]})),{...node,position:[4,0,1]}],sequence:[node.id]};time=0;playCell='';renderer.setGraph(view);select(cell,true)},convolution(value){convValue=Math.max(-9,Math.min(9,value));if(mode==='convolution')rebuild(false)}
  }
}
