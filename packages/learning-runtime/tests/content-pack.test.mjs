import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
const json = async p => JSON.parse(await readFile(p,'utf8'))
const catalog = await json('dist/content/catalog.json')
const coverage = await json('dist/content/coverage.json')

test('every exported source node has a unique versioned activity and an actual lesson', async () => {
  const activities=new Set()
  for(const course of catalog.courses) {
    assert.deepEqual(course.modules.map(n=>n.moduleId),coverage.coverage.find(c=>c.id===course.id).nodes)
    for(const node of course.modules) {
      assert.ok(!activities.has(node.id));activities.add(node.id)
      const lesson=await json(path.join('dist',node.path))
      assert.equal(lesson.course_id,course.id);assert.equal(lesson.content_version,course.version);assert.equal(lesson.module_id,node.moduleId)
      assert.ok(lesson.lesson.trim());assert.ok(Array.isArray(lesson.theories));assert.ok(Array.isArray(lesson.interactions))
      for(const item of lesson.interactions) if(item.path && !item.path.includes('?')) await readFile(path.join('dist',item.path))
    }
  }
  assert.equal(activities.size,coverage.nodes)
  assert.equal(catalog.courses.find(c=>c.id==='lightkurve-transit-detective').modules.length,32)
  assert.equal(catalog.courses.filter(c=>c.kind==='full').length,12)
  assert.ok(catalog.courses.some(c=>c.id==='assemble-a-rover-legacy-v1'))
  assert.ok(catalog.courses.some(c=>c.id==='transformer-lab'))
})

test('readings and assignments remain exact copies of shared sources', async () => {
  const source=process.env.SYSTEMEDU_CONTENT_SOURCE ?? '../../../systemeduidea/projects_data'
  for(const course of catalog.courses.filter(c=>c.kind==='full')) {
    const manifest=await json(`${source}/${course.id}/manifest.json`)
    for(const node of course.modules) {
      const info=manifest.knodes.find(n=>n.module_id===node.moduleId), lesson=await json(path.join('dist',node.path))
      const base=`${source}/${course.id}/${info.knode_dir}`
      const assignment=await readFile(`${base}/assignment.md`,'utf8')
      assert.equal(lesson.assignment,assignment)
      assert.equal(lesson.lesson,lesson.content_status==='assignment_only'?assignment:await readFile(`${base}/lesson.md`,'utf8'))
    }
  }
  assert.deepEqual(coverage.gaps.map(g=>g.module),['M28b','M36b','M47b'])
})
