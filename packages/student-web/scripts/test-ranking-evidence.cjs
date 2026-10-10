const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file) {
  const m={exports:{}}
  const source=ts.transpileModule(fs.readFileSync(path.join(root,'src/lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('exports','require','module',source)(m.exports,n=>n.startsWith('./')?load(n.slice(2)):require(n),m)
  return m.exports
}
const r=load('ranking-evidence'), f=load('funnel-evidence')
test('normalization is common-range, direction-aware, unit-invariant; never hides future outliers',()=>{
  assert.deepEqual([10,30,50].map(x=>r.scaleValue(x,{min:10,max:50},false)),[0,.5,1])
  assert.deepEqual([10,30,50].map(x=>r.scaleValue(x,{min:10,max:50},true)),[1,.5,0])
  assert.ok(Math.abs(r.scaleValue(.03,{min:.01,max:.05},false)-.5)<1e-12)
  assert.equal(r.scaleValue(70,{min:10,max:50},false),1.5)
  assert.equal(r.scaleValue(5,{min:5,max:5},false),0)
  assert.throws(()=>r.scaleValue(6,{min:5,max:5},false))
  assert.throws(()=>r.scaleValue(NaN,{min:0,max:1},false))
})
test('weights reject zero, negative and nonfinite; retain ratio and source worked total 0.81',()=>{
  assert.deepEqual(r.normalizeWeights([5,2,2,1]),[.5,.2,.2,.1])
  for(const w of [[0,0,0,0],[-1,2,3,4],[1,NaN,2,3]])assert.throws(()=>r.normalizeWeights(w))
  assert.ok(Math.abs(r.weightedScore([.9,.6,.7,1],[.5,.2,.2,.1])-.81)<1e-12)
})
test('actual M86 survivors are the entire ranking population; no rejected row returns',()=>{
  const rows=r.makeRankingRows(),survivors=f.runFunnel(f.makeCandidates()).survivors
  assert.deepEqual(rows.map(x=>x.id),survivors.map(x=>x.id))
  assert.deepEqual(r.makeRankingRows(),rows)
  const result=r.rankCandidates(rows,[5,2,2,1])
  assert.equal(result.ranked.length,survivors.length)
  for(const x of result.ranked){assert.ok(x.total>=0&&x.total<=1);assert.ok(Math.abs(x.contributions.reduce((a,b)=>a+b,0)-x.total)<1e-12);assert.equal(x.normalized[3],1)}
  assert.ok(result.ranked.every((x,i,a)=>!i||a[i-1].total>=x.total))
})
test('ties are deterministic by ID, independent of input order; display rounding does not set ranks',()=>{
  const a={id:'A',risk:.1,activity:.5,solubility:-2,lip:1},b={...a,id:'B'}
  assert.deepEqual(r.rankCandidates([b,a],[1,1,1,1]).ranked.map(x=>x.id),['A','B'])
  assert.throws(()=>r.rankCandidates([a,a],[1,1,1,1]))
  assert.throws(()=>r.rankCandidates([{...a,activity:NaN}],[1,1,1,1]))
  assert.deepEqual(r.rankCandidates([],[1,1,1,1]).ranked,[])
  const ranked=r.rankCandidates([{...a,activity:.8001},{...b,activity:.8004},{...a,id:'C',activity:0},{...a,id:'D',activity:1}],[0,1,0,0]).ranked
  assert.deepEqual(ranked.map(x=>x.id),['D','B','A','C'])
  assert.equal(ranked[1].total.toFixed(3),ranked[2].total.toFixed(3))
})

test('full exported evidence recomputes exactly and keeps the actual inputs, policies and Top10',()=>{
  const evidence=r.rankingEvidence([2,6,1,1])
  assert.equal(evidence.inputRows.length,255)
  assert.deepEqual(r.rankCandidates(evidence.inputRows,evidence.rawWeights).ranked,evidence.fullRanking)
  assert.deepEqual(evidence.top10,evidence.fullRanking.slice(0,10))
  assert.ok(evidence.limitation.includes('not a probability'))
})

test('10 draft pages preserve source order/IDs, anchors and hashes; no old audio or inline decoration',()=>{
  const crypto=require('node:crypto'),repo=path.resolve(root,'../..'),base=path.join(repo,'course_factory/fixtures/molecule-monster-hunter')
  const draft=JSON.parse(fs.readFileSync(path.join(base,'M87-ranking-v1.json'))),registry=JSON.parse(fs.readFileSync(path.join(base,'M87-ranking-v1.registry.json')))
  const source=JSON.parse(fs.readFileSync(path.join(base,'M87-before-ranking-v1/slides.json')))
  assert.equal(draft.slides.length,10);assert.equal(registry.slides.length,10)
  assert.equal(new Set(draft.slides.map(s=>s.payload.technical_visual.scene)).size,10)
  draft.slides.forEach((slide,i)=>{const p=source.slides[i].payload;assert.equal(slide.slide_id,source.slides[i].slide_id||`M87-slide-${i+1}`);assert.equal(slide.audio_path,null);assert.ok(slide.audio_script.length>100);assert.deepEqual(Object.keys(slide.payload),['technical_visual']);if(p.theory_id||p.idea_id)assert.equal(slide.lesson_anchor.id,p.theory_id||p.idea_id)})
  for(const [name,hash] of Object.entries(registry.source_sha256)) {
    // Source provenance is immutable; the canonical course now contains the
    // released replacement and is verified separately against release files.
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'M87-before-ranking-v1',name))).digest('hex'),hash)
  }
})

test('every actual String.raw formula compiles to MathML without accidental control characters',()=>{
  const katex=require('katex'),file=path.join(root,'src/components/learning/ranking-evidence-visual.tsx'),source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let count=0
  function visit(n){if(ts.isTaggedTemplateExpression(n)&&n.tag.getText(ast)==='String.raw'&&ts.isNoSubstitutionTemplateLiteral(n.template)){const value=n.template.rawText;assert.ok(!/[\t\r]/.test(value));assert.ok(katex.renderToString(value,{throwOnError:true,output:'htmlAndMathml'}).includes('<math'));count++}ts.forEachChild(n,visit)}
  visit(ast);assert.ok(count>=9)
})

test('all ten scene components render their own evidence and no client-only browser API during render',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  function component(name){const m={exports:{}};const file=path.join(root,'src/components/learning',name+'.tsx'),source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('exports','require','module',source)(m.exports,n=>n.endsWith('.css')?{}:n==='@/lib/ranking-evidence'?r:n==='@/lib/funnel-evidence'?f:n==='./screening-common'?component('screening-common'):require(n),m);return m.exports}
  const {RankingEvidenceVisual}=component('ranking-evidence-visual')
  for(const scene of ['overview','eligibility','scales','normalize','weighted','units','lab','pipeline','audit','handoff']){
    const html=renderToStaticMarkup(React.createElement(RankingEvidenceVisual,{visual:{renderer:'ranking-evidence',scene}}))
    assert.ok(html.includes(`data-scene="${scene}"`));assert.ok(html.includes('<table'));assert.ok(!html.includes('data-formula-error'))
    if(scene==='lab')assert.equal((html.match(/type="range"/g)||[]).length,4)
  }
})
test('weights change this dataset ranking without changing population; constant pass adds no discrimination',()=>{
  const rows=r.makeRankingRows(),a=r.rankCandidates(rows,[5,2,2,1]),b=r.rankCandidates(rows,[2,6,1,1])
  assert.notDeepEqual(a.ranked.slice(0,10).map(x=>x.id),b.ranked.slice(0,10).map(x=>x.id))
  assert.deepEqual(r.rankCandidates(rows,[0,0,0,1]).ranked.map(x=>x.id),rows.map(x=>x.id).sort())
})
test('unit-change counterexample changes a naive rank but not the normalized rank',()=>{
  const a=r.unitComparison(1),b=r.unitComparison(.001)
  assert.notDeepEqual(a.naive.map(x=>x.id),b.naive.map(x=>x.id))
  assert.deepEqual(a.correct.ranked.map(x=>x.id),b.correct.ranked.map(x=>x.id))
})
