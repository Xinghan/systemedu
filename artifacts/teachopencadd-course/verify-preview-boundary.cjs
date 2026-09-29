const fs = require('fs'); const assert = require('node:assert/strict'); const vm = require('vm');
const ts = require('/Users/xinghan/Dev/systemedu/packages/student-web/node_modules/typescript');
const root='/Users/xinghan/Dev/systemedu/packages/student-web/src/';
function load(file, mocks={}) { const source=fs.readFileSync(root+file,'utf8'); const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText; const exp={}; const context={exports:exp,require:(id)=>id in mocks?mocks[id]:require(id), TextEncoder,process}; vm.runInNewContext(js,context); return exp; }
// Objects must originate in the same realm, as postMessage deserialization does in the browser.
const source=fs.readFileSync(root+'lib/teachopencadd-preview.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const cases=`
let checks=0;
function check(v,msg){ if(!v)throw Error(msg);checks++; }
const msg=(artifact,moduleId='M01',type='systemedu-teachopencadd-artifact')=>({type,moduleId,artifact});
const parse=exports.teachopencaddArtifactMessage;
check(parse(msg({kind:'screen',title:'筛选结果',rows:[1,2,3],threshold:5}), 'M01')!==null,'valid scientific artifact');
for(const item of [null,[],{},msg({}),msg({a:NaN}),msg({a:Infinity}),msg({a:undefined}),msg({a:()=>0}),msg({a:1},'M02'),msg({a:1},'M01','systemedu-lightkurve-artifact'),{...msg({a:1}),extra:true},msg({constructor:'bad'}),msg({prototype:'bad'}),msg(JSON.parse('{"__proto__":{"x":1}}')),msg({a:'x'.repeat(16001)}),msg({a:Array(1001).fill(0)}),msg({kind:1}),msg({title:'x'.repeat(201)})])check(parse(item,'M01')===null,'invalid artifact accepted');
const cyclic={a:1};cyclic.b=cyclic;check(parse(msg(cyclic),'M01')===null,'cycles');
let deep={n:1};for(let i=0;i<10;i++)deep={next:deep};check(parse(msg(deep),'M01')===null,'depth');
check(parse(msg({a:Array(600).fill('z'.repeat(110))}),'M01')===null,'64KB byte limit');
check(parse(msg({a:Array(4).fill('分'.repeat(5500))}),'M01')===null,'UTF8 byte limit');
check(exports.teachopencaddView('garbage')==='reading','view fallback');
check(exports.teachopencaddHref('M/01','lab','game').includes('M%2F01'),'route encoding');
exports.checks=checks;
`;
const context={exports:{},TextEncoder,URLSearchParams,process}; vm.runInNewContext(js+cases,context);
const server=load('lib/server/teachopencadd-local-preview.ts',{'server-only':{},'@/lib/teachopencadd-preview':{TEACHOPENCADD_SLUG:'teachopencadd-candidate-research'}});
let checks=context.exports.checks;
for(const value of ['../private','/etc/passwd','knodes/../a','a//b','a/./b','a\\b','a\0b','']){assert.equal(server.isTeachOpenCADDRelativePath(value),false);checks++;}
assert.equal(server.isTeachOpenCADDRelativePath('knodes/M01-intro/slides.json'),true);checks++;
const oldEnv=process.env.NODE_ENV; process.env.NODE_ENV='development';
for(const host of ['localhost:4000','127.0.0.1:4000','[::1]:4000']){assert.equal(server.allowsTeachOpenCADDPreview(host),true);checks++;}
for(const host of ['systeme.xin','localhost.evil.test:4000','evil.localhost','localhost:4000@evil.test',null]){assert.equal(server.allowsTeachOpenCADDPreview(host),false);checks++;}
process.env.NODE_ENV='production';assert.equal(server.allowsTeachOpenCADDPreview('localhost:4000'),false);checks++;process.env.NODE_ENV=oldEnv;
const ui=fs.readFileSync(root+'components/learning/teachopencadd-course-preview.tsx','utf8');
assert.match(ui,/event\.source !== frame\.current\.contentWindow/);checks++;
assert.match(ui,/sandbox="allow-scripts allow-downloads"/);checks++;
assert.doesNotMatch(ui,/allow-same-origin|lightkurve|validationProtocol|request-holdout/);checks++;
assert.match(ui,/填写路径不会上传文件/);checks++;
assert.match(ui,/useLearningRecord/);checks++;
console.log(JSON.stringify({passed:checks,scope:'artifact boundary, local-only route, paths and integration contract'}));
