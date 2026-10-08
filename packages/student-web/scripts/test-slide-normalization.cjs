// Run with: node --test scripts/test-slide-normalization.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/lib/normalize-slides.ts'), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const loaded = { exports: {} }
new Function('exports', 'require', 'module', output)(loaded.exports, require, loaded)
const { normalizeSlides } = loaded.exports

test('recovers legacy title, subtitle, concept cards and bullet points', () => {
  const [slide] = normalizeSlides([{
    kind: 'bullet',
    payload: {
      title: '旧格式标题', subtitle: '副标题', bullets: ['精确知识点'],
      concept_cards: [{ label: '输入', text: 'SMILES' }],
    },
  }], 'M87')
  assert.equal(slide.slide_id, 'M87-slide-1')
  assert.equal(slide.title, '旧格式标题')
  assert.equal(slide.payload.hero_subtitle, '副标题')
  assert.deepEqual(slide.payload.bullets, ['精确知识点'])
  assert.equal(slide.payload.concept_cards[0].title, '输入')
  assert.equal(slide.payload.concept_cards[0].body, 'SMILES')
})

test('preserves modern titles, technical state data, images and narration', () => {
  const original = {
    slide_id: 's4', kind: 'theory', title: '新格式标题', audio_script: '原始讲稿',
    audio_path: 'audio/slide-3.wav',
    payload: {
      title: '旧字段不覆盖新字段',
      technical_visual: { renderer: 'formula-sequence', steps: [{ latex: 'S=0.81' }] },
      images: [{ src: 'images/teaching.webp' }],
    },
  }
  const before = JSON.stringify(original)
  const [slide] = normalizeSlides([original], 'M87')
  assert.equal(slide.title, '新格式标题')
  assert.equal(slide.slide_id, 's4')
  assert.equal(slide.audio_path, original.audio_path)
  assert.equal(slide.audio_script, original.audio_script)
  assert.deepEqual(slide.payload.technical_visual, original.payload.technical_visual)
  assert.deepEqual(slide.payload.images, original.payload.images)
  assert.equal(JSON.stringify(original), before, 'normalization must not mutate source data')
})

test('handles absent collections and gives legacy pages stable unique IDs', () => {
  assert.deepEqual(normalizeSlides(null, 'M04'), [])
  assert.deepEqual(normalizeSlides({}, 'M04'), [])
  const result = normalizeSlides([null, 'bad', {}, {}], 'M04')
  assert.equal(result.length, 2)
  assert.notEqual(result[0].slide_id, result[1].slide_id)
  assert.ok(result.every(slide => slide.title && slide.payload))
})
