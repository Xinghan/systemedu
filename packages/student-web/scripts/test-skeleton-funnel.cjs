const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript')
const lib=path.resolve(__dirname,'../src/lib'),root=path.resolve(__dirname,'../../..'),fixtures=path.join(root,'course_factory/fixtures/molecule-monster-hunter')
function load(name){const file=path.join(lib,name),m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(m.exports,p=>require(p.startsWith('.')?path.resolve(path.dirname(file),p):p),m);return m.exports}
const f=load('funnel-evidence.ts'),s=load('molecule-skeleton.ts'),rows=f.makeCandidates(),run=f.runFunnel(rows)
test('5000 deterministic teaching records, exact stage conservation and id partition',()=>{
  assert.deepEqual(rows,f.makeCandidates());assert.equal(new Set(rows.map(r=>r.id)).size,5000)
  assert.deepEqual([run.initial,...run.stages.map(s=>s.remaining)],[5000,1764,1023,880,255]);assert.equal(run.cost,15117)
  let previous=new Set(rows.map(r=>r.id));let expectedCost=0
  for(const stage of run.stages){assert.equal(stage.input-stage.rejected,stage.remaining);assert.equal(stage.input,previous.size);assert.ok(stage.ids.every(id=>previous.has(id)));assert.ok(stage.rejectedIds.every(id=>previous.has(id)&&!stage.ids.includes(id)));assert.equal(new Set([...stage.ids,...stage.rejectedIds]).size,stage.input);expectedCost+=stage.input*f.GATES[stage.gate].cost;assert.equal(stage.cumulativeCost,expectedCost);previous=new Set(stage.ids)}
})
test('24 fixed predicate permutations preserve the exact final set, not just its size',()=>{
  const ranked=f.rankedOrders(rows);assert.equal(ranked.length,24);assert.equal(new Set(ranked.map(r=>r.order.join(','))).size,24)
  for(const r of ranked)assert.deepEqual(r.survivors.map(r=>r.id),run.survivors.map(r=>r.id))
  assert.equal(ranked[0].cost,13487);assert.deepEqual(ranked[0].order,['lip','sol','tox','sim']);assert.ok(run.cost>ranked[0].cost)
})
test('tightening one threshold yields a subset; equality is a pass',()=>{
  let previous=[];for(let i=0;i<=10;i++){const out=f.runFunnel(rows,f.DEFAULT_ORDER,i/10).survivors.map(r=>r.id);assert.ok(previous.every(id=>out.includes(id)));previous=out}
  const boundary={id:'edge',mw:500,logp:5,hbd:5,hba:10,logS:-4,similarity:.85,toxScore:.3};assert.equal(f.runFunnel([boundary]).survivors.length,1)
  for(const g of f.DEFAULT_ORDER)assert.equal(f.passesGate(boundary,g),true)
})
test('empty library, no rules, invalid limits and data are handled explicitly',()=>{
  assert.equal(f.runFunnel([]).cost,0);assert.ok(f.runFunnel([]).stages.every(s=>s.input===0&&s.remaining===0));assert.equal(f.runFunnel(rows,[]).survivors.length,5000)
  assert.throws(()=>f.runFunnel(rows,['lip','lip']));assert.throws(()=>f.runFunnel(rows,['absent']));assert.throws(()=>f.runFunnel(rows,f.DEFAULT_ORDER,NaN));assert.throws(()=>f.runFunnel([{...rows[0],mw:NaN}]));assert.throws(()=>f.runFunnel([rows[0],rows[0]]))
})
test('four compact coordinate objects have valid atom/bond indices and provenance',()=>{
  assert.equal(s.MOLECULES.length,4);assert.ok(fs.statSync(path.join(lib,'data/m03-molecules.json')).size<300000)
  for(const m of s.MOLECULES){assert.ok(m.sourceUrl.startsWith('https://pubchem.ncbi.nlm.nih.gov/compound/'));assert.equal(m.atoms.length,m.totalAtoms);assert.equal(m.atoms.filter(a=>a.element!=='H').length,m.heavyAtoms);const raw=fs.readFileSync(path.join(fixtures,'M03-sources',m.id+'.sdf'));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),m.sdfSha256);for(const a of m.atoms){assert.equal(m.atoms[a.id],a);assert.equal(a.position.length,3);assert.ok(a.position.every(Number.isFinite))}for(const b of m.bonds){assert.ok(m.atoms[b.a]&&m.atoms[b.b]);const d=s.distance(m.atoms[b.a].position,m.atoms[b.b].position);assert.ok(d>.7&&d<1.7)}}
})
test('geometry distinguishes methane tetrahedral, water bent and benzene planar',()=>{
  const find=id=>s.MOLECULES.find(m=>m.id===id)
  assert.ok(Math.abs(s.centerBondAngle(find('methane'))-109.47)<.05)
  const water=s.centerBondAngle(find('water'));assert.ok(water>103&&water<106)
  assert.ok(s.planeDeviation(find('benzene'))<.002);assert.ok(s.planeDeviation(find('methane'))>.5)
  assert.throws(()=>s.angleDegrees([0,0,0],[0,0,0],[1,0,0]))
})
test('hydrogen visibility changes display counts, never molecular identity or mass',()=>{
  for(const m of s.MOLECULES){const before=JSON.stringify(m),all=s.moleculeCounts(m),hidden=s.moleculeCounts(m,false);assert.equal(hidden.atoms,m.heavyAtoms);assert.equal(all.atoms,m.totalAtoms);assert.equal(all.hydrogens,all.atoms-hidden.atoms);assert.equal(hidden.rings,all.rings);assert.equal(JSON.stringify(m),before)}
  assert.deepEqual(s.moleculeCounts(s.MOLECULES.find(m=>m.id==='ethanol')),{atoms:9,bonds:8,hydrogens:6,heavy:3,rings:0,aromaticRings:0})
})
test('RDKit independently validates every SDF graph and all explicit-H structural depictions',async()=>{
  const vendor=path.resolve(__dirname,'../public/vendor/rdkit'),rdkit=await require(path.join(vendor,'RDKit_minimal.js'))({locateFile:f=>path.join(vendor,f)})
  for(const m of s.MOLECULES){const original=rdkit.get_mol(m.smiles),sdf=rdkit.get_mol(fs.readFileSync(path.join(fixtures,'M03-sources',m.id+'.sdf'),'utf8')),expanded=rdkit.get_mol(original.add_hs());try{sdf.remove_hs_in_place();assert.equal(sdf.get_smiles(),original.get_smiles());const d=JSON.parse(original.get_descriptors());assert.equal(d.NumAtoms,m.totalAtoms);assert.equal(d.NumHeavyAtoms,m.heavyAtoms);assert.equal(d.NumRings,m.rings);assert.equal(d.NumAromaticRings,m.aromaticRings);assert.ok(Math.abs(d.amw-m.mw)<1e-7);expanded.set_new_coords();assert.ok(expanded.get_svg().includes('<svg'));const graph=JSON.parse(expanded.get_json()).molecules[0];assert.equal(graph.atoms.length,m.totalAtoms);assert.equal(graph.bonds.length,m.bonds.length)}finally{original.delete();sdf.delete();expanded.delete()}}
})
test('20 source-aligned mappings, no old audio, all source hashes unchanged',()=>{
  for(const [n,v] of [['M03','spatial-v1'],['M86','funnel-v1']]){const draft=JSON.parse(fs.readFileSync(path.join(fixtures,`${n}-${v}.json`))),registry=JSON.parse(fs.readFileSync(path.join(fixtures,`${n}-${v}.registry.json`))),source=JSON.parse(fs.readFileSync(path.join(fixtures,`${n}-before-${v}/slides.json`)));assert.equal(draft.slides.length,10);assert.equal(new Set(draft.slides.map(s=>s.payload.technical_visual.scene)).size,10);assert.deepEqual(draft.slides.map(s=>s.slide_id),source.slides.map((s,i)=>s.slide_id||`${n}-slide-${i+1}`));for(const slide of draft.slides){assert.equal(slide.audio_path,null);assert.ok(slide.audio_script.length>70);assert.deepEqual(Object.keys(slide.payload),['technical_visual'])}for(const [name,hash] of Object.entries(registry.source_sha256)){const file=path.join(fixtures,`${n}-before-${v}`,name);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash)}}
})
test('all new equation templates are valid KaTeX / mhchem, without escaped control characters',()=>{
  const katex=require('katex');require('katex/contrib/mhchem');let count=0
  for(const file of ['molecule-skeleton-visual.tsx','funnel-evidence-visual.tsx']){const name=path.resolve(__dirname,'../src/components/learning',file),ast=ts.createSourceFile(name,fs.readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='source'){const e=n.initializer.expression,raw=ts.isTaggedTemplateExpression(e),t=raw?e.template:e;let value;if(ts.isNoSubstitutionTemplateLiteral(t))value=raw?t.rawText:t.text;else if(ts.isTemplateExpression(t)){const first=raw?t.head.rawText:t.head.text,placeholder=first.includes('\\ce{')?'CH4':'1';value=first+t.templateSpans.map(s=>placeholder+(raw?s.literal.rawText:s.literal.text)).join('')}else return;assert.ok(!/[\t\r]/.test(value));assert.ok(katex.renderToString(value,{throwOnError:true,output:'htmlAndMathml'}).includes('<math'));count++}ts.forEachChild(n,visit)}visit(ast)}assert.ok(count>=12)
})
