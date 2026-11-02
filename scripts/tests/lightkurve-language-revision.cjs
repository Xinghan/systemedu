const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const repo=path.resolve(__dirname,'../..'),root=path.join(repo,'packages/student-web/src'),source=process.env.LIGHTKURVE_SOURCE;
assert(source,'Set LIGHTKURVE_SOURCE to the revised course directory');
const old=JSON.parse(fs.readFileSync(path.join(source,'audit/language-revision-20261101/previous-assessments.json'),'utf8'));
const ts=require('../../packages/student-web/node_modules/typescript');
const originalResolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){let target=name.startsWith('@/')?path.join(root,name.slice(2)):name;const candidate=target.startsWith('.')?path.resolve(path.dirname(args[0].filename),target):target;if(fs.existsSync(candidate+'.ts'))target=candidate+'.ts';return originalResolve.call(this,target,...args)};
require.extensions['.ts']=(m,filename)=>m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,filename);
const compat=require(root+'/lib/lightkurve-language-revision.ts'),data=require(root+'/lib/lightkurve-language-revision.json');
const {LearningRecordSession,learningCacheKey}=require(root+'/lib/learning-record-session.ts');
const {responseState,responseComplete}=require(root+'/lib/project-lines/guided-response.ts');
const fp=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,32),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cache=new Map();global.localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
(async()=>{
 for(let i=1;i<=32;i++){
  const m='M'+String(i).padStart(2,'0'),dir=`knodes/${m}-w0-module`,r=read(`${source}/${dir}/learning-record.json`),o=old[m].record,assignment=fs.readFileSync(`${source}/${dir}/assignment.md`,'utf8'),previous=fp({record:o,assignment:old[m].assignment}),version=compat.lightkurveRecordVersion(m,fp({record:r,assignment}));
  assert.equal(version,previous,m);assert.equal(compat.lightkurveRecordVersion(m,'future-version'),'future-version');
  for(const kind of ['quiz','exam'])for(const [j,q]of (r[kind]||[]).entries()){
   const oq=o[kind][j];assert.equal(q.id,oq.id);assert.equal(q.correct,oq.correct);for(const [n,label]of oq.options.entries())assert.equal(compat.lightkurveChoiceIndex(m,version,kind,q.id,q.options,`${n+1}. ${label}`),n);
   assert.equal(compat.lightkurveChoiceIndex(m,version,kind,q.id,q.options,'1. Unreviewed wording'),-1);
   assert.equal(compat.lightkurveChoiceIndex(m,'future-version',kind,q.id,q.options,'1. Unreviewed wording'),-1);
  }
  const body={answers:[{question_id:'q1',question:o.questions[0],answer:'旧版完整回答，保留原话。'}],artifact:{kind:'validation',title:'Original first result',data:{freeze:{period:.837,epoch:100},firstResult:{depth:.001}}}};
  for(const [kind,activity]of [['classroom','lightkurve-notebook'],['assignment','lightkurve-delivery'],['quiz','lightkurve-quiz'],['exam','lightkurve-exam']]){
   const scope={library_slug:'lightkurve-transit-detective',module_id:m,activity_id:activity,kind,content_version:previous};
   cache.set(learningCacheKey('guest',scope),JSON.stringify({version:1,body,revision:0,dirty:true}));
   const session=new LearningRecordSession(null,'guest',{...scope,content_version:version},{answers:[]});await session.start();assert.deepEqual(session.snapshot().body,body);session.dispose();
  }
  assert.equal(responseState(body,0,r.response_prompts?.[0]).mode,'free');assert(responseComplete(body,0,r.response_prompts?.[0]));
 }
 for(const [key,v]of Object.entries(data.theories)){
  const [m,id]=key.split('/');assert.equal(compat.lightkurveTheoryVersion('lightkurve-transit-detective',m,id,v.fingerprint),v.previous);assert.equal(compat.lightkurveTheoryVersion('other-course',m,id,v.fingerprint),v.fingerprint);assert.equal(compat.lightkurveTheoryVersion('lightkurve-transit-detective',m,id,'future'),'future');
 }
 console.log(JSON.stringify({passed:true,lessons:32,restoredScopes:128,theoryQuestions:Object.keys(data.theories).length,checks:['Exact reviewed version mapping','Old answer choices remain selected','First-result artifacts restore unchanged','Original prose answers remain editable','Other courses and future versions are isolated']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
