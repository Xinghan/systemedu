/** Parse JavaScript; rewrite course references in string literals only. Never execute it. */
const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'packages/student-web/node_modules/typescript'))
const spec=JSON.parse(fs.readFileSync(path.join(root,'packages/student-web/src/lib/data/molecule-numbering-v2.json'),'utf8'))
const ids=Object.fromEntries(spec.modules.map(m=>[m.old,m.new]))
const refs={...Object.fromEntries(Object.entries({...spec.merged_references,...spec.retired_reference_redirects}).map(([a,b])=>[a,ids[b]])),...ids}
const token=/(?<![A-Za-z0-9])M\d{2,3}b?(?![A-Za-z0-9])/g
function convert(source){
 const ast=ts.createSourceFile('inline.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),edits=[]
 if(ast.parseDiagnostics.length)throw Error('Inline script parse error; manual review required')
 function visit(n){
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n)){
   const raw=n.getText(ast)
   // Preserve asset URLs, storage keys, chemical literals and geometry.
   let protect=/^['"`](?:https?:|\/|systemedu:|knodes\/|M[-+.\d]+[ ,]+[-+.\d]+)/.test(raw)
   if(ts.isPropertyAssignment(n.parent)&&/^(?:d|path|smiles|SMILES|src|href|id|key)$/.test(n.parent.name.getText(ast)))protect=true
   if(ts.isCallExpression(n.parent)&&/localStorage|sessionStorage|setAttribute/.test(n.parent.expression.getText(ast)))protect=true
   const geometry=[...raw.matchAll(/\bd\s*=\s*(\\?["'])(.*?)\1/g)].map(m=>[m.index,m.index+m[0].length])
   const changed=protect?raw:raw.replace(token,(s,offset)=>geometry.some(([a,b])=>offset>=a&&offset<b)?s:(refs[s]||s))
   if(changed!==raw)edits.push([n.getStart(ast),n.getEnd(),changed])
  }
  ts.forEachChild(n,visit)
 }
 visit(ast)
 return edits.sort((a,b)=>b[0]-a[0]).reduce((s,[a,b,v])=>s.slice(0,a)+v+s.slice(b),source)
}
if(require.main===module)process.stdout.write(convert(fs.readFileSync(0,'utf8')))
module.exports={convert}
