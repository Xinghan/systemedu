const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const p=path.resolve(__dirname,'../src/lib/course-numbering.ts'),m={exports:{}};
new Function('exports','module','require',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(m.exports,m,s=>require(path.resolve(path.dirname(p),s)));const n=m.exports;
test('numbering has 47 unique consecutive current IDs',()=>{assert.deepEqual(Object.values(n.LEGACY_MOLECULE_IDS),Array.from({length:47},(_,i)=>'M'+String(i+1).padStart(2,'0')))});
test('legacy M23 and current M23 have different destinations',()=>{assert.equal(n.legacyLessonPath(n.MOLECULE_PROJECT,'M23'),'/learn/molecule-monster-hunter/v2/M07');assert.equal(n.lessonPath(n.MOLECULE_PROJECT,'M23'),'/learn/molecule-monster-hunter/v2/M23');assert.equal(n.legacyLessonPath(n.MOLECULE_PROJECT,'M51'),n.lessonPath(n.MOLECULE_PROJECT,'M23'))});
test('unknown legacy IDs fail closed and other projects preserve routes',()=>{assert.equal(n.legacyLessonPath(n.MOLECULE_PROJECT,'M999'),null);assert.equal(n.lessonPath('mars-analog-rover','M23'),'/learn/mars-analog-rover/M23');assert.equal(n.isCurrentMoleculeId('M48'),false)});

