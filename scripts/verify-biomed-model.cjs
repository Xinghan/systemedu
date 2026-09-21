const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('../packages/student-web/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const m=require('../packages/student-web/src/lib/project-lines/biomed-model.ts');
const levels=require('../packages/student-web/src/lib/project-lines/levels.ts');
for(const [kind,level] of [['micro',1],['guided',2],['integration',3],['full',5]])assert.equal(levels.projectLevel(kind),level);
assert.equal(levels.projectLevel('integration',4),4);
for(const [split,count] of [['train',48],['validation',16],['blind',16]])assert.equal(m.pool(split).length,count);
for(const [a,b] of [['train','validation'],['train','blind'],['validation','blind']]){
  assert(!m.pool(a).some(x=>m.pool(b).some(y=>x.scaffold===y.scaffold||x.smiles===y.smiles)));
}
const c={...m.DEFAULT_CONFIG,method:'knn3',features:'three',join:'id'};
const molecule=m.pool('validation')[0],prediction=m.predict(c,molecule);
assert.equal(prediction,m.predict(c,{...molecule,measured:10000}),'预测不读取待预测对象的答案');
const train=m.pool('train');const average=train.reduce((a,x)=>a+x.measured,0)/48;
assert(Math.abs(m.predict({...c,method:'mean'},molecule)-average)<.0001);
assert.equal(m.methodKey({...c,method:'mean',features:'mass'}),m.methodKey({...c,method:'mean',features:'three'}));
const normal=m.evaluate(c,'pipeline'),fault=m.evaluate({...c,join:'row'},'diagnostic'),fixed=m.evaluate(c,'diagnostic');
assert(!fault.aligned);assert(fixed.aligned);assert.deepEqual(fixed.rows,normal.rows);
assert(normal.spent<=normal.budget);const transfer=m.evaluate(c,'transfer');assert(transfer.spent<=transfer.budget);assert(transfer.budget<normal.budget);
let a=m.newWorkspace();assert(m.validWorkspace(a));assert(!m.deliveryChecks('filter',a).every(x=>x.passed));
a=m.runWorkspace(a,'filter');a.config={...a.config,maxMass:450};a=m.runWorkspace(a,'filter');a.reason='测试：比较两版筛选';a.limitation='测试：不是药效证明';assert(m.deliveryChecks('filter',a).every(x=>x.passed));
const original=structuredClone(a);a.config.maxMass=425;assert(!m.deliveryChecks('filter',a).every(x=>x.passed),'改版必须重测');
const forged=structuredClone(original);forged.runs[0].result.selected=999;assert(!m.validWorkspace(forged),'结果必须可复算');
const unknown=m.evaluate({...c,missing:'hold'},'filter').rows.at(-1);assert.equal(unknown.mass,null);assert(!unknown.selected);
let research=m.newWorkspace();research.config={...c,method:'mean'};research=m.runWorkspace(research,'validation');const reg=m.register(research.config,'自动化测试问题',.1,'预先规定的测试标准');assert(m.validRegistration(reg));
research=m.reveal(research,reg);const first=JSON.stringify(research.firstBlind);research.config={...c,method:'knn3'};research=m.runWorkspace(research,'blind');research.selectedError=m.pool('blind')[0].id;research.reason='测试方法变更';research.limitation='测试小样本';research.conclusion='第一次未达标也可交付';assert(m.validWorkspace(research));assert(m.deliveryChecks('challenge',research).every(x=>x.passed));assert.equal(first,JSON.stringify(m.reveal(research,m.register(c,'替换',4,'理由')).firstBlind),'第一次结果不能覆盖');
reg.predictions[0].value=999;assert(!m.validRegistration(reg));
const root=path.resolve('packages/student-web/public/project-lines/biomedicine');let nodes=0;
const catalog=JSON.parse(fs.readFileSync('packages/student-web/src/lib/project-lines/biomed-courses.json'));
for(const project of catalog){assert(fs.statSync(path.join('packages/student-web/public', project.coverImage.replace(/^\//, ''))).size>100000);if(project.kind==='micro')continue;const course=JSON.parse(fs.readFileSync(path.join(root,project.id,'course/tree/knowledge_tree.json')));assert.equal(course.modules.length,project.learningNodes);assert.equal(course.estimated_minutes,course.modules.reduce((n,x)=>n+x.estimated_minutes,0));let videos=0;for(const node of course.modules){nodes++;assert(fs.readFileSync(path.join(root,project.id,'course',node.lesson),'utf8').length>400);const resources=JSON.parse(fs.readFileSync(path.join(root,project.id,'course',node.resources)));assert(resources.some(r=>r.kind==='reference'));videos+=resources.filter(r=>r.kind==='video').length;assert.equal(node.response_prompts.length,2)}assert(videos>0);assert.equal(course.final_deliverable.module_id,m.LAST_NODE[m.PROJECT_KINDS[project.id]])}
assert.equal(nodes,19);
console.log('PASS 80 个真实样本、骨架隔离、无目标泄漏、真实筛选与预算、接口故障、旧版失效、冻结预测和原结果、19 个课程节点、6 张生成封面');
console.log(JSON.stringify({validationMAE:m.evaluate(c,'validation').mae,blindMAE:m.evaluate(c,'blind').mae,selected:normal.selected,transferSelected:transfer.selected}));
