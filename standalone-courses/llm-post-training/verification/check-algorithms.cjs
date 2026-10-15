// Compile the production TS math/catalog/store to an isolated directory, then audit it.
// Run from repo root: node standalone-courses/llm-post-training/verification/check-algorithms.cjs
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../../..')
const ts=require(path.join(root,'packages/student-web/node_modules/typescript'))
const src=path.join(root,'packages/student-web/src/app/standalone/post-training')
const out=fs.mkdtempSync(path.join(os.tmpdir(),'posttraining-algorithm-audit-'))
try {
 for(const name of ['algorithm-math','algorithm-catalog','record']) {
  const result=ts.transpileModule(fs.readFileSync(path.join(src,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
  fs.writeFileSync(path.join(out,name+'.js'),result.outputText)
 }
 const m=require(path.join(out,'algorithm-math')),catalog=require(path.join(out,'algorithm-catalog')),records=require(path.join(out,'record'))
 const close=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`)
 const z=[2,1,0],prob=m.softmax(z),g=prob.map((p,i)=>p-Number(i===1))
 close(m.ce(z,1),1.4076059644443804)
 close(m.sum(g),0)
 close(m.ce([1002,1001,1000],1),m.ce(z,1))
 for(let i=0;i<3;i++){const plus=z.slice(),minus=z.slice();plus[i]+=1e-5;minus[i]-=1e-5;close((m.ce(plus,1)-m.ce(minus,1))/2e-5,g[i])}
 close(m.preference(2,2,.5).loss,Math.log(2))
 close(m.preference(1,0,.5).gradient,(m.preference(1+1e-5,0,.5).loss-m.preference(1-1e-5,0,.5).loss)/2e-5)
 for(const rank of [1,2]){const x=[1,2,-1],v=m.lora(rank,2,x);v.delta.forEach((value,i)=>close(value,m.matvec(v.BA,x)[i]*2/rank))}
 const q=m.quantize([-.7,-.3,-.1,0,.2,.4,.6,1]);assert.equal(q.codes[3],7);close(q.restored[4],.1609302)
 assert.equal(m.quantize([-.7,-.3,-.1,0,.2,.4,.6,6]).codes[4],7)
 const adam=m.adamTrajectory(.1,1,.1);close(adam[0].w,1.880000001);close(adam[0].mh,1)
 const score=m.classification([0,0,1,1,2,2],[0,0,1,0,2,-1]);close(score.macro,(.8+2/3+2/3)/3);close(score.valid,5/6);assert.equal(score.perClass[2].fn,1)
 const boot=m.bootstrap([0,1],[1,0],7);assert.deepEqual(boot,m.bootstrap([0,1],[1,0],7));assert.ok(boot.low<=boot.high)
 // Every frame and every control endpoint must produce finite, correctly labelled math.
 let frames=0
 for(const [id,spec] of Object.entries(catalog.ALGORITHMS)){
  const initial=catalog.settings(id),variants=[initial]
  for(const c of spec.controls)for(const value of [c.min,c.max])variants.push({...initial,[c.key]:value})
  for(const config of variants)for(const frame of spec.frames(config)){
   frames++;assert.equal(frame.values.length,frame.labels.length,id)
   assert.ok(frame.values.every(Number.isFinite),id)
   if(frame.matrix)assert.ok(frame.matrix.flat().every(Number.isFinite),id)
   if(frame.points)assert.ok(frame.points.flat().every(Number.isFinite),id)
  }
 }
 const att=catalog.ALGORITHMS.attention.frames(catalog.settings('attention'))[1]
 close(att.values[3],0);close(m.sum(att.values),1)
 const zero=catalog.ALGORITHMS.loragrad.frames({zero:1,lr:.1});assert.equal(zero.at(-1).values[2],0)
 const acc=catalog.ALGORITHMS.accumulation.frames({n:10});close(acc[2].values[0],8/3)
 const group=catalog.ALGORITHMS.policy.frames({group:1,sample:2,ratio:1.5,epsilon:.2});assert.deepEqual(group[1].values,[0,0,0,0])
 // Keep v2 records readable. Added experiments must not erase old notes or 3D choices.
 const old=records.freshRecord();old.nodes.M03.notes='Existing learner note';old.nodes.M03.slide=3;old.lab.rank=32
 assert.ok(records.isRecord(old))
 const storage=new Map([[`${records.COURSE_ID}:${records.VERSION}`,JSON.stringify(old)]])
 global.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}
 const store=records.createRecordStore();store.start()
 store.update({...store.snapshot().record,experiments:{softmax:{step:4,values:{z:3,target:1,lr:.5}}}})
 const restored=records.createRecordStore();restored.start();assert.equal(restored.snapshot().record.nodes.M03.notes,old.nodes.M03.notes)
 assert.equal(restored.snapshot().record.lab.rank,32);assert.equal(restored.snapshot().record.experiments.softmax.step,4)
 assert.ok(!records.isRecord({...old,experiments:{softmax:{step:0,values:{z:NaN}}}}))
 assert.ok(!records.isRecord({...old,experiments:null}))
 // Published markers form an exact coverage map of the implemented algorithms.
 const seen=[]
 for(const id of records.MODULE_IDS){const note=fs.readFileSync(path.join(root,'standalone-courses/llm-post-training/nodes',id+'.md'),'utf8');for(const [,lab] of note.matchAll(/\[\[LAB:([a-z0-9]+)\]\]/g)){assert.ok(catalog.ALGORITHMS[lab]);seen.push(lab)}}
 assert.deepEqual(seen.sort(),Object.keys(catalog.ALGORITHMS).sort())
 console.log(JSON.stringify({status:'passed',algorithms:seen.length,numericalFramesChecked:frames,checks:['CE finite difference and shift invariance','DPO derivative','LoRA factorization','NF4 outlier/zero','AdamW first step','invalid JSON F1','paired resampling','control endpoints','causal masking','zero initialization','token weighting','equal-reward advantage','v2 record preservation and new state restore','all lesson markers covered']},null,2))
} finally {fs.rmSync(out,{recursive:true,force:true})}
