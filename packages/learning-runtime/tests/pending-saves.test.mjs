import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: ['src/pending-saves.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { flushPendingSaves } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const tick = () => new Promise(resolve => setImmediate(resolve))

test('completion waits for the newer write even when an autosave waiter takes it first', async () => {
  const pending = { current: { self_completed: false } }, inFlight = { current: null }, writes = [], releases = []
  const write = value => { writes.push(value); return new Promise(resolve => releases.push(resolve)) }
  const first = flushPendingSaves(pending, inFlight, write)
  const timer = flushPendingSaves(pending, inFlight, write)
  pending.current = { self_completed: true, note: 'keep this work' }
  let advanced = false
  const finish = flushPendingSaves(pending, inFlight, write).then(() => { advanced = true })
  releases[0](); await tick()
  assert.equal(writes.length, 2); assert.equal(advanced, false)
  assert.deepEqual(writes[1], { self_completed: true, note: 'keep this work' })
  releases[1](); await Promise.all([first, timer, finish])
  assert.equal(advanced, true); assert.equal(inFlight.current, null)
})

test('a failed completion remains queued and a retry persists it', async () => {
  const pending = { current: { self_completed: true } }, inFlight = { current: null }
  await assert.rejects(flushPendingSaves(pending, inFlight, async () => { throw new Error('save failed') }), /save failed/)
  assert.equal(pending.current.self_completed, true)
  let saved
  await flushPendingSaves(pending, inFlight, async value => { saved = value })
  assert.equal(saved.self_completed, true); assert.equal(pending.current, null)
})
