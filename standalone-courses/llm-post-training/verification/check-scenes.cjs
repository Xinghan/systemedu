// Render production SVG scenes, including intermediate times and parameter extremes.
// Run from the repository root: node standalone-courses/llm-post-training/verification/check-scenes.cjs
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../../..'), web = path.join(root, 'packages/student-web')
const ts = require(path.join(web, 'node_modules/typescript'))
const React = require(path.join(web, 'node_modules/react'))
const { renderToStaticMarkup } = require(path.join(web, 'node_modules/react-dom/server'))
const src = path.join(web, 'src/app/standalone/post-training')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'posttraining-scenes-'))
try {
  fs.symlinkSync(path.join(web, 'node_modules'), path.join(out, 'node_modules'), 'dir')
  fs.mkdirSync(path.join(out, 'scenes'))
  const files = ['algorithm-math.ts', 'algorithm-catalog.ts', 'record.ts', ...fs.readdirSync(path.join(src, 'scenes')).map(x => 'scenes/' + x)]
  for (const file of files) {
    const { outputText } = ts.transpileModule(fs.readFileSync(path.join(src, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, fileName: file
    })
    fs.writeFileSync(path.join(out, file.replace(/\.tsx?$/, '.js')), outputText)
  }
  const { ALGORITHMS, settings } = require(path.join(out, 'algorithm-catalog'))
  const { SCENES, AlgorithmScene, inspect } = require(path.join(out, 'scenes'))
  const records = require(path.join(out, 'record'))
  assert.deepEqual(Object.keys(SCENES).sort(), Object.keys(ALGORITHMS).sort())
  const noAction = () => {}, props = { focus: '', onPick: noAction, onHover: noAction, setValue: noAction, yaw: 35, pitch: 25 }
  let rendered = 0, inspections = 0
  for (const [id, spec] of Object.entries(ALGORITHMS)) {
    const defaults = settings(id), configs = [defaults]
    if (id === 'preference') configs.push({ ...defaults, margin: 4, reference: -4, beta: 2 }, { ...defaults, margin: -4, reference: 4, beta: 2 })
    if (id === 'lora') configs.push({ rank: 2, alpha: 4, x: 2 })
    for (const c of spec.controls) for (const value of [c.min, c.max]) configs.push({ ...defaults, [c.key]: value })
    for (const v of configs) {
      const last = spec.frames(v).length - 1
      for (let time = 0; time <= last; time += .5) for (const geometry of id === 'lora' ? [false, true] : [false]) {
        const html = renderToStaticMarkup(React.createElement('svg', null, React.createElement(AlgorithmScene, { ...props, id, v, time, geometry })))
        rendered++
        assert.ok(!/NaN|undefined|Infinity/.test(html), `${id}: invalid rendered value`)
        assert.ok(html.includes('role="button"'), `${id}: no inspectable elements`)
        for (const focus of [...html.matchAll(/data-pick="([^"]+)"/g)].map(m => m[1]).concat(['', 'basis:99', 'attention:99:99', 'code:99', 'weight:99', 'pair:99'])) {
          const detail = inspect(id, v, focus, time)
          inspections++
          assert.ok(detail.title && detail.expression && detail.explanation)
          assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(detail)), `${id}/${focus}: invalid inspection`)
        }
      }
    }
  }
  // Inspectors must explain the same numerical operation as the scene.
  assert.match(inspect('lora', { rank: 2, alpha: 2, x: -1 }, 'B:1:1', 2).expression, /= 3$/)
  assert.match(inspect('nf4', settings('nf4'), 'weight:4', 2).expression, /0\.161/)
  assert.match(inspect('attention', settings('attention'), 'attention:2:3', 1).expression, /probability 0/)
  const softmaxFinal = inspect('softmax', settings('softmax'), 'loss', 4)
  assert.match(softmaxFinal.expression, /0\.947/) // CE after one gradient update, not stale CE before update.
  const old = records.freshRecord(); old.nodes.M03.notes = 'Preserved note'; old.nodes.M03.slide = 3; old.lab.rank = 16
  assert.ok(records.isRecord(old))
  const current = { ...old, experiments: { lora: { step: 1, values: { rank: 2, alpha: 2, x: -1 }, view: { time: 1.37, focus: 'B:1:1', mode: 'geometry' } } } }
  assert.ok(records.isRecord(current))
  const data = new Map([[`${records.COURSE_ID}:${records.VERSION}`, JSON.stringify(current)]])
  global.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const store = records.createRecordStore(); store.start()
  assert.deepEqual(store.snapshot().record, current)
  assert.ok(!records.isRecord({ ...old, experiments: { lora: { ...current.experiments.lora, view: { time: NaN, focus: '', mode: 'graph' } } } }))
  console.log(JSON.stringify({ status: 'passed', sceneTypes: 15, svgRenders: rendered, elementInspections: inspections, preserved: ['v2 notes', 'slide index', 'legacy lab parameters', 'continuous time', 'selected element', 'geometry mode'] }, null, 2))
} finally { fs.rmSync(out, { recursive: true, force: true }) }
