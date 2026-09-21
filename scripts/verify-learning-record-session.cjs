const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('../packages/student-web/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
let remote,writeRevision,writes=0;class ApiError extends Error{constructor(message,opts={}){super(message);this.status=opts.status}}
const api={read:async()=>remote,save:async(token,scope,body,revision)=>{writes++;writeRevision=revision;return{draft:{revision:revision+1}}}};
const original=Module._load;Module._load=function(request,parent,isMain){if(request==='./api/client')return{ApiError};if(request==='./api/learning-records')return{learningRecords:api};return original.apply(this,arguments)};
const {LearningRecordSession,learningCacheKey}=require('../packages/student-web/src/lib/learning-record-session.ts');Module._load=original;
const cache=new Map();global.localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
const scope={library_slug:'test',module_id:'M01',activity_id:'work',kind:'classroom',content_version:'1'};
const body={answers:[{question_id:'q',question:'Q',answer:'A'}],artifact:{config:{tilt:45,pitch:25},items:[1,2]},client_context:{schema:'test'}};
const reorder=x=>Array.isArray(x)?x.map(reorder):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).reverse().map(([k,v])=>[k,reorder(v)])):x;
async function session(owner,pending){cache.set(learningCacheKey(owner,scope),JSON.stringify({version:1,body,revision:1,dirty:true,...(pending?{pending:{id:'pending-id',body,revision:1}}:{})}));const s=new LearningRecordSession('test-token',owner,scope,{answers:[]});await s.start();return s}
(async()=>{
 remote={draft:{revision:2,body:reorder(body),status:'draft'},submissions:[]};let s=await session('same');assert.equal(s.snapshot().conflict,false);assert.equal(s.snapshot().dirty,false);assert.equal(writes,0);s.update({...body,artifact:{changed:true}});await s.save();assert.equal(writeRevision,2);s.dispose();
 remote={draft:{revision:3,body:{...body,artifact:{different:true}},status:'draft'},submissions:[]};s=await session('different');assert.equal(s.snapshot().conflict,true);assert.deepEqual(s.snapshot().body,body);s.dispose();
 remote={draft:{revision:2,body:reorder(body),status:'draft'},submissions:[]};s=await session('pending',true);assert.equal(s.snapshot().conflict,true);assert.equal(s.snapshot().pending,true);s.dispose();
 remote={draft:{revision:2,body:{...body,artifact:{...body.artifact,items:[2,1]}},status:'draft'},submissions:[]};s=await session('array-order');assert.equal(s.snapshot().conflict,true);s.dispose();
 console.log('PASS: identical saved draft acknowledges lost response; JSONB key order ignored; real edits, array order and pending submissions retain conflict protection.');
})().catch(e=>{console.error(e);process.exitCode=1});
