const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('../../packages/student-web/node_modules/typescript');
const source=fs.readFileSync('packages/student-web/src/lib/rover-opening.ts','utf8');
const code=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
const scope={exports:{}};vm.runInNewContext(code,scope);const m=scope.exports;
const full={...m.EMPTY_MISSION,observed:['rock','sand','target'],checkpoint:'plan'};
const stop=m.finishAttempt(full,'direct');assert.equal(stop.checkpoint,'stopped');
const win=m.finishAttempt(stop,'detour');assert.equal(win.checkpoint,'capture');assert.equal(win.attempts.length,2);
const done={...win,checkpoint:'complete',photo:{x:63,y:36,zoom:1.8}};
assert.equal(m.readMission(JSON.parse(JSON.stringify(done))).checkpoint,'complete');
for(const invalid of [null,{}, {...done,version:2},{...done,photo:null},{...done,photo:{x:NaN,y:36,zoom:1.8}},{...done,observed:['sand','sand','sand']},{...done,attempts:[{route:'direct',outcome:'arrived'}]}, {...done,observed:[]}]) assert.equal(m.readMission(invalid),m.EMPTY_MISSION);
for(const x of [45,63,80])for(const y of [20,36,55])for(const zoom of [1.3,1.8,2.4]){const c=m.photoCrop({x,y,zoom},1672,941);assert(c.sx>=0&&c.sy>=0&&c.sx+c.sw<=1672.0001&&c.sy+c.sh<=941.0001);assert(Math.abs(c.sw/c.sh-1.5)<.00001)}
const lines=JSON.parse(fs.readFileSync('artifacts/rover-opening-20261009/dialogue.json'));for(const item of lines)assert.equal(m.DIALOGUE[item.id],item.text);
console.log('PASS: restoration, corrupt data rejection, attempt history, crop bounds, voice/caption parity.');
