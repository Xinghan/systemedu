const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const test=require('node:test')
const ts=require('typescript')
const src=fs.readFileSync(path.join(__dirname,'../src/lib/tendon-torque.ts'),'utf8')
const loaded={exports:{}}
new Function('exports','require','module',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(loaded.exports,require,loaded)
const {torqueNm,torqueBudget,assessStall,KGFCM_TO_NM}=loaded.exports
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`)
test('torque SI units, radius/force linearity and angle limits',()=>{
  close(torqueNm(10,1),.1);close(torqueNm(10,2),.2);close(torqueNm(20,1),.2)
  close(torqueNm(10,1,0),0);close(torqueNm(10,1,30),.05);close(torqueNm(10,1,90),.1)
  for(let a=0;a<=180;a++)close(torqueNm(10,2,a),torqueNm(10,2,180-a))
})
test('five finger budget and design margin',()=>{
  assert.deepEqual(torqueBudget(10,1,5,1.5),{single:.1,total:.5,required:.75})
  close(torqueBudget(10,1,5,2).required,1)
})
test('stall value cannot certify sustained output',()=>{
  close(9*KGFCM_TO_NM,.8825985)
  assert.equal(assessStall(.75,9),'unknown')
  assert.equal(assessStall(1,9),'insufficient')
  assert.equal(assessStall(9*KGFCM_TO_NM,9),'insufficient')
})
test('invalid models fail closed',()=>{
  for(const a of [[-1,1,90],[10,-1,90],[NaN,1,90],[10,1,190]])assert.throws(()=>torqueNm(...a))
  assert.throws(()=>torqueBudget(10,1,0,1.5));assert.throws(()=>torqueBudget(10,1,5,.5))
})
test('draft maps all 12 pages, generated image exists, no stale audio',()=>{
  const root=path.resolve(__dirname,'../../..')
  const draft=JSON.parse(fs.readFileSync(path.join(root,'course_factory/fixtures/emg-prosthetic-hand/M42-multimodal-v1.json')))
  assert.equal(draft.slides.length,12)
  assert.equal(new Set(draft.slides.map(s=>s.payload.technical_visual.scene)).size,12)
  for(const s of draft.slides)assert.equal(s.audio_path,null)
  assert.equal(draft.slides[2].payload.images[0].src,'images/finger-states-v1.webp')
  assert.ok(fs.statSync(path.resolve(__dirname,'../public/slide-demo/emg-m42-v1/finger-states.webp')).size<300000)
})
test('static TeX in actual JSX compiles and produces valid KaTeX',()=>{
  const p=path.join(__dirname,'../src/components/learning/tendon-torque-visual.tsx')
  const ast=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let count=0
  function visit(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='source'&&n.initializer&&ts.isJsxExpression(n.initializer)&&ts.isStringLiteral(n.initializer.expression)){
    const source=n.initializer.expression.text
    assert.ok(!source.includes('\\\\'),'doubled TeX command backslash')
    require('katex').renderToString(source,{throwOnError:true});count++
  }ts.forEachChild(n,visit)}visit(ast);assert.ok(count>=4)
})
test('interpolated TeX uses raw templates so tau/times are not JS escapes',()=>{
  const p=path.join(__dirname,'../src/components/learning/tendon-torque-visual.tsx')
  const ast=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let count=0
  function visit(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='source'&&n.initializer&&ts.isJsxExpression(n.initializer)){
    const e=n.initializer.expression
    assert.ok(!ts.isTemplateExpression(e),'interpolated TeX must use String.raw')
    if(ts.isTaggedTemplateExpression(e)){assert.equal(e.tag.getText(ast),'String.raw');assert.ok(e.template.head.rawText.includes('\\tau'));count++}
  }ts.forEachChild(n,visit)}visit(ast);assert.equal(count,2)
})
