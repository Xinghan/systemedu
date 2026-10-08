const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../src'), cache = {}
function load(file) {
  if (cache[file]) return cache[file]
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('exports', 'require', 'module', code)(m.exports, n => {
    if (n.endsWith('.css')) return {}
    if (n === '@/lib/rdkit') return { drawSmilesSvg: () => Promise.resolve('') }
    if (n === 'next/image') return p => React.createElement('img', { src: p.src, alt: p.alt })
    if (n.startsWith('@/') || n.startsWith('.')) {
      const base = n.startsWith('@/') ? n.slice(2) : path.join(path.dirname(file), n)
      if (n.endsWith('.json')) return JSON.parse(fs.readFileSync(path.join(root, base),'utf8'))
      const target = ['.ts', '.tsx'].map(ext => base + ext).find(p => fs.existsSync(path.join(root, p)))
      if (target) return load(target)
    }
    return require(n)
  }, m)
  return cache[file] = m.exports
}
const markup = (C, visual) => renderToStaticMarkup(React.createElement(C, { visual }))
const noActions = html => assert.doesNotMatch(html, /<(button|input|select|textarea|form)\b|contenteditable=|download=/i)
test('M05: nine read-only scenes expose complete structure evidence, preset 3D and full trace', () => {
  const {SmilesReadingReadonly}=load('components/learning/smiles-reading-readonly.tsx')
  for(const scene of ['overview','equivalence','tokens','hydrogens','syntax','validation','trace','workbench','handoff']) {
    const html=markup(SmilesReadingReadonly,{renderer:'smiles-reading',scene})
    noActions(html);assert.match(html,/data-presentation="readonly"/);assert.doesNotMatch(html,/data-formula-error/)
    if(scene==='equivalence')assert.equal((html.match(/data-equivalence-row=/g)||[]).length,3)
    if(scene==='tokens')assert.match(html,/NH/)
    if(scene==='hydrogens'){assert.match(html,/data-readonly-3d="true"/);assert.match(html,/始终为 9/)}
    if(scene==='syntax')assert.equal((html.match(/data-syntax-pair=/g)||[]).length,4)
    if(scene==='validation')assert.equal((html.match(/data-validation-row=/g)||[]).length,3)
    if(scene==='trace')assert.equal((html.match(/data-smiles-trace=/g)||[]).length,10)
    if(scene==='workbench'){assert.match(html,/构造的纠错示例/);assert.match(html,/不是你的运行记录/)}
  }
  const src=fs.readFileSync(path.join(root,'components/learning/smiles-reading-readonly.tsx'),'utf8')
  assert.doesNotMatch(src,/localStorage|sessionStorage|onClick|onChange|useSaved|downloadEvidence/)
})
test('M04: nine complete read-only scenes retain 3D, imagery, exact values and automatic trace', () => {
  const { FunctionalGroupReadonly } = load('components/learning/functional-group-readonly.tsx')
  for (const scene of ['overview','route','groups','controls','phases','trace','lab','record','handoff']) {
    const html = markup(FunctionalGroupReadonly, {renderer:'functional-group',scene})
    noActions(html); assert.match(html,/data-presentation="readonly"/)
    assert.doesNotMatch(html,/data-formula-error/)
    if(scene==='groups') { assert.match(html,/data-readonly-3d="true"/); assert.match(html,/C–O–H/); }
    if(scene==='phases') assert.match(html,/phase-comparison-v1.webp/)
    if(scene==='trace') { assert.equal((html.match(/data-comparison-step=/g)||[]).length,4); assert.match(html,/-1.0276/); }
    if(scene==='lab') assert.equal((html.match(/data-comparison-row=/g)||[]).length,4)
    if(scene==='record') {assert.match(html,/参考/); assert.match(html,/不是你的运行记录/);}
  }
  const src=fs.readFileSync(path.join(root,'components/learning/functional-group-readonly.tsx'),'utf8')
  assert.doesNotMatch(src,/localStorage|sessionStorage|downloadEvidence|onClick|onChange|useSaved/)
  assert.match(src,/observationPlane=\{\[carbon.id,oxygen.id,hydrogen.id\]\}/)
  assert.match(src,/\['reset','face','oblique'\]/)
})
test('M05 fixed structure references match RDKit and distinguish parsing from target matching', async () => {
  const {computeSmilesEvidence,sameSmilesEvidence,validSmilesRow,SMILES_TRACE}=load('lib/smiles-readonly.ts')
  const rdkit=await require('@rdkit/rdkit')(), rows=computeSmilesEvidence(rdkit)
  assert.equal(Object.keys(rows).length,19); assert.equal(sameSmilesEvidence(rows),true)
  assert.equal(rows.C1CC.parsed,false)
  assert.throws(()=>validSmilesRow(rows,'C1CC'))
  assert.equal(rows.CCO.canonical,rows.OCC.canonical)
  assert.notEqual(rows.CCO.canonical,rows.COC.canonical)
  assert.equal(rows.CCO.hydrogens,6)
  assert.deepEqual(rows['[NH4+]'].atoms,[{element:'N',hydrogens:4,charge:1}])
  assert.equal(rows.ClC.heavy,2)
  assert.equal(sameSmilesEvidence({...rows,CCO:{...rows.CCO,mw:NaN}}),false)
  assert.equal(sameSmilesEvidence({...rows,C1CC:{...rows.CCO,input:'C1CC'}}),false)
  assert.equal(SMILES_TRACE.length,10)
  assert.equal(SMILES_TRACE[3].heavy,SMILES_TRACE[2].heavy)
  assert.equal(SMILES_TRACE[9].heavy,SMILES_TRACE[8].heavy)
  assert.equal(SMILES_TRACE[9].bonds,SMILES_TRACE[8].bonds+1)
  assert.deepEqual([SMILES_TRACE[9].heavy,SMILES_TRACE[9].bonds,SMILES_TRACE[9].rings],[7,7,1])
})
test('M04 fixed references match actual RDKit; wrong order or nonfinite values cannot claim verification', async () => {
  const {GROUP_REFERENCES,groupReferenceMatches}=load('lib/functional-group-readonly.ts')
  const rdkit=await require('@rdkit/rdkit')()
  const rows=GROUP_REFERENCES.map(r=>{
    const mol=rdkit.get_mol(r.smiles)
    try { const d=JSON.parse(mol.get_descriptors()); return {smiles:r.smiles,logP:d.CrippenClogP,mw:d.amw} }
    finally {mol.delete()}
  })
  assert.equal(groupReferenceMatches(rows),true)
  assert.equal(groupReferenceMatches(rows.toReversed()),false)
  assert.equal(groupReferenceMatches(rows.map((r,i)=>i===0?{...r,logP:NaN}:r)),false)
  assert.equal(groupReferenceMatches(rows.slice(0,2)),false)
  assert.ok(Math.abs(rows[1].logP-rows[0].logP+1.0276)<1e-10)
})
test('M01: all eight lecture scenes expose evidence without controls or saved-work dependency', () => {
  const { DiscoveryBriefReadonly } = load('components/learning/discovery-brief-readonly.tsx')
  for (const scene of load('lib/discovery-brief.ts').DISCOVERY_SCENES) {
    const html = markup(DiscoveryBriefReadonly, { renderer: 'discovery-brief', scene })
    noActions(html)
    assert.match(html, /data-presentation="readonly"/)
    assert.match(html, /<(table|dl|ol|figure)[ >]/)
    assert.match(html, /构造教学数据/)
  }
  const brief = markup(DiscoveryBriefReadonly, { renderer: 'discovery-brief', scene: 'brief' })
  assert.match(brief, /示例立项卡/); assert.match(brief, /不是你的提交/)
  const budget = markup(DiscoveryBriefReadonly, { renderer: 'discovery-brief', scene: 'budget' })
  assert.match(budget, /A → B → C → D → E/); assert.match(budget, /F–L/)
})
test('M02 and M03 lecture pages are read-only with complete evidence', () => {
  const { RdkitRuntimeReadonly } = load('components/learning/rdkit-runtime-readonly.tsx')
  const { SkeletonReadonly } = load('components/learning/skeleton-readonly.tsx')
  for (const scene of load('lib/rdkit-runtime.ts').RUNTIME_SCENES) {
    const html = markup(RdkitRuntimeReadonly,{renderer:'rdkit-runtime',scene})
    noActions(html); assert.match(html,/data-presentation="readonly"/)
    assert.match(html,/<(table|dl|ol|pre)[ >]/)
    if (scene === 'trace') assert.equal((html.match(/data-runtime-trace=/g)||[]).length,7)
  }
  for (const scene of ['overview','vocabulary','mass','bonds','skeleton','aromatic','scan','lab','report','handoff']) {
    const html = markup(SkeletonReadonly,{renderer:'molecule-skeleton-evidence',scene})
    noActions(html); assert.match(html,/data-presentation="readonly"/)
    assert.doesNotMatch(html,/data-formula-error/)
    if (['overview','vocabulary','aromatic','scan'].includes(scene)) assert.match(html,/data-readonly-3d="true"/)
    if (scene === 'scan') assert.equal((html.match(/data-atom-row=/g)||[]).length,9)
    if (scene === 'vocabulary') {
      assert.equal((html.match(/data-atom-row=/g)||[]).length,3)
      assert.match(html,/定位 C2/)
    }
  }
})
test('readonly 3D mode removes camera controls, while existing activity mode stays available', () => {
  const { MolecularObject3D } = load('components/learning/molecular-object-3d.tsx')
  const molecule = load('lib/molecule-skeleton.ts').MOLECULES[0]
  const html = renderToStaticMarkup(React.createElement(MolecularObject3D,{molecule,showH:true,selected:null,readOnly:true,presetView:'face'}))
  noActions(html); assert.doesNotMatch(html,/拖动旋转|点选原子/)
  const activity = renderToStaticMarkup(React.createElement(MolecularObject3D,{molecule,showH:true,selected:null,onSelect(){}}))
  assert.match(activity,/<button\b/)
})
test('M08: every original state remains readable without any action', () => {
  const { PythonVariableVisual } = load('components/learning/python-variable-visual.tsx')
  const slides = JSON.parse(fs.readFileSync(path.resolve(root, '../../../course_factory/fixtures/molecule-monster-hunter/M08-readonly-v1.json'))).slides
  for (const slide of slides) {
    const visual = slide.payload.technical_visual, html = markup(PythonVariableVisual, visual)
    noActions(html)
    assert.equal((html.match(/data-trace-row=/g) || []).length, visual.steps.length)
    assert.match(html, /完整执行轨迹/)
  }
})
test('all six local candidate nodes match exact fixture bytes and preserve historical slide identity', () => {
  const { currentCourse } = require('./course-source-roots.cjs')
  for (const id of ['M01','M02','M03','M04','M05','M08']) {
    const candidate = JSON.parse(fs.readFileSync(path.resolve(root, '../../../course_factory/fixtures/molecule-monster-hunter',id+'-readonly-v1.json')))
    const node = fs.readdirSync(path.join(currentCourse, 'knodes')).find(n=>n.startsWith(id+'-'))
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(currentCourse,'knodes',node,'slides.json'))),candidate)
    const batch = id==='M05' ? 'readonly-m05-20260915' : id==='M04' ? 'readonly-m04-20260914' : ['M02','M03'].includes(id) ? 'readonly-m02-m03-20260914' : 'readonly-slides-20260914'
    const old = JSON.parse(fs.readFileSync(path.resolve(root,'../../../artifacts',batch,id,'slides.json')))
    assert.deepEqual(candidate.slides.map(s=>[s.slide_id,s.kind,s.lesson_anchor]),old.slides.map(s=>[s.slide_id,s.kind,s.lesson_anchor]))
    assert.ok(candidate.slides.every(s=>s.audio_path===null))
    assert.doesNotMatch(candidate.slides.map(s=>s.audio_script).join('\n'),/点击|拖动|保存到本机|下载本页/)
    if(['M04','M05'].includes(id)) {
      const scripts=JSON.parse(fs.readFileSync(path.join(currentCourse,'knodes',node,'audio_scripts.json')))
      assert.deepEqual(scripts,candidate.slides.map(s=>({section_title:s.title,audio_script:s.audio_script})))
      for(const name of ['lesson.md','assignment.md','theories.json','sections.json']) {
        const copy=fs.readFileSync(path.join(currentCourse,'knodes',node,name),'utf8')
        assert.doesNotMatch(copy,/保存并下载个人对照记录|可操作的模型、状态变化和个人记录|交互位于老师讲课/)
      }
    }
  }
})
