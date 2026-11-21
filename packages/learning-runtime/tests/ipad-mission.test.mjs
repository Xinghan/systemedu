import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../dist/', import.meta.url))
const read = p => JSON.parse(readFileSync(path.join(root,p),'utf8'))
test('iPad Mars journey retains every original node, version, station and film', () => {
  const m=read('content/missions/space.json'), c=read('content/catalog.json')
  const original=JSON.parse(readFileSync(new URL('../../student-web/src/lib/project-lines/space-curriculum.json',import.meta.url),'utf8'))
  const nodes=new Map(c.courses.flatMap(c=>c.modules.map(n=>[n.id,n])))
  assert.equal(m.stations.length,8);assert.equal(m.nodes.length,85);assert.equal(m.micro.length,3)
  assert.deepEqual(m.nodes.map(n=>n.ref),original.modules.map(n=>n.ref))
  for(const n of [...m.nodes,...m.micro,...m.research]) {
    assert.ok(nodes.has(n.activityId),n.ref)
    const lesson=read(nodes.get(n.activityId).path)
    assert.equal(n.activityId,`course:${lesson.course_id}:${lesson.content_version}:${lesson.module_id}`)
  }
  for(const s of m.stations) for(const ref of s.steps) assert.ok(m.nodes.some(n=>n.ref===ref&&n.station===s.id))
  for(const f of m.films) {assert.ok(existsSync(path.join(root,f.path)));assert.ok(existsSync(path.join(root,f.captions)))}
  assert.equal(m.films.length,7)
  assert.deepEqual(m.bridges,original.bridges)
  assert.ok(m.courseIds.includes('assemble-a-rover-legacy-v1'))
})

test('guided workspaces include authored final-delivery metadata and a real driving lab', () => {
  for(const slug of ['pick-an-observation-site','plan-a-payload','tune-a-chassis','label-the-terrain','write-driving-rules','assemble-a-rover','run-an-expedition']) {
    const c = read(`content/guided/${slug}.json`)
    assert.ok(c.final_deliverable?.title,slug)
    const last = c.modules.find(n => n.module_id === c.final_deliverable.module_id)
    assert.ok(last && last.questions.length,slug)
  }
  const catalog = read('content/catalog.json')
  const node = catalog.courses.find(c=>c.id==='write-driving-rules').modules.find(n=>n.moduleId==='M04')
  const lesson = read(node.path)
  assert.ok(lesson.interactions.some(i=>i.path==='/project-lines/space-exploration/write-driving-rules/index.html'))
  assert.ok(read('content/guided/assemble-a-rover-legacy-v1.json').legacy_edition)
})
