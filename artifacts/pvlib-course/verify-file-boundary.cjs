const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('/Users/xinghan/Dev/systemedu/packages/student-web/node_modules/typescript');
const src = '/Users/xinghan/Dev/systemedu/packages/student-web/src';
const fixtures = '/private/tmp/pvlib-preview/file-boundary-fixtures';
const root = path.join(fixtures, 'systemeduidea/projects_data/pvlib-solar-forecast-station');
const env = { NODE_ENV: 'development' };
const taskProcess = { env, cwd: () => path.join(fixtures, 'systemedu/packages/student-web') };
let checks = 0;
function check(actual, expected, label) { assert.equal(actual, expected, label); checks++; }
function load(file, mocks = {}) {
  const js = ts.transpileModule(sync.readFileSync(path.join(src, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: id => id in mocks ? mocks[id] : require(id), process: taskProcess, URL, Request, Response, TextEncoder });
  return exports;
}
(async () => {
  await fs.mkdir(path.join(root, 'images'), { recursive: true });
  await fs.mkdir(path.join(root, 'downloads'), { recursive: true });
  await fs.writeFile(path.join(root, 'images/listed.png'), 'unit image bytes');
  await fs.writeFile(path.join(root, 'images/unlisted.png'), 'not on manifest');
  await fs.writeFile(path.join(root, 'secret.json'), '{}');
  await fs.writeFile(path.join(root, 'downloads/pvlib-practice-kit.zip'), 'unit zip bytes');
  await fs.writeFile(path.join(root, 'downloads/other.zip'), 'unapproved archive');
  await fs.writeFile(path.join(fixtures, 'outside.png'), 'outside course');
  const link = path.join(root, 'images/escape.png');
  if (!sync.existsSync(link)) await fs.symlink(path.join(fixtures, 'outside.png'), link);
  const manifest = { knodes: [{ module_id: 'M01', knode_dir: 'knodes/M01-unit-fixture' }], files: ['images/listed.png', 'images/escape.png', 'secret.json', 'downloads/pvlib-practice-kit.zip', 'downloads/other.zip'].map(path => ({ path })) };
  const saveManifest = value => fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(value));
  await saveManifest(manifest);
  const server = load('lib/server/pvlib-local-preview.ts', { 'server-only': {}, '@/lib/pvlib-preview': { PVLIB_SLUG: 'pvlib-solar-forecast-station' } });
  const route = load('app/preview/pvlib/media/route.ts', { '@/lib/server/pvlib-local-preview': server });
  const get = (relative, host = 'localhost:4000') => route.GET(new Request('http://localhost:4000/preview/pvlib/media?path=' + encodeURIComponent(relative), { headers: { host } }));
  for (const relative of ['images/unlisted.png', 'images/escape.png', '../outside.png', '/etc/passwd', 'images/../secret.json', 'images//listed.png', 'images/./listed.png', 'secret.json', 'downloads/other.zip', 'images/missing.svg', 'images/listed.png\0']) check((await get(relative)).status, 404, relative);
  for (const host of ['evil.test', 'localhost.evil.test', 'localhost:4000@evil.test']) check((await get('images/listed.png', host)).status, 404, host);
  env.NODE_ENV = 'production';
  check((await get('images/listed.png')).status, 404, 'production gate');
  env.NODE_ENV = 'development';
  const image = await get('images/listed.png');
  check(image.status, 200, 'listed local image');
  check(await image.text(), 'unit image bytes', 'source bytes preserved');
  check(image.headers.get('content-type'), 'image/png', 'image mime');
  check(image.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
  check(image.headers.get('cache-control'), 'no-store', 'no shared cache');
  check(image.headers.get('content-security-policy'), "default-src 'none'; sandbox", 'media CSP');
  const archive = await get('downloads/pvlib-practice-kit.zip');
  check(archive.status, 200, 'authorized archive');
  check(archive.headers.get('content-disposition'), 'attachment; filename="pvlib-practice-kit.zip"', 'archive attachment');
  for (const broken of [null, { knodes: [], files: [] }, { ...manifest, knodes: [...manifest.knodes, ...manifest.knodes] }, { ...manifest, knodes: [{ module_id: 'M01', knode_dir: '../escape' }] }, { ...manifest, files: [{ path: '../outside.png' }] }, { ...manifest, files: [{ path: null }] }]) {
    await saveManifest(broken);
    check((await get('images/listed.png')).status, 404, 'invalid manifest');
  }
  await saveManifest(manifest);
  const record = { questions: ['What was observed?'], output: 'Evidence table', quiz: [{ id: 'q1', question: 'Which unit?', options: ['W', 'Wh'], correct: 0, explanation: 'Power uses W.' }] };
  check(server.validatePvlibRecord(record), record, 'valid record');
  for (const broken of [null, { ...record, questions: [] }, { ...record, quiz: [{ ...record.quiz[0], correct: 3 }] }, { ...record, quiz: [...record.quiz, ...record.quiz] }, { ...record, response_prompts: [{ title: 'x', hint: 'x', example: 'x', fields: [{ id: 'x', label: 'x', type: 'choice', options: [] }] }] }]) {
    assert.throws(() => server.validatePvlibRecord(broken)); checks++;
  }
  const report = { passed: checks, scope: 'real temporary files, media route response, traversal/symlink/extension/manifest gates, record validation', note: 'Isolated unit fixtures only; no fabricated course lesson is served or written in either repository.' };
  await fs.writeFile('/private/tmp/pvlib-preview/file-boundary-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
