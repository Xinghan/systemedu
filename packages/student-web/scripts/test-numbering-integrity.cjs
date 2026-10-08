const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const root=path.resolve(__dirname,'../../..')
const {convert}=require(path.join(root,'scripts/course_migrations/rewrite_script.cjs'))
function load(file){const m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m);return m.exports}
test('JavaScript translation edits teaching strings, not numeric models, comments, URLs or SVG paths',()=>{
 const input='// M23 historical comment\nconst title="M23 source record";const html=`<path d="M23 30 L51 90"/><text>M51</text>`;const d="M23 30";const n=23;const url="https://example.org/M23";'
 const out=convert(input)
 assert.match(out,/title="M07 source record"/);assert.match(out,/<text>M23<\/text>/)
 assert.match(out,/d="M23 30 L51 90"/);assert.match(out,/const d="M23 30"/);assert.match(out,/const n=23/);assert.match(out,/https:\/\/example.org\/M23/);assert.match(out,/\/\/ M23 historical comment/)
})
test('browser record copy is one-time, non-destructive, and respects a later clear',()=>{
 const {migrateRetrievalStorage}=load('numbering-storage.ts'),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},old='systemedu:molecule:M23:retrieval:v1',current='systemedu:molecule:M07:retrieval:v1'
 data.set(old,'historical learner text M23');migrateRetrievalStorage(storage);assert.equal(data.get(current),data.get(old));assert.equal(data.get(old),'historical learner text M23');data.delete(current);migrateRetrievalStorage(storage);assert.equal(data.has(current),false)
 const other=new Map([[old,'old'],[current,'new']]);migrateRetrievalStorage({getItem:k=>other.get(k)??null,setItem:(k,v)=>other.set(k,v)});assert.equal(other.get(current),'new')
})
test('versioned route is parsed before deriving tutor module ID',()=>{
 const source=fs.readFileSync(path.join(root,'packages/student-web/src/lib/hooks/use-page-kind.ts'),'utf8')
 const expression=source.match(/const ml = pathname.match\((.+)\)/)[1],regex=new Function('return '+expression)()
 assert.deepEqual('/learn/molecule-monster-hunter/v2/M07'.match(regex).slice(1),['molecule-monster-hunter','M07'])
 assert.deepEqual('/learn/mars/M23'.match(regex).slice(1),['mars','M23'])
})
test('source migration did not change frontend JSX path geometry',()=>{
 const dir=path.join(root,'artifacts/molecule-numbering-20260912'),changes=JSON.parse(fs.readFileSync(path.join(dir,'frontend-changes.json')))
 const geometry=s=>[...s.matchAll(/\bd\s*=\s*"[^"]*"/g)].map(m=>m[0])
 for(const c of changes.filter(c=>c.file.endsWith('.tsx')&&!c.file.startsWith('src/app/(learn)'))){
  const old=fs.readFileSync(path.join(dir,'frontend-before',c.file),'utf8'),current=fs.readFileSync(path.join(root,'packages/student-web',c.file),'utf8');assert.deepEqual(geometry(current),geometry(old),c.file)
 }
})
