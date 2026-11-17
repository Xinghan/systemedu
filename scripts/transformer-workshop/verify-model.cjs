const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ts=require('../../packages/student-web/node_modules/typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const root=path.resolve(__dirname,'../..'),asset=path.join(root,'packages/student-web/public/standalone/transformer-lab/model');
const {loadNativeBindings,TensorType:T}=require('../../third_party/llm-viz/src/llm/NativeBindings.ts');
const {TensorF32}=require('../../third_party/llm-viz/src/utils/tensor.ts');
const {constructModel}=require('../../third_party/llm-viz/src/llm/GptModelWasm.ts');
const {attention}=require('../../packages/student-web/src/app/standalone/transformer-lab/math.ts');
const {TOPICS,HINTS}=require('../../packages/student-web/src/app/standalone/transformer-lab/model-content.ts');
const results=[];const check=(name,fn)=>{fn();results.push({name,pass:true});};
function close(actual,want,epsilon=2e-4){assert.equal(actual.length,want.length);for(let i=0;i<actual.length;i++)assert.ok(Number.isFinite(actual[i])&&Math.abs(actual[i]-want[i])<epsilon,`${i}: ${actual[i]} != ${want[i]}`)}
(async()=>{
 global.window={atob};
 global.fetch=async()=>new Response(fs.readFileSync(path.join(asset,'native.wasm')),{headers:{'Content-Type':'application/wasm'}});
 const native=await loadNativeBindings(),model=JSON.parse(fs.readFileSync(path.join(asset,'gpt-nano-sort-model.json')));
 for(const k in model)if(model[k].shape)model[k]=TensorF32.fromJson(model[k]);
 const runtime=constructModel(model,model.config,native),get=(t,l=0)=>native.getModelTensor(runtime.modelPtr,t,l).buffer;
 check('trained model dimensions',()=>{assert.equal(model.config.n_embd,48);assert.equal(model.config.n_head,3);assert.equal(model.config.n_layer,3)});
 let maxAttentionError=0;
 for(let l=0;l<3;l++)for(let h=0;h<3;h++){
  const qkv=get(T.AttnQkv,l),matrix=o=>Array.from({length:6},(_,t)=>Array.from(qkv.slice(t*144+h*16+o,t*144+h*16+o+16)));
  const ref=attention({Q:matrix(0),K:matrix(48),V:matrix(96)}),weights=get(T.AttnSm,l),value=get(T.AttnVOut,l);
  check(`layer ${l+1}, head ${h+1}: actual QKV and reference causal attention`,()=>{
   for(let t=0;t<6;t++){
    const w=Array.from(weights.slice(h*121+t*11,h*121+t*11+6));close(w,ref.weights[t]);
    maxAttentionError=Math.max(maxAttentionError,...w.map((x,i)=>Math.abs(x-ref.weights[t][i])));
    close(Array.from(value.slice(t*48+h*16,t*48+h*16+16)),ref.output[t],.002);
    assert.ok(w.slice(t+1).every(v=>v===0));close([w.reduce((a,b)=>a+b,0)],[1]);
   }
  });
 }
 check('embedding uses token and learned position lookup',()=>{const x=get(T.InputEmbed),e=get(T.Wte),p=get(T.Wpe),tokens=get(T.InputTokens);for(let t=0;t<6;t++)close(Array.from(x.slice(t*48,t*48+48)),Array.from({length:48},(_,j)=>e[tokens[t]*48+j]+p[t*48+j]));});
 check('changing future token preserves prefix at final logits',()=>{const before=Array.from(get(T.Logits).slice(0,15));get(T.InputTokens)[5]=0;native.runModel(runtime.modelPtr);close(Array.from(get(T.Logits).slice(0,15)),before,1e-6);});
 check('output probabilities finite and normalized',()=>{const p=get(T.LogitsSm);for(let t=0;t<11;t++){const r=Array.from(p.slice(t*3,t*3+3));assert.ok(r.every(x=>x>=0&&x<=1));close([r.reduce((a,b)=>a+b,0)],[1]);}});
 const python=process.env.MODEL_PYTHON||'python3';
 for(const topic of TOPICS.filter(t=>t.id!=='attention')){
  const good=topic.starter.replace('___',HINTS[topic.id]);
  check(topic.id+': runnable Python exercise',()=>{const r=spawnSync(python,['-c','import numpy as np\n'+good+'\n'+topic.tests],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)});
  check(topic.id+': incorrect implementation rejected',()=>{const r=spawnSync(python,['-c','import numpy as np\n'+topic.starter.replace('___','0')+'\n'+topic.tests],{encoding:'utf8'});assert.notEqual(r.status,0)});
 }
 const evidence={upstream:'9da93742382f1bf36c020c38a1ace454e82c4490',checks:results,maxAttentionError};
 fs.mkdirSync(path.join(root,'artifacts/transformer-model'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/transformer-model/numerical-checks.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(`${results.length} checks passed; max attention difference ${maxAttentionError}`);
})().catch(e=>{console.error(e);process.exitCode=1});
