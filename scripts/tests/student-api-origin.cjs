const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(require.resolve('typescript', { paths: [path.resolve(__dirname, '../../packages/student-web')] }))
const base = path.resolve(__dirname, '../../packages/student-web/src/lib/api')
function compile(name) {
  return ts.transpileModule(fs.readFileSync(path.join(base, name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
}
const originCode = compile('origin.ts'), clientCode = compile('client.ts')
const cases = [
  [{ NODE_ENV: 'production' }, '', ''],
  [{ NODE_ENV: 'production', NEXT_PUBLIC_STUDENT_API_URL: '', NEXT_PUBLIC_GATEWAY_URL: '' }, '', ''],
  [{ NODE_ENV: 'development' }, 'http://localhost:18820', 'http://localhost:18820'],
  [{ NODE_ENV: 'development', NEXT_PUBLIC_STUDENT_API_URL: '', NEXT_PUBLIC_GATEWAY_URL: '' }, '', ''],
  [{ NODE_ENV: 'production', NEXT_PUBLIC_STUDENT_API_URL: 'https://api.example.test', NEXT_PUBLIC_GATEWAY_URL: 'https://media.example.test' }, 'https://api.example.test', 'https://media.example.test'],
]
;(async () => {
  for (const [env, student, gateway] of cases) {
    const origins = {}
    vm.runInNewContext(originCode, { exports: origins, process: { env } })
    assert.equal(origins.STUDENT_API_URL, student)
    assert.equal(origins.GATEWAY_API_URL, gateway)
    const client = {}, requests = []
    vm.runInNewContext(clientCode, {
      exports: client,
      require(name) {
        if (name === './origin') return origins
        if (name === '@/lib/auth') return { getToken: () => 'fixture-token' }
        if (name === '@/lib/course-numbering') return { MOLECULE_NUMBERING_VERSION: 'test-version' }
        throw new Error(`Unexpected import: ${name}`)
      },
      fetch: async (url, init) => {
        requests.push({ url, init })
        return { status: 200, ok: true, json: async () => [{ slug: 'existing-project' }] }
      },
    })
    assert.equal((await client.api.get('/api/my/projects'))[0].slug, 'existing-project')
    assert.equal(requests[0].url, `${student}/api/my/projects`)
    assert.equal(requests[0].init.headers.Authorization, 'Bearer fixture-token')
    assert.equal(requests[0].init.headers['X-Course-Numbering'], 'test-version')
  }
  console.log(JSON.stringify({ passed: true, cases: cases.length, checks: ['Production without public env uses same-origin API and media.', 'Empty values, explicit remote URLs, and local development retain their meanings.', 'Actual API client preserves authentication and course version headers.'] }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
