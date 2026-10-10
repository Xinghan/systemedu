// Create reviewed, scoped patch artifacts; no production access.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../..'),web=path.join(root,'packages/student-web'),out=path.join(root,'artifacts/lesson-reader-20260909')
fs.mkdirSync(out,{recursive:true})
const filters={
 'src/components/learning/course-content-view.tsx':line=>line<890||line>=1913,
 'src/lib/api/gateway.ts':()=>true,
 'src/lib/types/api.ts':line=>line===668||line===740,
 'src/lib/i18n/locales.ts':line=>line===294||line===935,
}
const patches=[]
for(const [file,accept] of Object.entries(filters)){
 const diff=cp.execFileSync('git',['diff','--unified=3','--','packages/student-web/'+file],{cwd:root,encoding:'utf8'})
 const hunks=diff.split(/(?=^@@ )/m).slice(1)
 const chunks=hunks.filter(h=>accept(Number(h.match(/^@@ -(\d+)/)[1]))).map(h=>{
  const lines=h.split('\n').slice(1).filter(l=>l&&[' ','+','-'].includes(l[0]));
  return {before:lines.filter(l=>l[0]!=='+').map(l=>l.slice(1)).join('\n')+'\n',after:lines.filter(l=>l[0]!=='-').map(l=>l.slice(1)).join('\n')+'\n'}
 })
 if(!chunks.length)throw Error('No selected changes for '+file)
 patches.push({file,chunks})
}
const teacher='src/components/learning/teacher-scene-view.tsx',marker='/** 按 slide.kind',teacherText=fs.readFileSync(path.join(web,teacher),'utf8')
if(!teacherText.includes(marker))throw Error('Missing teacher marker')
const files=Object.fromEntries(['src/components/learning/lesson-slides.tsx','src/lib/lesson-slide-layout.ts','src/lib/normalize-slides.ts'].map(f=>[f,fs.readFileSync(path.join(web,f),'utf8')]))
const payload={patches,files,teacher:{file:teacher,marker,prefix:teacherText.split(marker)[0]},expectedLocalTeacherTail:crypto.createHash('sha256').update(marker+teacherText.split(marker).slice(1).join(marker)).digest('hex')}
fs.writeFileSync(path.join(out,'delta.json'),JSON.stringify(payload,null,2)+'\n')
// Run existing carousel tests against the actual staged production sources.
const tests=fs.readFileSync(path.join(web,'scripts/test-lesson-carousel.cjs'),'utf8').replace("['course-content-view.tsx', 'lesson-reading-preview.tsx']","['course-content-view.tsx']").replace("path.resolve(__dirname, '../src/components/learning')","path.join(process.env.READER_ROOT, 'src/components/learning')")
fs.writeFileSync(path.join(out,'test-lesson-carousel.cjs'),tests)
console.log(JSON.stringify({files:[...patches.map(p=>p.file),teacher,...Object.keys(files)],hunks:patches.map(p=>({file:p.file,count:p.chunks.length}))}))
