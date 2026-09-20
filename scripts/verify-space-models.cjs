const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../packages/student-web/node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const m = require('../packages/student-web/src/lib/project-lines/space-models.ts');
const pass = a => m.checkedArtifact(a) && m.artifactChecks(a).every(c=>c.passed);
function run(a,c,scenario='normal'){return m.addRun({...a,config:{...a.config,...c}},scenario)}
let site=m.freshArtifact('pick-an-observation-site');assert(!pass(site));site=run(site,{marked:'yes'});assert(!pass(site));site=run(site,{site:'dunes',marked:'yes'});assert(pass(site));assert(!pass({...site,config:{...site.config,x:'42'}}));
let payload=m.freshArtifact('plan-a-payload');payload=run(payload,{});assert(!payload.runs[0].result.passed);payload=run(payload,{arm:'no'});assert(pass(payload));assert.equal(payload.runs[1].result.values['余量 kg'],3);
let chassis=m.freshArtifact('tune-a-chassis');chassis=run(chassis,{},'ridge');assert(!pass(chassis));chassis=run(chassis,{clearance:'14'},'ridge');assert(pass(chassis));assert(!pass({...chassis,config:{...chassis.config,speed:'2'}}));
let unfair=m.freshArtifact('tune-a-chassis');unfair=run(unfair,{},'ridge');unfair=run(unfair,{clearance:'14'},'soft');assert(!pass(unfair));
let labels=m.freshArtifact('label-the-terrain');labels=run(labels,Object.fromEntries(m.SAMPLES.filter(s=>s.split==='train').map(s=>[s.id,s.reference])));assert(pass(labels));assert.equal(labels.runs[0].result.steps.length,3);assert.equal(new Set(m.SAMPLES.map(s=>s.id)).size,9);
const changed=m.classify(Object.fromEntries(m.SAMPLES.filter(s=>s.split==='train').map(s=>[s.id,'sand'])),m.SAMPLES[7].features);assert.notEqual(changed,m.classify(labels.config,m.SAMPLES[7].features),'修改训练标签必须真正改变预测');
let rover=m.freshArtifact('assemble-a-rover');rover=run(rover,{});rover=run(rover,{},'camera');assert(!pass(rover),'平台模块不能冒充自制');
rover={...m.freshArtifact('assemble-a-rover'),imports:{chassis},config:{chassis:'mine',reader:'platform',rules:'platform'}};rover=run(rover,{});rover=run(rover,{},'camera');assert(pass(rover));assert(!rover.runs[1].result.passed);assert(rover.runs[1].result.steps.some(s=>s.includes('未知')));
let expedition=m.freshArtifact('run-an-expedition');expedition=run(expedition,{energy:'40'});assert(!pass(expedition),'缺少车辆不能远征');expedition={...m.freshArtifact('run-an-expedition'),imports:{rover,mission:site,payload}};expedition=run(expedition,{});assert(!pass(expedition));expedition=run(expedition,{route:'safe',energy:'24'});assert(pass(expedition));assert.equal(expedition.runs[1].result.values['返航余量点'],2);
assert.equal(expedition.runs[0].result.telemetry.length,0,'未获准出发不能生成完成轨迹或照片');
assert.equal(expedition.runs[1].result.telemetry.at(-1).phase,'回到基地');
assert.equal(expedition.runs[1].result.telemetry.at(-1).energy,2);
assert(expedition.runs[1].result.telemetry.some(f=>f.phase==='观察'&&f.progress===1));
const forgedTelemetry=structuredClone(expedition);forgedTelemetry.runs[1].result.telemetry[0].energy=999;assert(!m.checkedArtifact(forgedTelemetry),'伪造遥测必须拒绝');
for (const original of [site,payload,chassis,labels,rover,expedition]) {
 const forged=structuredClone(original);forged.runs[0].result.steps=[];assert(!m.checkedArtifact(forged),'伪造日志必须拒绝');
 const extra=structuredClone(original);extra.config.cheat='yes';assert(!m.checkedArtifact(extra),'未知参数必须拒绝');
 assert(!m.checkedArtifact({...original,model_version:'future/1'}));
}
const bad=structuredClone(rover);bad.imports.chassis={...bad.imports.chassis,project_id:'assemble-a-rover'};assert(!m.checkedArtifact(bad),'错误模块类型必须拒绝');
const root=path.resolve('packages/student-web/public/project-lines/space-exploration');
for(const id of m.SPACE_IDS){const tree=JSON.parse(fs.readFileSync(path.join(root,id,'course/tree/knowledge_tree.json')));assert.equal(tree.modules.length,3);assert.equal(tree.final_deliverable.module_id,'M03');assert.equal(tree.estimated_minutes,tree.modules.reduce((n,x)=>n+x.estimated_minutes,0));for(const n of tree.modules){assert(fs.readFileSync(path.join(root,id,'course',n.lesson),'utf8').length>400);assert.equal(n.response_prompts.length,2);const resources=JSON.parse(fs.readFileSync(path.join(root,id,'course',n.resources)));assert(resources.some(r=>r.kind==='video'&&(r.youtube_id||r.media_url)));assert(resources.some(r=>r.kind==='reference'));}}
console.log('PASS 六类实验、修改失效、模块真实消费、故障与返航、伪造拒绝、18 个课程节点');
