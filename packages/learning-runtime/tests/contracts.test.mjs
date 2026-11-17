import test from "node:test"
import assert from "node:assert/strict"
import { build } from "esbuild"
import { readFile } from "node:fs/promises"
import Ajv from "ajv"

const compiled = await build({ entryPoints: ["src/snapshots.ts"], bundle: true, platform: "node", format: "esm", write: false })
const { handSnapshot, landingSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`)

test("damaged stored state cannot drive a joint out of range or select a missing object", () => {
  const state = handSnapshot({ commands: { thumb: Infinity, index: -5, middle: 7 }, selected: "missing", opposition: NaN, shells: "no" })
  assert.equal(state.commands.index, 0); assert.equal(state.commands.middle, 1)
  assert.equal(state.selected, "index"); assert.equal(state.shells, true)
  assert.ok(Number.isFinite(state.opposition))
  assert.equal(landingSnapshot({ time: 900, selected: "__proto__", speed: 99 }).selected, null)
  assert.equal(landingSnapshot({ time: 900 }).time, 42)
  assert.equal(landingSnapshot(null).time, 25)
})

test("restored interactive state preserves choices", () => {
  const state = { commands: { thumb: .8, index: .5, middle: .2, ring: .1, little: 0 }, opposition: .72, ball: true, shells: false, tendons: true, selected: "thumb" }
  assert.deepEqual(handSnapshot(JSON.parse(JSON.stringify(state))), state)
  assert.deepEqual(landingSnapshot({ time: 36, speed: 2, hidden: true, selected: "rover", answer: true }), { time: 36, speed: 2, hidden: true, selected: "rover", answer: true })
})

test("host schema rejects executable methods, unknown fields, and malformed saves", async () => {
  const schema = JSON.parse(await readFile("../learning-contracts/schemas/learning-host.schema.json"))
  const validate = new Ajv({ strict: false }).compile(schema)
  const valid = { version: 1, session: "session", activity: "mechanical-hand", request_id: "request", method: "save", state: { opposition: .5 } }
  assert.ok(validate(valid))
  for (const changed of [{ method: "eval" }, { version: true }, { activity: "unknown" }, { url: "file:///etc/passwd" }, { state: null }]) assert.equal(validate({ ...valid, ...changed }), false)
  const missing = { ...valid }; delete missing.state; assert.equal(validate(missing), false)
})

test("course fixture retains the existing activity identity and exact authored text", async () => {
  const fixture = JSON.parse(await readFile("../learning-contracts/fixtures/driving-intro.json"))
  const root = "../student-web/public/project-lines/space-exploration/write-driving-rules/course/"
  const tree = JSON.parse(await readFile(root + "tree/knowledge_tree.json"))
  assert.deepEqual(fixture.scope, { library_slug: tree.id, module_id: tree.modules[0].module_id, activity_id: "reflection", kind: "classroom", content_version: tree.version })
  assert.equal(fixture.module.lesson, await readFile(root + tree.modules[0].lesson, "utf8"))
})
