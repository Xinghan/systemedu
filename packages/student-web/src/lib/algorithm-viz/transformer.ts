import { type AlgorithmGraph, type Matrix, type TensorNode, validateGraph } from './graph'

export type Weight = {shape:number[];values:Float32Array}
export type Weights = Record<string,Weight>
export type Config = {n_layer:number;n_head:number;n_embd:number;vocab_size:number;block_size:number}
export type Model = {config:Config;weights:Weights}
type Encoded = {shape:number[];dtype:string;data:string}
export function decodeModel(raw:Record<string,unknown>):Model {
  const config=raw.config as Config, weights:Weights={}
  if(!config||config.n_head!==3||config.n_embd%config.n_head!==0||config.n_layer!==3||config.n_embd!==48||config.vocab_size!==3||config.block_size!==11)throw new Error('模型配置不兼容')
  for(const [key,entry] of Object.entries(raw)){
    if(key==='config')continue
    const tensor=entry as Encoded
    if(tensor.dtype!=='torch.float32'||!Array.isArray(tensor.shape))throw new Error('权重格式不兼容：'+key)
    const bytes=Uint8Array.from(atob(tensor.data),c=>c.charCodeAt(0)), view=new DataView(bytes.buffer)
    if(bytes.length!==4*tensor.shape.reduce((a,b)=>a*b,1))throw new Error('权重长度不符：'+key)
    const values=Float32Array.from({length:bytes.length/4},(_,i)=>view.getFloat32(i*4,true))
    if(values.some(v=>!Number.isFinite(v)))throw new Error('非法权重：'+key)
    weights[key]={shape:tensor.shape,values}
  }
  return {config,weights}
}
export const gelu=(x:number)=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x*x*x)))
export const rowSoftmax=(row:number[])=>{const max=Math.max(...row);if(!Number.isFinite(max))throw new Error('Softmax 至少需要一个有限输入');const exp=row.map(x=>Math.exp(x-max)),sum=exp.reduce((a,b)=>a+b,0);return exp.map(x=>x/sum)}
export const linear=(x:Matrix,w:Matrix,b:number[]=[])=>x.map(row=>w.map((out,j)=>out.reduce((s,v,k)=>s+v*row[k],b[j]??0)))
export const layerNorm=(x:Matrix,gamma:number[],beta:number[])=>x.map(row=>{const mean=row.reduce((a,b)=>a+b,0)/row.length,variance=row.reduce((s,v)=>s+(v-mean)**2,0)/row.length;return row.map((v,j)=>(v-mean)/Math.sqrt(variance+1e-5)*gamma[j]+beta[j])})
export const multiply=(a:Matrix,b:Matrix)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)))
export const add=(a:Matrix,b:Matrix)=>a.map((row,i)=>row.map((v,j)=>v+b[i][j]))
export const weightMatrix=(w:Weight):Matrix=>Array.from({length:w.shape[0]},(_,i)=>Array.from(w.values.slice(i*w.shape[1],(i+1)*w.shape[1])))
export type Run={graph:AlgorithmGraph;tokens:number[];probabilities:number[];logits:Matrix}

// Full forward pass, authored locally: no upstream renderer, runtime or WASM.
export function runTransformer(model:Model,tokens:number[]):Run {
  const {config:c,weights:w}=model,d=c.n_embd,dk=d/c.n_head
  if(!tokens.length||tokens.length>c.block_size||tokens.some(t=>!Number.isInteger(t)||t<0||t>=c.vocab_size))throw new Error('词元序列超出模型容量')
  const nodes:TensorNode[]=[],sequence:string[]=[]
  const matrix=(key:string)=>{if(!w[key])throw new Error('缺失权重 '+key);return weightMatrix(w[key])}
  const vector=(key:string)=>Array.from(w[key].values)
  const append=(id:string,label:string,data:Matrix,op:TensorNode['op'],inputs:string[],category:string,meta?:TensorNode['meta'])=>{
    const color=op==='input'?'#6b8aab':category==='attention'||category==='softmax'?'#438b7b':category==='mlp'?'#b58b54':category==='residual'?'#7e9c54':'#718eac'
    const node:TensorNode={id,label,data,op,inputs,category,color,position:[0,0,0],meta};nodes.push(node);if(op!=='input')sequence.push(id);return node
  }
  append('E','Token table E',matrix('transformer.wte.weight'),'input',[],'embedding')
  append('P','Position table P',matrix('transformer.wpe.weight'),'input',[],'embedding')
  const e=append('token','Token lookup',tokens.map(t=>nodes[0].data[t].slice()),'lookup',['E'],'embedding',{ids:tokens})
  const p=append('position','Position lookup',tokens.map((_,i)=>nodes[1].data[i].slice()),'lookup',['P'],'embedding')
  let x=append('embed','X = E + P',add(e.data,p.data),'add',[e.id,p.id],'embedding')
  for(let l=0;l<c.n_layer;l++){
    const prefix=`transformer.h.${l}`,id=`b${l}`
    const norm=(suffix:string,input:TensorNode)=>append(id+suffix,suffix==='.ln1'?'LN₁(X)':'LN₂(U)',layerNorm(input.data,vector(prefix+(suffix==='.ln1'?'.ln_1.weight':'.ln_2.weight')),vector(prefix+(suffix==='.ln1'?'.ln_1.bias':'.ln_2.bias'))),'norm',[input.id],'norm',{gamma:vector(prefix+(suffix==='.ln1'?'.ln_1.weight':'.ln_2.weight')),beta:vector(prefix+(suffix==='.ln1'?'.ln_1.bias':'.ln_2.bias'))})
    const project=(suffix:string,key:string,input:TensorNode,category:string,label:string)=>{const wn=append(id+suffix+'.W',label+' weights',matrix(prefix+key+'.weight'),'input',[],category),bias=vector(prefix+key+'.bias');return append(id+suffix,label,linear(input.data,wn.data,bias),'linear',[input.id,wn.id],category,{bias})}
    const ln=norm('.ln1',x),qkv=project('.qkv','.attn.c_attn',ln,'attention','QKV projection'),heads:TensorNode[]=[]
    for(let h=0;h<c.n_head;h++){
      const hid=id+`.h${h}`
      const parts=['Q','K','V'].map((label,i)=>append(hid+'.'+label,label+` · H${h+1}`,qkv.data.map(row=>row.slice(i*d+h*dk,i*d+(h+1)*dk)),'slice',[qkv.id],'attention',{offset:i*d+h*dk}))
      const [q,k,v]=parts
      const scores=append(hid+'.scores','QKᵀ / √dₖ',q.data.map(row=>k.data.map(kr=>row.reduce((s,v,i)=>s+v*kr[i],0)/Math.sqrt(dk))),'scores',[q.id,k.id],'attention')
      const mask=append(hid+'.mask','Causal mask',scores.data.map((row,i)=>row.map((v,j)=>j<=i?v:-Infinity)),'mask',[scores.id],'softmax')
      const a=append(hid+'.weights','Attention A',mask.data.map(rowSoftmax),'softmax',[mask.id],'softmax')
      heads.push(append(hid+'.out','A × V',multiply(a.data,v.data),'matmul',[a.id,v.id],'attention'))
    }
    const concat=append(id+'.concat','Concat · 3 heads',tokens.map((_,r)=>heads.flatMap(h=>h.data[r])),'concat',heads.map(h=>h.id),'projection')
    const out=project('.attnOut','.attn.c_proj',concat,'projection','Output projection')
    const u=append(id+'.res1','X + Attention',add(x.data,out.data),'add',[x.id,out.id],'residual')
    const ln2=norm('.ln2',u),hidden=project('.ffn','.mlp.c_fc',ln2,'mlp','Linear · 48 → 192')
    const activated=append(id+'.gelu','GELU',hidden.data.map(row=>row.map(gelu)),'gelu',[hidden.id],'mlp')
    const update=project('.mlpOut','.mlp.c_proj',activated,'mlp','Linear · 192 → 48')
    x=append(id+'.res2','U + MLP',add(u.data,update.data),'add',[u.id,update.id],'residual')
  }
  const final=append('final','Final LayerNorm',layerNorm(x.data,vector('transformer.ln_f.weight'),vector('transformer.ln_f.bias')),'norm',[x.id],'output',{gamma:vector('transformer.ln_f.weight'),beta:vector('transformer.ln_f.bias')})
  const head=append('vocab','Vocabulary weights',matrix('lm_head.weight'),'input',[],'output')
  const logits=append('logits','Vocabulary logits',linear(final.data,head.data),'linear',[final.id,head.id],'output')
  const probs=append('probs','Next-token probability',logits.data.map(rowSoftmax),'softmax',[logits.id],'output')
  const graph:AlgorithmGraph={id:'transformer',title:'Transformer · computed locally',description:'3 Blocks · 3 Heads · 48 features',nodes,sequence}
  validateGraph(graph)
  return {graph,tokens:tokens.slice(),probabilities:probs.data.at(-1)!,logits:logits.data}
}
