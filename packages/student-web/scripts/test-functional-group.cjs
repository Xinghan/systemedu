const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const file=path.resolve(__dirname,'../src/lib/functional-group.ts'),m={exports:{}}
new Function('exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,m)
const f=m.exports
const crypto=require('node:crypto'),fixtures=path.resolve(__dirname,'../../../course_factory/fixtures/molecule-monster-hunter'),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const rows=[{smiles:'CC',logP:1.0262,mw:30.070},{smiles:'CCO',logP:-.0014,mw:46.069}]
test('a longer chain is a confounded comparison, not the selected one-site edit',()=>{assert.equal(f.comparisonScope('CCO').matched,true);assert.equal(f.comparisonScope('CCCO').matched,false);assert.equal(f.comparisonScope('CCN').matched,true);assert.throws(()=>f.comparisonScope('bad'))})
test('trace reveals only results reached by the current step',()=>{assert.deepEqual(f.traceResults(0,rows),[]);assert.equal(f.traceResults(1,rows).length,1);assert.equal(f.traceResults(2,rows).length,2);assert.equal(f.traceResults(3,rows).length,2);assert.throws(()=>f.traceResults(9,rows))})
test('a record needs actual fixed-pair calculation, a learner conclusion and an explicit boundary',()=>{assert.equal(f.makeComparisonRecord(rows,'2025.03.4','',true).record,null);assert.equal(f.makeComparisonRecord(rows,'2025.03.4','本次计算得到的差异还不是实测水中溶解度。',false).record,null);const good=f.makeComparisonRecord(rows,'2025.03.4','本次计算得到的差异还不是实测水中溶解度。',true).record;assert.equal(good.source,'browser-rdkit-computation');assert.equal(good.measured,false);assert.ok(Math.abs(good.delta+1.0276)<1e-9);assert.deepEqual(f.restoreComparison(JSON.stringify(good)),good);assert.equal(f.restoreComparison(null),null);good.rows[0].logP=0;assert.equal(f.restoreComparison(JSON.stringify(good)),null)})
test('RDKit computes all registered candidate structures and fixed-pair reference values',async()=>{const rdkit=await require('@rdkit/rdkit')();for(const r of f.GROUP_CHOICES){const mol=rdkit.get_mol(r.smiles);assert.ok(mol?.is_valid());const d=JSON.parse(mol.get_descriptors());assert.ok(Number.isFinite(d.CrippenClogP));if(r.smiles==='CCO')assert.ok(Math.abs(d.CrippenClogP+.0014)<1e-6);mol.delete()}})
test('all nine M04 pages retain source mapping and explicitly have no stale audio',()=>{
 const registry=JSON.parse(fs.readFileSync(path.join(fixtures,'M04-controlled-v1.registry.json'))),raw=fs.readFileSync(path.join(fixtures,'M04-controlled-v1.json')),draft=JSON.parse(raw),before=JSON.parse(fs.readFileSync(path.join(fixtures,'M04-before-controlled-v1/slides.json')))
 assert.equal(sha(raw),registry.draft_sha256);assert.equal(draft.slides.length,9);assert.equal(new Set(draft.slides.map(s=>s.slide_id)).size,9)
 for(const [i,s]of draft.slides.entries()){assert.equal(s.audio_path,null);assert.equal(registry.slides[i].source_index,i);assert.equal(registry.slides[i].source_title,before.slides[i].title);assert.equal(s.payload.technical_visual.scene,registry.slides[i].scene)}
 for(const [file,hash]of Object.entries(registry.source_sha256))assert.equal(sha(fs.readFileSync(path.join(fixtures,'M04-before-controlled-v1',file))),hash)
 for(const a of registry.assets){const p=path.resolve(__dirname,'..',a.path);assert.equal(fs.statSync(p).size,a.bytes);assert.equal(sha(fs.readFileSync(p)),a.sha256);assert.ok(a.bytes<300000)}
})
test('M04 chemical notation renders through KaTeX/mhchem without guessed glyphs',()=>{
 const katex=require('katex');require('katex/contrib/mhchem')
 for(const formula of [String.raw`\ce{C2H6}\quad\text{vs.}\quad\ce{C2H6O}`,String.raw`\ce{R-OH}\qquad\ce{R-NH2}`])assert.ok(katex.renderToString(formula,{throwOnError:true,output:'htmlAndMathml'}).includes('<math'))
})
test('historical M02/M03 release artifacts remain verifiable before the read-only revision',()=>{
 const meta=JSON.parse(fs.readFileSync(path.resolve(fixtures,'../../../artifacts/molecule-m0203-20260910/expected-source.json'))),course=path.resolve(fixtures,'../../../../systemeduidea/projects_data/molecule-monster-hunter')
 for(const [p,hash]of Object.entries(meta.course_sha256)){
  const [,node,name]=p.split('/'),module=node.split('-')[0]
  const file=['slides.json','audio_scripts.json'].includes(name)?path.resolve(fixtures,'../../../artifacts/readonly-m02-m03-20260914',module,name):path.join(course,p)
  assert.equal(sha(fs.readFileSync(file)),hash)
 }
})
