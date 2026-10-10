const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..')
function load(file){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path.join(root,'src/lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(m.exports,n=>n.endsWith('.json')?require(path.join(root,'src/lib',n)):require(n),m);return m.exports}
const d=load('diversity-evidence'),r=load('rejection-evidence'),pool=d.DIVERSITY_POOL
test('RDKit fixture and bit-set Tanimoto agree exactly; matrix symmetric with correct diagonals',()=>{
 assert.equal(pool.rows.length,16);assert.equal(new Set(pool.rows.map(r=>r.scaffold)).size,9)
 for(let i=0;i<16;i++)for(let j=0;j<16;j++){assert.equal(d.similarity(pool.rows[i].id,pool.rows[j].id),pool.matrix[i][j]);assert.equal(pool.matrix[i][j],pool.matrix[j][i]);if(i===j)assert.equal(pool.matrix[i][j],1)}
 assert.equal(pool.rows[1].scaffold,pool.rows[2].scaffold);assert.notEqual(d.similarity('D02','D03'),1)
 assert.equal(d.tanimoto([],[]),1);assert.equal(d.tanimoto([1],[2]),0)
})
test('MaxMin seed is explicit; each step is max of minimum distances, with deterministic ties',()=>{
 const a=d.pickDiverse();assert.equal(a.selected.length,10);assert.equal(a.selected[0],'D01');assert.deepEqual(a,d.pickDiverse())
 assert.equal(new Set(a.selected).size,10)
 for(let i=1;i<a.trace.length;i++){const candidate=d.nextDiversityCandidates(a.selected.slice(0,i),d.DEFAULT_DIVERSITY).find(x=>x.eligible);assert.equal(a.trace[i].chosen,candidate.id);assert.equal(a.trace[i].maxT,candidate.maxT)}
})
test('extra constraints are real, infeasible count returns fewer and never fills violating slots',()=>{
 const a=d.pickDiverse({...d.DEFAULT_DIVERSITY,uniqueScaffold:true});assert.equal(a.selected.length,9);assert.equal(a.complete,false)
 const b=d.pickDiverse({...d.DEFAULT_DIVERSITY,maxSimilarity:.1});for(let i=0;i<b.selected.length;i++)for(let j=0;j<i;j++)assert.ok(d.similarity(b.selected[i],b.selected[j])<=.1)
 for(const count of [0,17,2.5])assert.throws(()=>d.pickDiverse({...d.DEFAULT_DIVERSITY,count}))
 assert.throws(()=>d.pickDiverse({...d.DEFAULT_DIVERSITY,maxSimilarity:NaN}))
})
test('diversity export contains actual parameters, trace, structures and recomputable scores',()=>{
 const options={count:8,maxSimilarity:.4,uniqueScaffold:true},e=d.diversityEvidence(options,'我设置骨架唯一，检查实际数量')
 assert.deepEqual(e.selected,d.pickDiverse(options).selected);assert.deepEqual(e.selectedSummary,d.diversitySummary(e.selected));assert.equal(e.input.length,16);assert.ok(!('svg' in e.input[0]));assert.equal(e.input[0].score,.98)
})
test('short circuit computes first fail and marks subsequent checks not evaluated; exact boundaries pass',()=>{
 const a=r.rejectionTrace(r.REJECT_ROWS[0]);assert.equal(a.firstRule,'mw');assert.deepEqual(a.checks.map(x=>x.status),['fail','not-evaluated','not-evaluated','not-evaluated']);assert.equal(a.checks[0].excess,112)
 assert.equal(r.rejectionTrace(r.REJECT_ROWS[1]).firstRule,'logp');assert.equal(r.rejectionTrace(r.REJECT_ROWS[2]).firstRule,'hbd');assert.equal(r.rejectionTrace(r.REJECT_ROWS[3]).firstRule,'hba')
 assert.equal(r.rejectionTrace(r.REJECT_ROWS[4]).decision,'pass');assert.equal(r.rejectionTrace(r.REJECT_ROWS[5]).decision,'needs-data')
 assert.equal(r.rejectionTrace({...r.REJECT_ROWS[4],mw:NaN}).decision,'needs-data')
})
test('order changes first reason not decision; full diagnostic truly evaluates every rule',()=>{
 const order=['logp','mw','hbd','hba'];assert.equal(r.rejectionTrace(r.REJECT_ROWS[0],order).firstRule,'logp')
 assert.deepEqual(r.rejectionTrace(r.REJECT_ROWS[0],order,true).checks.map(c=>c.status),['fail','fail','fail','fail'])
 const e=r.rejectionEvidence(order,'改变规则顺序，但候选没有变');assert.deepEqual(e.results,r.REJECT_ROWS.map(row=>r.rejectionTrace(row,order)));assert.throws(()=>r.rejectionTrace(r.REJECT_ROWS[0],['mw']))
})
test('all 22 replacements retain source identities, anchors, hashes and no stale audio',()=>{
 for(const module of ['M88','M89']){const base=path.join(repo,'course_factory/fixtures/molecule-monster-hunter'),draft=require(path.join(base,module+'-evidence-v1.json')),registry=require(path.join(base,module+'-evidence-v1.registry.json')),old=require(path.join(base,module+'-before-evidence-v1/slides.json'));assert.equal(draft.slides.length,11);assert.equal(new Set(draft.slides.map(s=>s.payload.technical_visual.scene)).size,11);draft.slides.forEach((s,i)=>{assert.equal(s.slide_id,old.slides[i].slide_id);assert.equal(s.audio_path,null);assert.ok(s.audio_script.length>90);const p=old.slides[i].payload;if(p.theory_id||p.idea_id)assert.equal(s.lesson_anchor.id,p.theory_id||p.idea_id)});for(const [name,sha] of Object.entries(registry.source_sha256))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(base,module+'-before-evidence-v1',name))).digest('hex'),sha)}
})
test('all 22 actual scenes SSR with exact formulas, evidence, valid SVG and no renderer fallback',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 function component(name){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path.join(root,'src/components/learning',name+'.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(m.exports,n=>n.endsWith('.css')?{}:n==='@/lib/diversity-evidence'?d:n==='@/lib/rejection-evidence'?r:n==='./screening-common'?component('screening-common'):require(n),m);return m.exports}
 const c=component('diversity-rejection-visual')
 for(const module of ['M88','M89'])for(const s of require(path.join(repo,'course_factory/fixtures/molecule-monster-hunter',module+'-evidence-v1.json')).slides){const v=s.payload.technical_visual;const html=renderToStaticMarkup(React.createElement(module==='M88'?c.DiversityVisual:c.RejectionVisual,{visual:v}));assert.ok(html.includes(`data-scene="${v.scene}"`));assert.ok(!html.includes('data-formula-error'));assert.ok(html.includes('<table')||html.includes('<svg')||(html.includes('<math')&&html.includes('dr-steps')),`${module}/${v.scene} lacks connected evidence`);assert.ok(!html.includes('undefined'));}
})
test('all 18 retained legacy course files match the verified M87–M89 release artifacts',()=>{
 const release=path.join(repo,'artifacts/molecule-m87-m89-20260909'),metadata=require(path.join(release,'expected-source.json'))
 for(const rel of Object.keys(metadata.source_sha256)){
  const actual=fs.readFileSync(path.resolve(require('./course-source-roots.cjs').legacyCourse,rel)),expected=fs.readFileSync(path.join(release,'course',rel))
  assert.ok(actual.equals(expected),`${rel} differs from released content`)
 }
})
