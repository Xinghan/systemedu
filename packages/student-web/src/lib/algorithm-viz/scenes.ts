import type { Concept } from '../transformer-viz/bridge'
import type { AlgorithmGraph } from './graph'

// Layout belongs to the algorithm adapter, not the general renderer.
export function transformerScene(graph:AlgorithmGraph,concept:Concept|null,layer=0,head=0):AlgorithmGraph {
  const b=`b${layer}`,h=`${b}.h${head}`
  const panels:Record<Concept,string[]>={
    embedding:['E','P','token','position','embed'],
    norm:[layer===0?'embed':`b${layer-1}.res2`,b+'.ln1',b+'.qkv'],
    attention:[h+'.Q',h+'.K',h+'.V',h+'.scores',h+'.weights',h+'.out'],
    softmax:[h+'.scores',h+'.mask',h+'.weights'],
    projection:[b+'.h0.out',b+'.h1.out',b+'.h2.out',b+'.concat',b+'.attnOut.W',b+'.attnOut'],
    mlp:[b+'.ln2',b+'.ffn.W',b+'.ffn',b+'.gelu',b+'.mlpOut.W',b+'.mlpOut'],
    residual:[layer===0?'embed':`b${layer-1}.res2`,b+'.attnOut',b+'.res1',b+'.mlpOut',b+'.res2'],
    output:['b2.res2','final','vocab','logits','probs']
  }
  let ids:string[],positions:[number,number,number][]
  if(concept){ids=panels[concept];positions=ids.map((_,i)=>[(i%3-1)*6.5,3.4-Math.floor(i/3)*7,(i%3===1?1:0)])
    if(ids.length===3)positions=[[-6.5,0,0],[0,0,1],[6.5,0,0]]
    if(concept==='embedding')positions=[[-6,4,-.4],[6,4,-.4],[-6,-1,0],[6,-1,0],[0,-6,1]]
    if(concept==='residual')positions=[[-7,3,0],[0,5,1],[0,-1,0],[7,4,1],[7,-4,0]]
  }else{
    ids=['embed',...Array.from({length:3},(_,l)=>[`b${l}.ln1`,`b${l}.h0.weights`,`b${l}.concat`,`b${l}.res1`,`b${l}.gelu`,`b${l}.res2`]).flat(),'probs']
    positions=ids.map((_,i)=>i===0?[-24,8,0]:i===19?[24,-8,3.6]:[((i-1)%6)*6.5-16.25,8-((i-1)/6|0)*8,((i-1)/6|0)*1.8])
  }
  const visible=new Set(ids)
  const closest=(id:string):string[]=>visible.has(id)?[id]:(graph.nodes.find(n=>n.id===id)?.inputs??[]).flatMap(closest)
  const nodes=ids.map((id,i)=>{const n=graph.nodes.find(n=>n.id===id)!;return {...n,label:concept?n.label:(id.match(/^b(\d)\./)?`Block ${Number(id[1])+1} · ${n.label}`:n.label),position:positions[i],displayInputs:[...new Set(n.inputs.flatMap(closest))]}})
  return {...graph,title:concept??'完整计算路径',nodes,sequence:ids.filter(id=>graph.sequence.includes(id))}
}
