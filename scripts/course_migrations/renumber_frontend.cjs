/** Scoped one-time source migration. Dry run unless --apply; retains exact originals. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'packages/student-web')
const ts = require(path.join(web, 'node_modules/typescript'))
const spec = JSON.parse(fs.readFileSync(path.join(web,'src/lib/data/molecule-numbering-v2.json'),'utf8'))
const ids = Object.fromEntries(spec.modules.map(m=>[m.old,m.new]))
const refs = {...Object.fromEntries(Object.entries({...spec.merged_references,...spec.retired_reference_redirects}).map(([a,b])=>[a,ids[b]])),...ids}
const rewrite = s=>s.replace(/(?<![A-Za-z0-9])M\d{2,3}b?(?![A-Za-z0-9])/g,s=>refs[s]||s)
const visuals='roc-evidence-visual lipinski-evidence-visual diversity-rejection-visual regression-evidence-visual ranking-evidence-visual funnel-evidence-visual logp-lab-visual pubchem-retrieval-visual classification-evidence-visual workbench-evidence-visual molecule-reading-visual rdkit-runtime-visual skeleton-evidence-visual smiles-reading-visual functional-group-visual discovery-brief-visual'.split(' ')
const helpers='pubchem-retrieval logp-lab ranking-evidence rejection-evidence diversity-evidence funnel-evidence lipinski-evidence classification-evidence regression-evidence roc-evidence workbench-evidence molecule-reading'.split(' ')
function convert(file,source){
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS), edits=[]
  function visit(node){
    const eligible=ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)||ts.isJsxText(node)
    if(eligible){
      const raw=node.getText(tree)
      let protectedValue=/\/slide-assets\/|\/vendor\//.test(raw)
      for(let p=node.parent;p;p=p.parent){
        if(ts.isImportDeclaration(p)||ts.isExportDeclaration(p))protectedValue=true
        if(ts.isJsxAttribute(p)&&p.name.getText(tree)==='d')protectedValue=true
        if(ts.isVariableDeclaration(p)&&/_KEY$/.test(p.name.getText(tree)))protectedValue=true
      }
      // A raw path literal is geometry, not a lesson identifier.
      if(/^['"`]M[\d. ,\-]+[A-Z]/.test(raw))protectedValue=true
      const changed=protectedValue?raw:rewrite(raw)
      if(changed!==raw)edits.push([node.getStart(tree),node.getEnd(),changed])
    }
    ts.forEachChild(node,visit)
  }
  visit(tree)
  return edits.sort((a,b)=>b[0]-a[0]).reduce((s,[a,b,r])=>s.slice(0,a)+r+s.slice(b),source)
}
const files=[...visuals.map(f=>'src/components/learning/'+f+'.tsx'),...helpers.map(f=>'src/lib/'+f+'.ts')]
const nav=['src/components/learning/knowledge-tree-modal.tsx','src/components/library/stage-deliverable-card.tsx','src/components/learning/UserKnowledgeTreeView.tsx','src/components/learning/ConceptGalaxy.tsx','src/app/(home)/my-projects/page.tsx','src/app/(home)/library/[slug]/page.tsx','src/app/(home)/home/page.tsx','src/app/(learn)/learn/[slug]/[moduleId]/page.tsx']
const changes=[]
for(const f of [...files,...nav]){
  if(!fs.existsSync(path.join(web,f)))continue
  const before=fs.readFileSync(path.join(web,f),'utf8')
  let after=files.includes(f)?convert(f,before):before
  if(nav.includes(f)){
    after=after.replace(/`\/learn\/\$\{encodeURIComponent\(([^)]+)\)\}\/\$\{encodeURIComponent\(([^)]+)\)\}`/g,(_,slug,id)=>'lessonPath('+slug+', '+id+')')
    after=after.replace('`/learn/${slug}/${moduleId}`','lessonPath(slug, moduleId)')
    if(after!==before)after=after.replace(/(import Link from [^\n]+\n)/,'$1import { lessonPath } from "@/lib/course-numbering"\n')
    if(after!==before&&!after.includes('import { lessonPath }'))after=after.replace(/("use client"\s*\n)/,'$1\nimport { lessonPath } from "@/lib/course-numbering"\n')
    if(after!==before&&!after.includes('import { lessonPath }'))throw Error('Missing import: '+f)
  }
  if(after!==before)changes.push({file:f,before,after})
}
const dest=path.join(root,'artifacts/molecule-numbering-20260912/frontend-before'), apply=process.argv.includes('--apply')
if(apply&&fs.existsSync(dest))throw Error('Original backup already exists; refusing a second mapping pass')
if(apply){
  for(const c of changes){const p=path.join(dest,c.file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c.before);fs.writeFileSync(path.join(web,c.file),c.after)}
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex')
const report=changes.map(c=>({file:c.file,before:sha(c.before),after:sha(c.after)}))
if(apply)fs.writeFileSync(path.join(dest,'../frontend-changes.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({applied:apply,files:report},null,2))
