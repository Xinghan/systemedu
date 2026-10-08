// Public structure acquisition only; no course text is sent to PubChem.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process')
const here=__dirname,root=path.resolve(here,'../../..'),vendor=path.join(root,'packages/student-web/public/vendor/rdkit')
const compounds=[['aspirin','阿司匹林'],['caffeine','咖啡因'],['paracetamol','对乙酰氨基酚'],['ibuprofen','布洛芬'],['warfarin','华法林'],['amoxicillin','阿莫西林'],['sildenafil','西地那非'],['atorvastatin','阿托伐他汀'],['telmisartan','替米沙坦'],['digoxin','地高辛']]
async function main(){
 const rdkit=await require(path.join(vendor,'RDKit_minimal.js'))({locateFile:f=>path.join(vendor,f)})
 const rows=[]
 for(const [id,name] of compounds){
  const url=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${id}/property/SMILES/JSON`
  const cache=path.join(here,'M85-sources',id+'.json');let data
  if(fs.existsSync(cache))data=JSON.parse(fs.readFileSync(cache,'utf8'))
  else {data=JSON.parse(execFileSync('curl',['--fail','--silent','--show-error','--max-time','35',url],{encoding:'utf8'}));fs.mkdirSync(path.dirname(cache),{recursive:true});fs.writeFileSync(cache,JSON.stringify(data,null,2)+'\n')}
  const property=data.PropertyTable.Properties[0],smiles=property.SMILES,mol=rdkit.get_mol(smiles)
  if(!mol)throw new Error('Invalid structure '+id)
  try{const d=JSON.parse(mol.get_descriptors());rows.push({id,name,smiles,mw:d.amw,logp:d.CrippenClogP,hbd:d.NumHBD,hba:d.NumHBA,source_url:`https://pubchem.ncbi.nlm.nih.gov/compound/${property.CID}`,retrieval_url:url,cid:property.CID});console.log(id,property.CID,d.amw,d.CrippenClogP,d.NumHBD,d.NumHBA)}finally{mol.delete()}
 }
 fs.writeFileSync(path.join(here,'M85-descriptors-v1.json'),JSON.stringify({source:'PubChem SMILES; pinned local RDKit.js calculated descriptors, not experimental values.',rdkit_version:rdkit.version(),fields:{mw:'amw (average molecular mass, Da)',logp:'CrippenClogP',hbd:'NumHBD',hba:'NumHBA'},rows},null,2)+'\n')
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
