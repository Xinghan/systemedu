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

test('Mars briefings cover every station and project, including the transit investigation', () => {
  const mission = read('content/missions/space.json')
  const catalog = read('content/catalog.json')
  assert.equal(mission.commander.name, '林岚')
  assert.equal(new Set(mission.stations.map(s => s.learnerRole)).size, mission.stations.length)
  for (const station of mission.stations) assert.ok(station.briefing.length > 20, station.id)
  for (const slug of mission.courseIds.filter(id => !id.endsWith('-legacy-v1'))) {
    assert.ok(mission.commander.projects[slug], slug)
    const course = catalog.courses.find(c => c.id === slug)
    const lesson = read(course.modules[0].path)
    assert.ok(lesson.mission_brief?.speaker === '林岚' || lesson.lesson.includes('林岚'), slug)
  }
})

test('transit reader supplies the actual Q3 evidence at first use and locates every lesson', () => {
  const course = read('content/catalog.json').courses.find(c => c.id === 'lightkurve-transit-detective')
  course.modules.forEach((node, i) => {
    const lesson = read(node.path)
    assert.equal(lesson.course_position.number, i + 1)
    assert.equal(lesson.course_position.total, 32)
    assert.ok(lesson.course_position.stage && lesson.learning_output)
    assert.ok(!lesson.lesson.includes('/preview/lightkurve/'))
    for (const [ , rel ] of lesson.lesson.matchAll(/\/api\/library\/projects\/lightkurve-transit-detective\/files\/([^\s)]+)/g)) {
      assert.ok(existsSync(path.join(root, 'content/assets', course.id, rel)), rel)
    }
  })
  const section = read(course.modules[0].path).lesson.split('## 先描述看到的变化，再讨论原因')[1].split('\n## ')[0]
  assert.match(section, /!\[.+?\]\(.+?kepler10-q3\.png\)/)
  assert.match(section, /\[Q3 观测表（CSV）\]\(.+?kepler10-q3\.csv\)/)
  const assets = path.join(root, 'content/assets', course.id)
  const table = readFileSync(path.join(assets,'downloads/kepler10-q3.csv'),'utf8').trimEnd().split('\n')
  const measurements = JSON.parse(readFileSync(path.join(assets,'practice/browser/development.json'),'utf8')).points
  assert.equal(measurements.length, table.length - 1)
  measurements.forEach((p,i) => assert.deepEqual(table[i+1].split(',').map(cell => cell === '' ? null : Number(cell)), [p.cadenceno,p.time_bkjd,p.pdcsap_flux,p.quality]))
})

test('each installed project supplies a readable accent and the home briefing has an offline poster', () => {
  const palette = JSON.parse(readFileSync(new URL('../scripts/project-colors.json', import.meta.url)))
  for (const course of read('content/catalog.json').courses) {
    assert.equal(course.accentHex, palette[course.id.replace(/-legacy-v1$/, '')], course.id)
    const rgb = course.accentHex.slice(1).match(/../g).map(hex => parseInt(hex, 16) / 255)
    const [r, g, b] = rgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    assert.ok(1.05 / (.2126 * r + .7152 * g + .0722 * b + .05) >= 4.5, course.id)
  }
  const mission = read('content/missions/space.json')
  const opening = mission.films.find(f => f.id === mission.home.filmId)
  assert.equal(readFileSync(path.join(root, opening.poster)).readUInt16BE(0), 0xffd8)
})

test('the home overview explains each station and reaches every expedition project', () => {
  const mission = read('content/missions/space.json')
  assert.deepEqual(mission.home.chapters.map(c => c.station), mission.stations.map(s => s.id))
  for (const c of mission.home.chapters) assert.ok(c.title && c.body.length > 80, c.station)
  assert.ok(mission.home.introduction.length >= 2)
  assert.match(mission.home.researchOverview, /Kepler-10/)
  const projects = new Set(mission.stations.flatMap(s => s.projects))
  projects.add(mission.research[0].ref.split(':')[0])
  assert.deepEqual([...projects].sort(), mission.courseIds.filter(id => !id.endsWith('-legacy-v1')).sort())
})

test('the space program opens real projects from a shared foundation, with distinct research and engineering outcomes', () => {
  const mission = read('content/missions/space.json')
  const program = mission.home
  const nodes = new Map([...mission.micro, ...mission.nodes, ...mission.research].map(n => [n.ref, n]))
  assert.equal(mission.title, '星际远航')
  assert.equal(mission.micro[0].ref, 'spot-a-world:M01')
  assert.equal(program.tracks.length, 2)
  assert.equal(nodes.get(program.tracks.find(t => t.id === 'transit').entry).station, 'research')
  assert.equal(nodes.get(program.tracks.find(t => t.id === 'rover').entry).station, 'mission-design')
  for (const item of program.subjects) assert.ok(nodes.has(item.entry), item.entry)
  const brief = mission.films.find(f => f.id === program.filmId)
  const transcript = readFileSync(path.join(root, brief.captions), 'utf8')
  assert.match(transcript, /探测车/); assert.match(transcript, /恒星数据/)
  const catalog = read('content/catalog.json')
  const project = catalog.courses.find(c => c.id === 'lightkurve-transit-detective')
  assert.ok(!read(project.modules[0].path).lesson.includes('火星探索的选学任务'))
  const map = readFileSync(new URL('../../../artifacts/ipad-mars/node-destinations.md', import.meta.url), 'utf8')
  const mapped = [...map.matchAll(/`(course:[^`]+)`/g)].map(m => m[1]).sort()
  assert.deepEqual(mapped, catalog.courses.filter(c => mission.courseIds.includes(c.id)).flatMap(c => c.modules.map(n => n.id)).sort())
})
