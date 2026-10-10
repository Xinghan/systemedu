const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),katex=require('katex')
require('katex/contrib/mhchem')
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),cache={}
function load(file){
  if(cache[file])return cache[file]
  const m={exports:{}},source=ts.transpileModule(fs.readFileSync(path.join(root,'src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  const modules={'@/lib/logp-lab':'lib/logp-lab.ts','./screening-common':'components/learning/screening-common.tsx','./partition-object-3d':'components/learning/partition-object-3d.tsx'}
  new Function('exports','require','module',source)(m.exports,name=>name.endsWith('.css')?{}:name==='@/lib/rdkit'?{drawSmilesSvg:()=>Promise.resolve('')}:modules[name]?load(modules[name]):require(name),m)
  return cache[file]=m.exports
}
const model=load('lib/logp-lab.ts'),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`)
test('partition conserves solute and concentration ratio for all control states',()=>{
  for(let logP=-2;logP<=2;logP+=.5)for(const vo of [5,10,20]){
    const p=model.partitionState(logP,vo)
    near(p.organicUmol+p.waterUmol,10);near(p.organicMm/p.waterMm,10**logP)
    near(p.organicMm*p.organicMl,p.organicUmol);near(p.waterMm*p.waterMl,p.waterUmol)
    assert.ok(p.organicFraction>0&&p.organicFraction<1)
  }
})
test('equal concentrations do not imply equal amounts for unequal volumes',()=>{
  const p=model.partitionState(0,20);near(p.organicMm,p.waterMm);near(p.organicUmol/p.waterUmol,2)
  const q=model.partitionState(1);near(q.organicUmol,100/11);near(q.waterUmol,10/11)
  for(const args of [[NaN],[1,0],[1,10,-1],[1,10,10,0],[Infinity]])assert.throws(()=>model.partitionState(...args))
})
test('three original example structures reproduce the fixed RDKit descriptors',async()=>{
  const rdkit=await require('@rdkit/rdkit')()
  for(const r of model.LOGP_SAMPLES){const m=rdkit.get_mol(r.smiles);assert.ok(m?.is_valid());try{const d=JSON.parse(m.get_descriptors());near(d.CrippenClogP,r.logP);near(d.amw,r.mw)}finally{m.delete()}}
})
test('histogram counts exact values before rounding and exported evidence is labelled',()=>{
  const e=model.logpEvidence();assert.deepEqual(e.histogram.map(b=>b.count),[1,1,0,1]);assert.equal(e.measured,false);assert.equal(e.sampleCount,3)
  assert.ok(model.LOGP_SAMPLES[1].logP<0)
})
test('all actual formula templates compile to accessible MathML',()=>{
  let count=0
  for(const f of ['logp-lab-visual.tsx','partition-object-3d.tsx']){
    const s=fs.readFileSync(path.join(root,'src/components/learning',f),'utf8')
    for(const match of s.matchAll(/String\.raw`([^`]+)`/g)){const html=katex.renderToString(match[1],{throwOnError:true,output:'htmlAndMathml'});assert.ok(html.includes('<math'));count++}
  }
  assert.equal(count,2)
})
const fixture=path.join(repo,'course_factory/fixtures/molecule-monster-hunter'),draft=JSON.parse(fs.readFileSync(path.join(fixture,'M38-multimodal-v1.json'))),registry=JSON.parse(fs.readFileSync(path.join(fixture,'M38-multimodal-v1.registry.json')))
test('all ten scenes render actual evidence, no old audio or inline SVG substitution',()=>{
  const {LogpLabVisual}=load('components/learning/logp-lab-visual.tsx')
  assert.equal(draft.slides.length,10)
  const old=JSON.parse(fs.readFileSync(path.join(fixture,'M38-before-multimodal-v1/slides.json'))).slides
  for(const [i,s] of draft.slides.entries()){
    assert.equal(s.slide_id,old[i].slide_id);assert.equal(s.kind,old[i].kind);assert.equal(s.audio_path,null);assert.ok(!s.payload.inline_svg)
    const h=renderToStaticMarkup(React.createElement(LogpLabVisual,{visual:s.payload.technical_visual}))
    assert.ok(h.includes(`data-scene="${s.payload.technical_visual.scene}"`));assert.ok(h.length>1000);assert.ok(!h.includes('data-formula-error'))
    if([1,2].includes(i))assert.ok(h.includes('data-medium="threejs"'))
    if([0,8].includes(i))assert.ok(h.includes('data-medium="generated-raster"'))
  }
})
test('retained legacy source matches reviewed or deployed hashes and image is real compressed WebP',()=>{
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
  for(const [name,hash] of Object.entries(registry.deployed_sha256||registry.source_sha256)){
    const b=fs.readFileSync(path.resolve(require('./course-source-roots.cjs').legacyCourse,'knodes',draft.node,name));assert.equal(sha(b),hash)
  }
  const a=registry.assets[0],b=fs.readFileSync(path.join(repo,a.path));assert.equal(sha(b),a.sha256);assert.ok(b.length<300000);assert.equal(b.subarray(8,12).toString(),'WEBP');assert.deepEqual(a.pages,[1,9])
})
test('Three.js is loaded on demand and has explicit disposal, reset and fallback',()=>{
  const s=fs.readFileSync(path.join(root,'src/components/learning/partition-object-3d.tsx'),'utf8')
  for(const code of ["await import('three')",'new T.WebGLRenderer','new OrbitControls','renderer.dispose()','controls.dispose()','observer.disconnect()',"webglcontextlost",'重置模型','查看备用剖面'])assert.ok(s.includes(code),code)
  assert.ok(!s.includes('requestAnimationFrame'))
})
