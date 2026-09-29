const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('../../packages/student-web/node_modules/typescript');
function load(file, requireModule) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const box = { exports: {}, require: requireModule, TextEncoder };
  vm.runInNewContext(code, box); return box.exports;
}
const preview = load('packages/student-web/src/lib/pvlib-preview.ts');
const { pvlibClassroomContent, pvlibClassroomTarget } = load('packages/student-web/src/lib/pvlib-classroom.ts', () => preview);
const link = '[实践包](/preview/pvlib/media?path=downloads%2Fpvlib-practice-kit.zip)';
const source = { plan_markdown: link, sections: [{ body_markdown: link }], ideas: [
  { idea_id: 'M08-game', mode: 'game' }, { idea_id: 'M08-animation', mode: 'animation' },
  { idea_id: 'M08-object', mode: 'diagram', style_key: 'hardware_object_3d' },
], rendered_sections: { 'M08-game': { html: '<html/>' }, 'M08-animation': { html: '<html/>' }, 'M08-object': { html: '<html/>' } } };
const raw = JSON.stringify(source), result = pvlibClassroomContent(source);
assert.equal(result.plan_markdown, '[实践包](#course-downloads)');
assert.equal(result.sections[0].body_markdown, result.plan_markdown);
assert.equal(JSON.stringify(source), raw, 'raw source used for existing record versions must remain unchanged');
assert.equal(result.ideas, source.ideas); assert.equal(result.rendered_sections, source.rendered_sections);
for (const [view, mode, target] of [['lab','game','idea-M08-game'],['lab','animation','idea-M08-animation'],['lab','object','idea-M08-object'],['assignment','game','course-assignment'],['slides','game','lesson-player'],['reading','game',null]]) {
  assert.equal(pvlibClassroomTarget(source, view, mode), target);
}
assert.equal(pvlibClassroomTarget({ ...source, ideas: [] }, 'lab', 'game'), 'course-assignment');
console.log('PASS: presentation repair preserves raw record-version input, HTML assets and legacy course destinations');
