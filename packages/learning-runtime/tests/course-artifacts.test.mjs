import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
const result=await build({entryPoints:['src/course-artifacts.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {receiveCourseArtifact}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const freeze={period:1,epoch:132,duration:.08,tolerance:.1,trend_window_day:2,quality_bitmask:0,min_support:3,frozen_at:'2026-11-17T00:00:00Z'}
const checkpoint=state=>({type:'systemedu-lightkurve-checkpoint',moduleId:'M24',artifact:{kind:'validation',title:'Q4',data:state}})
test('frozen prediction is acknowledged only after durable persistence and cannot be replaced',async()=>{
 let stored={},replies=[],committed=false
 await receiveCourseArtifact(checkpoint({freeze,firstResult:null}),'M24','lab',stored,async s=>{await Promise.resolve();stored=s;committed=true},s=>{assert.ok(committed);replies.push(s)})
 assert.equal(replies[0].state.freeze.period,1)
 await receiveCourseArtifact(checkpoint({freeze:{...freeze,period:1.2},firstResult:null}),'M24','lab',stored,async()=>assert.fail('must not overwrite frozen parameters'),s=>replies.push(s))
 assert.equal(replies.at(-1).state.freeze.period,1)
})
test('held-out observations cannot be requested without a saved prediction',async()=>{
 const previous=globalThis.fetch;let fetched=false;globalThis.fetch=async()=>{fetched=true;throw Error()}
 try {const replies=[];await receiveCourseArtifact({type:'systemedu-lightkurve-request-holdout',moduleId:'M25'},'M25','lab',{},async()=>{},s=>replies.push(s));assert.equal(fetched,false);assert.equal(replies[0].type,'systemedu-lightkurve-error')} finally {globalThis.fetch=previous}
})
test('artifact messages from another module are rejected',async()=>{
 const accepted=await receiveCourseArtifact({type:'systemedu-pvlib-artifact',moduleId:'M02',artifact:{value:3}},'M01','lab',{},async()=>assert.fail(),()=>assert.fail())
 assert.equal(accepted,false)
})
