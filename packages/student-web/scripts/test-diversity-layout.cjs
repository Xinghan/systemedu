const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const root = process.env.STUDENT_WEB_ROOT || path.join(__dirname, '..')
const css = postcss.parse(fs.readFileSync(path.join(root, 'src/components/learning/diversity-rejection.css'), 'utf8'))
function declarations(selector) {
  const values = {}
  css.walkRules(selector, rule => rule.walkDecls(d => { values[d.prop] = d.value }))
  return values
}
test('evidence cards use a named content-size container, not viewport breakpoints', () => {
  assert.equal(declarations('.se.dr').container, 'diversity-rejection / inline-size')
  const queries = []
  css.walkAtRules('container', rule => queries.push(rule.params))
  assert.ok(queries.includes('diversity-rejection (max-width:850px)'))
  assert.ok(queries.includes('diversity-rejection (max-width:620px)'))
})
test('text tables explicitly override shared nowrap without shrinking text', () => {
  const table = declarations('.se.dr table:not(.dr-matrix)')
  assert.equal(table['white-space'], 'normal')
  assert.equal(table['overflow-wrap'], 'anywhere')
  assert.equal(table['table-layout'], 'fixed')
  assert.equal(table['font-size'], undefined)
  assert.equal(declarations('.dr-panel')['min-width'], '0')
})
test('similarity matrix keeps its dedicated fixed grid', () => {
  assert.equal(declarations('.dr-matrix')['table-layout'], 'fixed')
  assert.equal(declarations('.se.dr table:not(:has(thead)) th').width, '28%')
})
test('no overflow clipping hides evidence inside cards', () => {
  for (const selector of ['.se.dr', '.dr-panel', '.se.dr table:not(.dr-matrix)']) {
    const values = declarations(selector)
    assert.notEqual(values.overflow, 'hidden')
    assert.notEqual(values['overflow-x'], 'hidden')
  }
})
