const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/lib/classification-evidence.ts'), 'utf8')
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
const loaded = {exports:{}}
new Function('exports', 'require', 'module', compiled)(loaded.exports, require, loaded)
const {classificationCounts: count, percent} = loaded.exports

test('source example is 98%, not the old 95%', () => {
  const c = count(100, 3, 2, 1)
  assert.equal(c.tn, 96); assert.equal(c.fn, 1)
  assert.equal(percent(c.accuracy), '98%')
  assert.equal(percent(c.recall), '66.7%')
  assert.equal(percent(c.precision), '66.7%')
  assert.equal(percent(count(100, 3, 2, 4).accuracy), '95%')
})
test('negative-only baseline has zero recall at every shown prevalence', () => {
  for (const p of [3,10,50]) {
    const c = count(100,p,0,0)
    assert.equal(c.accuracy,(100-p)/100)
    assert.equal(c.recall,0)
    assert.equal(c.precision,null)
  }
})
test('every reachable M80 matrix conserves both truth classes and total', () => {
  for(let tp=0;tp<=3;tp++) for(let fp=0;fp<=97;fp++) {
    const c=count(100,3,tp,fp)
    assert.equal(c.tp+c.fn,3)
    assert.equal(c.tn+c.fp,97)
    assert.equal(c.tp+c.fn+c.fp+c.tn,100)
    assert.ok(c.accuracy>=0&&c.accuracy<=1)
    assert.ok(c.recall>=0&&c.recall<=1)
  }
})
test('invalid counts fail closed; no AUC is invented', () => {
  for (const args of [[100,3,4,0],[100,3,1,98],[100,0,0,0],[100,3,-1,0],[100,3,1.5,0]]) assert.throws(()=>count(...args))
  assert.equal('auc' in count(100,3,2,1),false)
})
