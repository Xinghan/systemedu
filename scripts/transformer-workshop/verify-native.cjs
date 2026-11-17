const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('../../packages/student-web/node_modules/typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const {decodeModel,runTransformer}=require('../../packages/student-web/src/lib/algorithm-viz/transformer.ts');
const {convolutionGraph}=require('../../packages/student-web/src/lib/algorithm-viz/convolution.ts');
const {explainCell,validateGraph}=require('../../packages/student-web/src/lib/algorithm-viz/graph.ts');
const {transformerScene}=require('../../packages/student-web/src/lib/algorithm-viz/scenes.ts');
// The previous engine is an independent numerical oracle in this test only.
const {loadNativeBindings,TensorType:T}=require('../../third_party/llm-viz/src/llm/NativeBindings.ts');
const {TensorF32}=require('../../third_party/llm-viz/src/utils/tensor.ts');
const {constructModel}=require('../../third_party/llm-viz/src/llm/GptModelWasm.ts');
const root=path.resolve(__dirname,'../..'),asset=path.join(root,'packages/student-web/public/standalone/transformer-lab/model');
const raw=JSON.parse(fs.readFileSync(path.join(asset,'gpt-nano-sort-model.json'),'utf8')),model=decodeModel(raw),checks=[];let maxError=0;
const check=(name,fn)=>{fn();checks.push({name,pass:true})};
function close(a,b,tol=4e-4){assert.equal(a.length,b.length);a.forEach((v,i)=>{const diff=Math.abs(v-b[i]);maxError=Math.max(maxError,diff);assert.ok(Number.isFinite(v)&&diff<tol,`${i}: ${v} != ${b[i]} (${diff})`)})}
(async()=>{
 global.window={atob};global.fetch=async()=>new Response(fs.readFileSync(path.join(asset,'native.wasm')),{headers:{'Content-Type':'application/wasm'}});
 const native=await loadNativeBindings(),legacy=JSON.parse(JSON.stringify(raw));for(const key in legacy)if(legacy[key].shape)legacy[key]=TensorF32.fromJson(legacy[key]);
 const runtime=constructModel(legacy,legacy.config,native),get=(type,l=0)=>native.getModelTensor(runtime.modelPtr,type,l).buffer;
 for(const tokens of [[2,1,0,1,1,2],[0],[1,1,1,1,1,1],[2,0,2,0],[2,1,0,1,1,2,0,1,1,1,2]]){
  get(T.InputTokens).fill(0);get(T.InputTokens).set(tokens);native.runModel(runtime.modelPtr);
  const run=runTransformer(model,tokens),node=id=>run.graph.nodes.find(n=>n.id===id).data.flat();
  check(`length ${tokens.length}, ${tokens.join('')}: independent full forward logits`,()=>close(run.logits.flat(),Array.from(get(T.Logits).slice(0,tokens.length*3))));
  check(`length ${tokens.length}: actual embedding and all layer intermediates`,()=>{
   close(node('embed'),Array.from(get(T.InputEmbed).slice(0,tokens.length*48)));
   for(let l=0;l<3;l++)for(const [suffix,type,width] of [['.ln1',T.Ln1Norm,48],['.qkv',T.AttnQkv,144],['.concat',T.AttnVOut,48],['.attnOut',T.AttnProj,48],['.res1',T.AttnResidual,48],['.ln2',T.Ln2Norm,48],['.ffn',T.MlpMlp,192],['.gelu',T.MlpAct,192],['.mlpOut',T.MlpProj,48],['.res2',T.MlpResidual,48]])close(node(`b${l}`+suffix),Array.from(get(type,l).slice(0,tokens.length*width)));
  });
  check(`length ${tokens.length}: nine causal attention heads`,()=>{for(let l=0;l<3;l++)for(let h=0;h<3;h++){const n=run.graph.nodes.find(n=>n.id===`b${l}.h${h}.weights`);for(let r=0;r<tokens.length;r++){close(n.data[r],Array.from(get(T.AttnSm,l).slice(h*121+r*11,h*121+r*11+tokens.length)));assert.ok(n.data[r].slice(r+1).every(v=>v===0))}}});
 }
 const run=runTransformer(model,[2,1,0,1,1,2]);
 check('future input changes do not affect prefix logits',()=>{const other=runTransformer(model,[2,1,0,2,2,2]);close(run.logits.slice(0,3).flat(),other.logits.slice(0,3).flat(),1e-12)});
 check('first and last cells of every tensor have valid dependency explanations',()=>{for(const node of run.graph.nodes){for(const [row,col] of [[0,0],[node.data.length-1,node.data[0].length-1]]){const e=explainCell(run.graph,{node:node.id,row,col});assert.equal(e.value,node.data[row][col]);assert.ok(e.formula);for(const ref of e.inputs){const source=run.graph.nodes.find(n=>n.id===ref.node);assert.ok(source&&source.data[ref.row]?.[ref.col]!==undefined)}}}});
 check('eight scenes use actual existing tensor nodes at each block/head',()=>{for(const c of ['embedding','norm','attention','softmax','projection','mlp','residual','output'])for(let l=0;l<3;l++)for(let h=0;h<3;h++){const scene=transformerScene(run.graph,c,l,h);assert.ok(scene.nodes.length>=3);assert.ok(scene.nodes.every(n=>n&&n.data.length));}});
 check('convolution has independently hand-computed output and dependency window',()=>{const g=convolutionGraph();assert.deepEqual(g.nodes[2].data,[[6,0,-1],[-1,8,-1],[1,3,5]]);const e=explainCell(g,{node:'conv',row:0,col:0});assert.equal(e.value,6);assert.deepEqual(e.inputs.filter(r=>r.node==='image').map(r=>[r.row,r.col]),[[0,0],[0,1],[1,0],[1,1]]);assert.equal(convolutionGraph(7).nodes[2].data[0][0],8)});
 check('graph validation rejects missing dependencies and invalid cells',()=>{const g=convolutionGraph();assert.throws(()=>validateGraph({...g,nodes:g.nodes.slice(1)}));assert.throws(()=>explainCell(g,{node:'conv',row:3,col:0}));assert.throws(()=>runTransformer(model,[]))});
 const evidence={checks,maxAbsoluteDifferenceFromPreviousWasm:maxError,computedTensorNodes:run.graph.nodes.length,source:'All application computations and scene rendering authored locally; public weights retained. Previous WASM used only as test oracle.'};
 fs.mkdirSync(path.join(root,'artifacts/transformer-native'),{recursive:true});
 fs.writeFileSync(path.join(root,'artifacts/transformer-native/numerical-checks.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
