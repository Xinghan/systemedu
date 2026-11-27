import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const temporary = mkdtempSync(path.join(tmpdir(), 'lesson-identity-'))
let renderIntro, readingPages
try {
  await build({ stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MissionTaskIntro } from './src/mobile/mission-context';
    export { readingPages } from './src/mobile/reading-pages';
    export function renderIntro(lesson) { return renderToStaticMarkup(createElement(MissionTaskIntro, { lesson })); }
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'node', format: 'cjs', outfile: path.join(temporary, 'render.cjs') })
  ;({ renderIntro, readingPages } = createRequire(import.meta.url)(path.join(temporary, 'render.cjs')))
} finally { rmSync(temporary, { recursive: true, force: true }) }

const read = relative => JSON.parse(readFileSync(path.join('dist', relative), 'utf8'))
const catalog = read('content/catalog.json')
const story = read('content/missions/space-expedition.json')
const mission = read('content/missions/space.json')
const nodes = [...mission.micro, ...mission.nodes, ...mission.research]
const lessons = new Map(catalog.courses.flatMap(c => c.modules.map(n => [n.id, read(n.path)])))
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')

test('every expedition node shows its lesson identity instead of repeating the chapter introduction', () => {
  for (const chapter of story.chapters) {
    for (const [index, ref] of chapter.refs.entries()) {
      const node = nodes.find(node => node.ref === ref)
      const lesson = lessons.get(node.activityId)
      assert.equal(node.title, lesson.title, `${ref}: native and reader titles must agree`)
      const html = renderIntro(lesson)
      assert.ok(html.includes(`<h1>${escape(lesson.title)}</h1>`), ref)
      assert.ok(html.includes(`本章第 ${index + 1} / ${chapter.refs.length} 节`), ref)
      if (chapter.refs.length > 1 && lesson.learning_output) {
        assert.ok(html.includes(escape(lesson.learning_output)), `${ref}: its own output`)
        assert.ok(!html.includes('mission-action-steps'), `${ref}: no repeated chapter-wide task list`)
      }
    }
  }
})

test('different reading lengths belong to distinct lessons and never remove route nodes', () => {
  const chapter = story.chapters.find(chapter => chapter.id === 'research-P1')
  assert.deepEqual(chapter.refs, [1, 2, 3, 4, 5].map(n => `lightkurve-transit-detective:M0${n}`))
  const lessonNodes = chapter.refs.map(ref => nodes.find(node => node.ref === ref))
  const counts = lessonNodes.map(node => new Set(readingPages(lessons.get(node.activityId).lesson).map(page => page.section)).size)
  assert.equal(new Set(lessonNodes.map(node => node.title)).size, 5)
  assert.ok(counts[2] > counts[3], 'the reported shorter next lesson still retains its own identity')
  assert.equal(new Set(story.chapters.flatMap(c => c.refs)).size, nodes.length)
})
