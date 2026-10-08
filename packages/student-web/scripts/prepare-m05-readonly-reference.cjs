// Generate fixed, provenance-labelled reference data with the installed RDKit.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const root=path.resolve(__dirname,'../src'),file=path.join(root,'lib/smiles-reading.ts'),m={exports:{}}
new Function('exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,m)
const inputs=['CCO','OCC','COC','ClC','[NH4+]','C','N','O','CC','C=C','CCCC','CC(C)C','CCCCCC','C1CCCCC1','c1ccccc1','C1CC','Oc1ccccc1',...m.exports.TARGETS.filter(t=>t.deliverable).map(t=>t.smiles)]
;(async()=>{const rdkit=await require('@rdkit/rdkit')(),examples={}
  for(const input of inputs){try{const {svg,...result}=m.exports.analyzeSmiles(rdkit,input);examples[input]={parsed:true,...result}}catch{examples[input]={parsed:false,input}}}
  const out=path.join(root,'lib/data/m05-readonly-reference.json')
  if(fs.existsSync(out))throw Error('Do not overwrite the frozen reference')
  fs.writeFileSync(out,JSON.stringify({provenance:'Fixed teaching examples computed independently; not a learner record or a measurement.',rdkit_version:rdkit.version(),examples},null,2)+'\n')
  console.log(rdkit.version(),Object.keys(examples).length,'reference inputs; invalid:',Object.values(examples).filter(r=>!r.parsed).map(r=>r.input))
})()
