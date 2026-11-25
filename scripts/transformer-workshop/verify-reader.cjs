const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('../../packages/student-web/node_modules/typescript')
const katex = require('../../packages/student-web/node_modules/katex')
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, file)

const dir = path.resolve(__dirname, '../../packages/student-web/src/app/standalone/transformer-lab')
const { defaults, pocketForward, traceStages } = require(path.join(dir, 'pocket-model.ts'))
const { lessons, sources } = require(path.join(dir, 'reader-lessons.ts'))
const { softmax } = require(path.join(dir, 'math.ts'))
const { TOPICS } = require(path.join(dir, 'model-content.ts'))
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a-b) < tolerance, a+' differs from '+b)

const ids = new Set(lessons.map(l => l.id))
assert.equal(ids.size, lessons.length)
for (const l of lessons) {
  assert.ok(TOPICS.some(t => t.id === l.part))
  assert.ok(traceStages.some(([key]) => key === l.stage))
  assert.ok(l.sources.every(key => key in sources))
  assert.ok(l.ask.length >= 2 && l.check.options[l.check.answer])
  const terms = l.sections.filter(s => s.concept).map(s => s.concept)
  assert.ok(terms.length, 'Missing concept text in '+l.id)
  assert.equal(new Set(terms.map(t=>t.id)).size,terms.length, 'Duplicate anchor in '+l.id)
  assert.ok(terms.every(t=>/^[a-z0-9-]+$/.test(t.id) && t.name.trim()))
  for (const s of l.sections.filter(s => s.equation)) {
    katex.renderToString(s.equation, { throwOnError:true })
    assert.ok(s.read)
  }
}

for (const row of [[0,1],[1000,1001]]) {
  const probabilities = softmax(row)
  close(probabilities[0],0.269,0.0005)
  close(probabilities[1],0.731,0.0005)
}
close(softmax([0,Math.log(2),-Infinity])[1],2/3)
const worked = pocketForward(defaults)
for (const [name,col,expected] of [
  ['scores',0,1.124], ['scores',1,-0.298], ['weights',0,0.806], ['weights',1,0.194],
  ['context',0,0.955], ['context',1,-1.207], ['u',1,1.5], ['u',2,-2.207], ['prob',2,0.057],
]) close(worked[name][1][col],expected,0.00051)

for (let first=0; first<3; first++) for (let middle=0; middle<3; middle++) {
  for (const scaled of [true,false]) for (const position of [true,false]) for (const nonlinear of [true,false]) {
    let previous
    for (let last=0; last<3; last++) {
      const result = pocketForward({...defaults,tokens:[first,middle,last],position,scaled,nonlinear})
      for (const name of ['weights','prob']) for (const row of result[name]) {
        close(row.reduce((a,b)=>a+b,0),1)
        assert.ok(row.every(x=>Number.isFinite(x) && x>=0 && x<=1))
      }
      if (previous) assert.deepEqual(result.logits.slice(0,2),previous.logits.slice(0,2))
      assert.equal(result.weights[1][2],0)
      assert.equal(result.weights[0][0],1)
      previous=result
    }
  }
}
const open = pocketForward({...defaults,causal:false})
assert.ok(open.weights[1][2]>0)
assert.notDeepEqual(open.logits[1],worked.logits[1])
assert.notDeepEqual(worked.logits[1],pocketForward({...defaults,tokens:[2,1,2]}).logits[1])

const { cellSteps, matrixExample, productGrid, scoreRow, sliceGrid, vocabRow } = require(path.join(dir, 'matrix-walkthrough.ts'))
const practice = matrixExample('product', defaults)
assert.deepEqual(productGrid(practice), [[-3, 7], [3, 14]])
assert.deepEqual(productGrid(matrixExample('product', defaults, true)), [[-1, 7], [6, 14]])
assert.deepEqual(sliceGrid(practice, 1), [[-2, 8], [-3, 12]])
assert.deepEqual(cellSteps(practice, 0, 0).map(step => step.total), [2, 0, -3])
for (const [i, row] of productGrid(practice).entries()) {
  for (const [j, value] of row.entries()) {
    assert.equal(practice.shared.reduce((sum, _, r) => sum + sliceGrid(practice, r)[i][j], 0), value)
  }
}
const handVocab = matrixExample('dense', defaults)
const handResult = vocabRow(productGrid(handVocab)[0], handVocab.bias)
assert.deepEqual(handResult.logits, [1, 0, 0])
close(handResult.prob[2], 1 / (Math.E + 2))
for (const settings of [defaults, {...defaults, causal: false, scaled: false, position: false, nonlinear: false, tokens: [2, 2, 0], fishBias: -2.5}]) {
  const forward = pocketForward(settings)
  for (const [mode, stage] of [['query','q'], ['key','k'], ['value','v'], ['context','context'], ['hidden','hidden']]) {
    const result = productGrid(matrixExample(mode, settings))
    result.forEach((row, i) => row.forEach((value, j) => close(value, forward[stage][i][j])))
  }
  const back = productGrid(matrixExample('back', settings))
  back.forEach((row, i) => row.forEach((value, j) => close(value + forward.u[i][j], forward.y[i][j])))
  const score = matrixExample('scores', settings)
  productGrid(score).forEach((raw, i) => {
    const scores = scoreRow(raw, i, settings, score.shared.length)
    assert.deepEqual(scores, forward.scores[i])
    assert.deepEqual(softmax(scores), forward.weights[i])
  })
  const readout = matrixExample('readout', settings)
  productGrid(readout).forEach((raw, i) => {
    const prediction = vocabRow(raw, readout.bias)
    assert.deepEqual(prediction.logits, forward.logits[i])
    assert.deepEqual(prediction.prob, forward.prob[i])
  })
}
const loss = b => -Math.log(pocketForward({...defaults,fishBias:b}).prob[1][2])
for (const bias of [-3,0,3]) {
  const analytical = pocketForward({...defaults,fishBias:bias}).prob[1][2]-1
  close((loss(bias+1e-5)-loss(bias-1e-5))/2e-5,analytical)
  assert.ok(loss(bias-0.5*analytical)<loss(bias))
}
console.log('Verified lesson links and formulas, printed hand calculations, all 27 token sequences across 8 configurations, future-token perturbations and finite-difference gradients.')
