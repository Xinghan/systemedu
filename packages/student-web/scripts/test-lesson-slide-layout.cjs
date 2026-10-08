const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const mod = { exports: {} }
new Function('exports', 'require', 'module', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/lesson-slide-layout.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod.exports, require, mod)
const { buildLessonSlideLayout, isSharedActivitySlide, splitLessonParts, firstMarkerSections } = mod.exports
const content = { plan_markdown: '## 认识\n正文\n[[THEORY:t1]]\n[[IDEA:可视化]]', ideas: [{ idea_id: 'i1', topic: '可视化' }], rendered_sections: {} }
const slide = (kind, payload = {}, extra = {}) => ({ slide_id: kind, kind, payload, ...extra })
test('explicit identifiers and activity aliases determine placement, never page order', () => {
  const slides = [slide('theory', { theory_id: 't1' }), slide('intro'), slide('game', { idea_id: 'i1' }), slide('outro'), slide('bullet')]
  const map = buildLessonSlideLayout(content, slides)
  assert.deepEqual(map.get('theory:t1'), [0]); assert.deepEqual(map.get('idea:可视化'), [2])
  assert.deepEqual(map.get('intro'), [1]); assert.deepEqual(map.get('outro'), [3]); assert.deepEqual(map.get('supplement'), [4])
  assert.deepEqual([...map.values()].flat().sort(), [0, 1, 2, 3, 4])
})
test('replacement source anchor wins over an obsolete payload and invalid links remain supplemental', () => {
  const map = buildLessonSlideLayout(content, [slide('theory', { theory_id: 'wrong' }, { lesson_anchor: { kind: 'theory', id: 't1' } }), slide('intro', { theory_id: 'missing' })])
  assert.deepEqual(map.get('theory:t1'), [0]); assert.deepEqual(map.get('supplement'), [1])
})
test('structured sections, repeated markers and missing deck retain deterministic single coverage', () => {
  const c = { ...content, sections: [{ section_id: 's1', body_markdown: '[[THEORY:t1]] [[THEORY:t1]]' }] }
  const map = buildLessonSlideLayout(c, [slide('theory', { theory_id: 't1' }), slide('bullet', {}, { lesson_anchor: { kind: 'section', id: 's1' } })])
  assert.deepEqual(map.get('theory:t1'), [0]); assert.deepEqual(map.get('section:s1'), [1]); assert.equal(buildLessonSlideLayout(c, []).size, 0)
})
test('fenced marker examples are not source anchors', () => {
  const map = buildLessonSlideLayout({ ...content, plan_markdown: '```txt\n[[THEORY:example]]\n```' }, [slide('theory', { theory_id: 'example' })])
  assert.deepEqual(map.get('supplement'), [0])
})
test('only identical linked activities may be shared; replacement visuals retain the original exercise', () => {
  assert.equal(isSharedActivitySlide(slide('game', { idea_id: 'i' })), true)
  assert.equal(isSharedActivitySlide(slide('game', { idea_id: 'i', technical_visual: { renderer: 'molecule-skeleton' } })), false)
})

test('tokenization preserves all source bytes and longer/unclosed fences', () => {
  for (const markdown of ['text\n[[THEORY:t1]]\n```py\n[[IDEA:example]]\n```\nafter', '~~~text\n[[IDEA:example]]\n~~~~\n[[THEORY:t1]]', '```\n[[THEORY:t1]]']) {
    assert.equal(splitLessonParts(markdown).join(''), markdown)
  }
  assert.equal(splitLessonParts('```\n[[THEORY:t1]]').length, 1)
  assert.deepEqual(firstMarkerSections([{ body_markdown: '[[THEORY:t1]]' }, { body_markdown: '[[THEORY:t1]]\n[[IDEA:i2]]' }]), new Map([['[[THEORY:t1]]', 0], ['[[IDEA:i2]]', 1]]))
})

test('both recent drafts retain exact source links independently of their new visual payload', () => {
  const root = path.resolve(__dirname, '../../../course_factory/fixtures/molecule-monster-hunter')
  for (const [node, version] of [['M03', 'spatial-v1'], ['M86', 'funnel-v1']]) {
    const draft = JSON.parse(fs.readFileSync(path.join(root, `${node}-${version}.json`)))
    const source = JSON.parse(fs.readFileSync(path.join(root, `${node}-before-${version}/slides.json`)))
    const lesson = fs.readFileSync(path.join(root, `${node}-before-${version}/lesson.md`), 'utf8')
    const c = { plan_markdown: lesson, ideas: [], rendered_sections: {} }
    draft.slides.forEach((s, i) => {
      const p = source.slides[i].payload
      if (p.theory_id) assert.deepEqual(s.lesson_anchor, { kind: 'theory', id: p.theory_id })
      if (p.idea_id) assert.deepEqual(s.lesson_anchor, { kind: 'idea', id: p.idea_id })
    })
    const positions = [...buildLessonSlideLayout(c, draft.slides).values()].flat()
    assert.equal(positions.length, draft.slides.length)
    assert.equal(new Set(positions).size, draft.slides.length)
  }
})
