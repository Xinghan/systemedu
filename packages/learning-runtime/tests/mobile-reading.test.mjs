import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
const result = await build({ entryPoints: ['src/mobile/reading-pages.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { readingPages, restoreReadingPage } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

test('all four terrain rows retain all three fields without table delimiters', async () => {
  const { module } = JSON.parse(await readFile('../learning-contracts/fixtures/driving-intro.json'))
  const pages = readingPages(module.lesson), rows = pages.filter(page => page.fields)
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0].fields, [
    { label: '地形输入', value: 'clear，平整地面' },
    { label: '这个实验告诉了我们什么', value: '当前格被标为可通行' },
    { label: '作决定前应考虑什么', value: '正常前进是否合适？' }
  ])
  assert.equal(rows[3].fields[2].value, '能否据此宣称前面安全？')
  assert.equal(new Set(pages.map(page => page.id)).size, pages.length)
  // Every authored prose paragraph remains whole and unchanged.
  for (const paragraph of module.lesson.split('\n\n').filter(text => text.trim() && !text.startsWith('#') && !text.startsWith('|'))) {
    assert.ok(pages.some(page => page.markdown === paragraph.trim()), paragraph)
  }
})

test('cell cards preserve inline Markdown, escaped pipes, empty cells and reference links', () => {
  const source = '## Test\n\n| Name | Detail |\n| --- | --- |\n| **A** | a \\| b and [link][ref] |\n| B | |\n\n[ref]: https://example.com\n'
  const pages = readingPages(source)
  assert.equal(pages.length, 2)
  assert.ok(pages[0].fields[0].value.startsWith('**A**\n'))
  assert.ok(pages[0].fields[1].value.startsWith('a \\| b and [link][ref]'))
  assert.ok(pages[0].fields[1].value.includes('[ref]: https://example.com'))
  assert.equal(pages[1].fields[1].value.split('\n')[0], '')
})

test('display mathematics remain a complete block with internal blank lines', () => {
  const equation='$$\n\\begin{aligned}\na&=b\\\\\n\nc&=d\n\\end{aligned}\n$$'
  const pages=readingPages('# Formula\n\n'+equation+'\n\nExplanation.')
  assert.equal(pages[0].markdown,equation)
  assert.equal(pages[1].markdown,'Explanation.')
})

test('authoring module labels do not become student reading pages', () => {
  const pages = readingPages('> Module: M01\n\n# 确定观察问题\n\n**本节问题：** 怎样记录一次观察？\n\n## 从问题开始\n\n写下实际能够记录的量。')
  assert.equal(pages.length, 2)
  assert.equal(pages[0].section, '确定观察问题')
  assert.equal(pages[0].id, 's1-p1')
  assert.match(pages[0].markdown, /怎样记录一次观察/)
})

test('metadata after the title and invisible blocks are skipped without renumbering prose', () => {
  const pages = readingPages('# 课节\n\n> Module: M18b · capstone\n\n<!-- author-only note -->\n\n>\n\n保留的正文。\n\n> 一段正常的引文。')
  assert.deepEqual(pages.map(p => p.id), ['s1-p4', 's1-p5'])
  assert.deepEqual(pages.map(p => p.sourceIndex), [3, 4])
  assert.equal(pages[1].markdown, '> 一段正常的引文。')
})

test('short learning content, code, math, images and interaction markers remain readable', () => {
  const source = '# 解释\n\n这是代码示例。\n\n> Module: M01\n\n```text\nModule: M01\n```\n\n$$\nx=1\n$$\n\n![图](example.svg)\n\n[[THEORY:example]]'
  const pages = readingPages(source)
  assert.equal(pages.length, 6)
  assert.equal(pages[1].markdown, '> Module: M01')
  assert.equal(pages[2].markdown, '```text\nModule: M01\n```')
  assert.equal(pages[5].markdown, '[[THEORY:example]]')
})


test('saved paragraph IDs and legacy numeric positions survive removed metadata pages', () => {
  const pages = readingPages('# 课节\n\n> Module: M01\n\n学习问题。\n\n正文。')
  assert.equal(restoreReadingPage(pages, 's1-p2', 1), 0)
  assert.equal(restoreReadingPage(pages, 's1-p3', 2), 1)
  assert.equal(restoreReadingPage(pages, undefined, 2), 1)
  assert.equal(restoreReadingPage(pages, 's1-p1', 0), 0)
  assert.equal(restoreReadingPage(pages, 'missing', Infinity), 0)
  assert.equal(restoreReadingPage(pages, undefined, 999), 1)
  assert.equal(restoreReadingPage([], undefined, 999), 0)
})
