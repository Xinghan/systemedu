const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(process.env.READER_ROOT || path.join(__dirname, '..'), 'src/components/learning')

function load(name, extra = {}) {
  const m = { exports: {} }
  const mocks = {
    '@/lib/i18n/use-t': { useT: () => key => key },
    '@/lib/api': { myProjects: {} },
    '@/lib/auth': { getToken: () => null },
    '@/lib/course-numbering': { MOLECULE_NUMBERING_VERSION: 'consecutive-v2' },
    '@/lib/normalize-slides': { normalizeSlides: value => value },
    '@/components/ui/loading-spinner': { LoadingSpinner: () => React.createElement('span', null, 'loading') },
    './course-content-view': { IdeaBlock: () => null },
    './technical-visual': { FormulaVisual: () => null, TechnicalVisual: () => null },
    ...extra,
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(root, name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  new Function('exports', 'require', 'module', source)(m.exports, name => mocks[name] || require(name), m)
  return m.exports
}
const presentation = load('readonly-presentation.tsx')
const player = load('teacher-scene-view.tsx', { './readonly-presentation': presentation })
const lesson = load('lesson-slides.tsx', { './teacher-scene-view': player })
const slides = Array.from({ length: 10 }, (_, i) => ({ slide_id: `s${i}`, kind: 'bullet', title: `Unique title ${i}`, payload: { bullets: [`Lesson content ${i}`] }, audio_script: `Narration ${i}` }))
const deck = { slides, ideas: [], renderedSections: {}, knodeDir: 'knodes/M03' }
const render = (index, layout = 'fit') => renderToStaticMarkup(React.createElement(player.SlideDeckPlayer, { deck, projectName: 'demo', moduleId: 'M03', currentIndex: index, onIndexChange() {}, autoPlay: false, layout }))

test('the deck renders exactly the selected slide, not the whole collection', () => {
  const html = render(3)
  assert.ok(html.includes('data-slide-index="3"'))
  assert.ok(html.includes('Unique title 3'))
  assert.ok(html.includes('Lesson content 3'))
  for (let i = 0; i < 10; i++) if (i !== 3) assert.ok(!html.includes(`Unique title ${i}`))
  assert.equal((html.match(/data-slide-player/g) || []).length, 1)
})
test('out-of-range pages are clamped and navigation endpoints are disabled', () => {
  const first = render(-2), last = render(50)
  assert.ok(first.includes('data-slide-index="0"')); assert.ok(last.includes('data-slide-index="9"'))
  assert.equal((first.match(/disabled=""/g) || []).length, 1)
  assert.equal((last.match(/disabled=""/g) || []).length, 1)
  assert.equal((render(4).match(/disabled=""/g) || []).length, 0)
})
test('the unified lesson contains one carousel and keeps the article separate', () => {
  const html = renderToStaticMarkup(React.createElement(lesson.LessonSlidesProvider, {
    projectName: 'demo', moduleId: 'M03', slides, content: { ideas: [], rendered_sections: {}, plan_markdown: 'Original prose' },
  }, React.createElement(React.Fragment, null, React.createElement(lesson.LessonSlideCarousel), React.createElement('article', null, 'Original prose'))))
  assert.equal((html.match(/data-lesson-carousel/g) || []).length, 1)
  assert.equal((html.match(/data-slide-player/g) || []).length, 1)
  assert.ok(html.includes('<article>Original prose</article>'))
  assert.ok(!html.includes('data-inline-slide'))
  assert.ok(html.includes('data-slide-layout="content"'))
  assert.ok(!html.includes('76dvh'))
  assert.ok(!html.includes('overflow-y-auto'))
})

test('inline slides grow with content without a fixed-height or scrollable surface', () => {
  const html = render(2, 'content')
  assert.ok(html.includes('data-slide-surface'))
  assert.ok(!html.includes('data-slide-viewport'))
  assert.ok(!html.includes('overflow-y-auto'))
  assert.ok(!html.includes('max-h-28'))
  assert.ok(html.includes('h-auto'))
})

test('floating slides use one fitted surface instead of a scrollable slide body', () => {
  const html = render(2, 'fit')
  assert.equal((html.match(/data-slide-viewport/g) || []).length, 1)
  assert.equal((html.match(/data-slide-surface/g) || []).length, 1)
  assert.ok(!html.includes('overflow-y-auto'))
  assert.ok(html.includes('transform-origin:top center'))
})
test('neither production reader nor preview can reintroduce flat slide slots', () => {
  for (const name of ['course-content-view.tsx', 'lesson-reading-preview.tsx']) {
    const source = fs.readFileSync(path.join(root, name), 'utf8')
    assert.ok(!source.includes('LessonSlideSlot'))
    assert.equal((source.match(/<LessonSlideCarousel\s*\/>/g) || []).length, 1)
  }
})
test('all loading and empty-state branches are free of removed scene bindings', () => {
  const source = fs.readFileSync(path.join(root, 'course-content-view.tsx'), 'utf8')
  const ast = ts.createSourceFile('reader.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const legacy = []
  function visit(node) {
    if (ts.isIdentifier(node) && ['sceneMode', 'setSceneMode', 'onSwitchScene'].includes(node.text)) legacy.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.deepEqual(legacy, [])
  assert.ok(source.includes('<LessonSlideshowButton />'))
})
