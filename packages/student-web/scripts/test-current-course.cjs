const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {currentCourse}=require('./course-source-roots.cjs')
test('active consecutive source has 47 exact IDs, 437 slides and a valid manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(currentCourse,'manifest.json')))
 const tree=JSON.parse(fs.readFileSync(path.join(currentCourse,'tree/knowledge_tree.json')))
 assert.equal(tree.numbering_version,'consecutive-v2')
 assert.deepEqual(tree.modules.map(x=>x.module_id),Array.from({length:47},(_,i)=>'M'+String(i+1).padStart(2,'0')))
 let count=0
 for(const node of manifest.knodes){count+=JSON.parse(fs.readFileSync(path.join(currentCourse,node.knode_dir,'slides.json'))).slides.length}
 assert.equal(count,437)
 for(const f of manifest.files){const b=fs.readFileSync(path.join(currentCourse,f.path));assert.equal(b.length,f.size,f.path);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256,f.path)}
})
test('M08 active content is exactly the newly verified 8-slide fixture',()=>{
 const active=JSON.parse(fs.readFileSync(path.join(currentCourse,'knodes/M08-w0-smiles/slides.json')))
 const fixture=require('../../../course_factory/fixtures/molecule-monster-hunter/M08-readonly-v1.json')
 assert.deepEqual(active,fixture)
})
