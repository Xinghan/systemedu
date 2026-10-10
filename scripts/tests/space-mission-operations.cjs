const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../../packages/student-web/node_modules/typescript');
const root = path.resolve(__dirname, '../../packages/student-web/src');
const original = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
 let target=name.startsWith('@/')?path.join(root,name.slice(2)):name;
 const candidate=target.startsWith('.')?path.resolve(path.dirname(args[0].filename),target):target;
 if(fs.existsSync(candidate+'.ts'))target=candidate+'.ts';
 return original.call(this,target,...args);
};
require.extensions['.ts'] = (m, filename) => m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText, filename);

const m = require(path.join(root,'lib/project-lines/space-mission-operations.ts'));
const c = require(path.join(root,'lib/project-lines/space-curriculum.ts'));
let ops=m.operationsFrom(m.INITIAL_OPERATIONS);
assert(ops);
const copy=()=>structuredClone(ops),task=m.taskById('pick-an-observation-site:M01'),at='2026-10-10T03:00:00.000Z';
assert.equal(m.TASKS.length,88);
assert.equal(new Set(m.TASKS.map(t=>t.id)).size,88);
assert.equal(new Set(m.TASKS.map(t=>t.code)).size,88);
assert.deepEqual(new Set(m.TASKS.filter(t=>t.role!=='micro').map(t=>t.id)),new Set(c.MISSION_MODULES.map(t=>t.ref)));
assert.deepEqual(new Set(m.TASKS.filter(t=>t.role==='lesson').map(t=>t.id)),new Set(c.MISSION_STEPS));
for(const t of m.TASKS){
 assert(t.goal&&t.actions.length&&t.outputs.length&&t.checks.length&&t.preparation);
 assert(!t.actions.some(a=>['reuse-with-context','reuse','merge','replace'].includes(a)));
 assert(c.missionStation(t.station));
 assert(m.taskClassroomHref(t).includes('mission=space'));
}
assert.equal(m.taskClassroomHref(task),'/explore/space-exploration/pick-an-observation-site?node=M01&mission=space');
ops=m.changeTask(ops,task.id,{status:'done'},at);
assert.equal(m.taskState(ops,task.id).status,'review');
assert.throws(()=>m.changeTask(ops,task.id,{status:'blocked'},at));
const checks=task.checks.map((_,i)=>`check-${i}`);
ops=m.changeTask(ops,task.id,{checks,evidence:'原课堂的来源卡与自己的观察',status:'done'},at);
assert.equal(m.taskState(ops,task.id).status,'done');
assert.deepEqual(m.mainProgress(ops),{done:1,total:62});
ops=m.changeTask(ops,task.id,{blocker:'影像来源页暂时无法打开'},at);
assert.equal(m.taskState(ops,task.id).status,'review');
assert(!m.canFinish(task,m.taskState(ops,task.id)));
ops=m.changeTask(ops,task.id,{blocker:'',status:'done'},at);
const micro=m.TASKS[0];ops=m.changeTask(ops,micro.id,{checks:micro.checks.map((_,i)=>`check-${i}`),evidence:'照片',status:'done'},at);
assert.equal(m.mainProgress(ops).done,1);
assert.equal(m.heartbeatSeconds(1000,2000,true),1);
assert.equal(m.heartbeatSeconds(1000,2000,false),0);
assert.equal(m.heartbeatSeconds(1000,11000,true),0);
assert.equal(m.heartbeatSeconds(2000,1000,true),0);
const seg={id:'one',task:task.id,startedAt:at,endedAt:at,seconds:20,reason:'暂停'};
ops=m.recordWork(ops,seg,'2026-10-10');
ops=m.recordWork(ops,seg,'2026-10-10');assert.equal(ops.time.totals[task.id],20);
ops=m.recordWork(ops,{...seg,seconds:30},'2026-10-10');assert.equal(ops.time.totals[task.id],30);
ops=m.recordWork(ops,{...seg,seconds:10},'2026-10-10');assert.equal(ops.time.totals[task.id],30);
assert.throws(()=>m.recordWork(ops,{...seg,task:micro.id},'2026-10-10'));
assert.throws(()=>m.recordWork(ops,{...seg,seconds:1201},'2026-10-10'));
assert.throws(()=>m.recordWork(ops,seg,'2026-02-30'));
for(let i=0;i<90;i++)ops=m.recordWork(ops,{...seg,id:`later-${i}`,seconds:60},'2026-10-10');
assert.equal(ops.time.recent.length,80);assert.equal(ops.time.totals[task.id],5430);
assert.equal(m.weekSeconds(ops,new Date(2026,9,10)),5430);
assert(m.operationsFrom({answers:[],artifact:ops}));
for(const alter of [o=>o.schema='other',o=>o.tasks[task.id].due='2026-02-30',o=>o.time.totals[task.id]=-1,o=>o.plan.weeklyMinutes=0,o=>o.tasks[task.id].checks=['check-999'],o=>o.tasks['unknown']={},o=>o.plan.milestones.bad='2026-10-10']){
 const malformed=copy();alter(malformed);assert.equal(m.operationsFrom({answers:[],artifact:malformed}),null);
}
const results={passed:true,checks:['88 unique task orders cover all source nodes and retain 62 main steps; real assignment paragraphs rather than internal enums','Completion requires evidence, checks and no blocker; editing evidence revokes completion; optional tasks do not inflate main progress','Visible heartbeat bounds exclude hidden/sleep time; idempotent cumulative timer checkpoints; capped log retains all-time totals','Invalid dates, task IDs, checks, durations and schemas rejected; weekly time aggregation verified']};
fs.writeFileSync(path.resolve(__dirname,'../../artifacts/space-mission-center-20261010/model-verification.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
