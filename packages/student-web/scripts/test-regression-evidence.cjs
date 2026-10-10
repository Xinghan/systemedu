const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/lib/regression-evidence.ts'), 'utf8')
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const loaded = {exports:{}}
new Function('exports','require','module',compiled)(loaded.exports, require, loaded)
const {regressionEvidence: evidence, withPrediction, answerMatches, formatRegression: fmt} = loaded.exports
const rows = [ ['A',8.2,8], ['B',5,5.5], ['C',7,7], ['D',6,3], ['E',4,4.2] ].map(([id,actual,predicted])=>({id,actual,predicted}))

test('assignment table gives exact evidence sums and metrics',()=>{
  const m=evidence(rows)
  assert.deepEqual(m.rows.map(r=>fmt(r.error)),['-0.2','0.5','0','-3','0.2'])
  assert.equal(fmt(m.sumAbsolute),'3.9'); assert.equal(fmt(m.sumSquared),'9.33')
  assert.equal(fmt(m.mae),'0.78'); assert.equal(fmt(m.rmse),'1.366'); assert.equal(m.largest.id,'D')
})
test('prediction sweep preserves truth and nonedited rows; RMSE >= MAE',()=>{
  for(let k=0;k<=100;k++){
    const changed=withPrediction(rows,'D',k/10), m=evidence(changed)
    assert.deepEqual(changed.map(r=>r.actual),rows.map(r=>r.actual))
    assert.deepEqual(changed.filter(r=>r.id!=='D'),rows.filter(r=>r.id!=='D'))
    assert.ok(m.rmse+1e-12>=m.mae)
    assert.equal(fmt(evidence(rows).rmse),'1.366')
  }
})
test('cancellation and equal large errors disprove misleading summaries',()=>{
  const cancel=evidence([{id:'p',actual:5,predicted:7},{id:'n',actual:5,predicted:3}])
  assert.equal(cancel.meanError,0); assert.equal(cancel.mae,2); assert.equal(cancel.rmse,2)
  const large=evidence(rows.map(r=>({...r,predicted:r.actual+3})))
  assert.ok(Math.abs(large.mae-3)<1e-12); assert.ok(Math.abs(large.rmse-3)<1e-12)
})
test('answers require a finite, nonempty number and accept specified rounding',()=>{
  assert.equal(answerMatches('',0),false); assert.equal(answerMatches('NaN',0),false)
  assert.equal(answerMatches('-0.2',-0.2),true); assert.equal(answerMatches('1.37',evidence(rows).rmse),true)
  assert.equal(answerMatches('0.5',-0.5),false); assert.equal(answerMatches('Infinity',1),false)
})
test('invalid samples fail closed',()=>{
  assert.throws(()=>evidence([])); assert.throws(()=>evidence([{id:'x',actual:NaN,predicted:0}]))
  assert.throws(()=>evidence([rows[0],rows[0]])); assert.throws(()=>withPrediction(rows,'Z',2))
})
test('TeX commands use JavaScript expressions, not raw JSX string attributes',()=>{
  const filename=path.join(__dirname, '../src/components/learning/regression-evidence-visual.tsx')
  const ast=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  function visit(node){
    if(ts.isJsxAttribute(node)&&node.name.getText(ast)==='latex'&&node.initializer&&ts.isStringLiteral(node.initializer)){
      assert.ok(!node.initializer.text.includes('\\'), 'TeX backslashes must be in a JavaScript expression to avoid double escaping')
    }
    ts.forEachChild(node,visit)
  }
  visit(ast)
})
