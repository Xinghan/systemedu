// Exercise the exact browser message validators without a test framework.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('../../packages/student-web/node_modules/typescript');
const file = 'packages/student-web/src/lib/pvlib-preview.ts';
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const box={exports:{},TextEncoder};vm.createContext(box);vm.runInContext(compiled,box);
// Use the validator's realm for ordinary objects; postMessage also structured-clones.
const run=code=>vm.runInContext(code,box);
run(`var payload={kind:'thermal-run',physical_validation:false,runs:[{temperature:26,elapsed:10}]};var saved={source:'pvlib-interactive',module_id:'M33',idea_id:'M33-game',payload};`);
assert.equal(run(`exports.pvlibSavedArtifact(saved,'M33','M33-game')===payload`),true);
for(const expr of [
 `exports.pvlibSavedArtifact(saved,'M32','M33-game')`,
 `exports.pvlibSavedArtifact(saved,'M33','M33-animation')`,
 `exports.pvlibSavedArtifact({...saved,source:'external'},'M33','M33-game')`,
 `exports.pvlibSavedArtifact({...saved,payload:{temperature:NaN}},'M33','M33-game')`,
 `exports.pvlibSavedArtifact({...saved,payload:{text:'a'.repeat(17000)}},'M33','M33-game')`,
 `exports.pvlibSavedArtifact({...saved,payload:JSON.parse('{"__proto__":{}}')},'M33','M33-game')`,
 `exports.pvlibSavedArtifact(null,'M33','M33-game')`
])assert.equal(run(expr),null);
run(`var ready={type:'systemedu-pvlib-artifact-ready',module_id:'M33',idea_id:'M33-game'};`);
assert.equal(run(`exports.pvlibArtifactReady(ready,'M33','M33-game')`),true);
for(const expr of [
 `exports.pvlibArtifactReady({...ready,token:'no'},'M33','M33-game')`,
 `exports.pvlibArtifactReady(ready,'M34','M33-game')`,
 `exports.pvlibArtifactReady({...ready,idea_id:'M33-animation'},'M33','M33-game')`,
 `exports.pvlibArtifactReady([], 'M33','M33-game')`
])assert.equal(run(expr),false);
console.log('PASS: 13 artifact restore identity, shape and bounded-payload checks');
