// Public compound identifiers only. No lesson content or personal data is transmitted.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const here = __dirname, root = path.resolve(here, '../../..')
const vendor = path.join(root, 'packages/student-web/public/vendor/rdkit')
const compounds = [['water','水','H2O'],['methane','甲烷','CH4'],['ethanol','乙醇','C2H6O'],['benzene','苯','C6H6']]
function fetchCached(name, url) {
  const file = path.join(here, 'M03-sources', name)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  const text = execFileSync('curl', ['--fail','--silent','--show-error','--retry','2','--max-time','40',url], {encoding:'utf8'})
  fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file,text)
  return text
}
function parseSdf(sdf) {
  const lines = sdf.split(/\r?\n/)
  if (!lines[3]?.includes('V2000')) throw new Error('Expected V2000')
  const na=Number(lines[3].slice(0,3)), nb=Number(lines[3].slice(3,6))
  const atoms=lines.slice(4,4+na).map((l,i)=>({id:i,element:l.slice(31,34).trim(),position:[Number(l.slice(0,10)),Number(l.slice(10,20)),Number(l.slice(20,30))]}))
  const bonds=lines.slice(4+na,4+na+nb).map(l=>({a:Number(l.slice(0,3))-1,b:Number(l.slice(3,6))-1,order:Number(l.slice(6,9))}))
  if (!atoms.length || atoms.some(a=>a.position.some(v=>!Number.isFinite(v)))) throw new Error('Invalid coordinates')
  if (bonds.some(b=>b.a<0||b.b<0||b.a>=na||b.b>=na)) throw new Error('Invalid bond endpoint')
  return {atoms,bonds}
}
async function main() {
  const rdkit=await require(path.join(vendor,'RDKit_minimal.js'))({locateFile:f=>path.join(vendor,f)})
  const rows=[]
  for(const [id,name,formula] of compounds) {
    const propertyUrl=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${id}/property/SMILES/JSON`
    const prop=JSON.parse(fetchCached(id+'.json',propertyUrl)).PropertyTable.Properties[0]
    const sdfUrl=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${prop.CID}/SDF?record_type=3d`
    const sdf=fetchCached(id+'.sdf',sdfUrl), geometry=parseSdf(sdf)
    const mol=rdkit.get_mol(prop.SMILES), fromSdf=rdkit.get_mol(sdf)
    if(!mol||!fromSdf) throw new Error('RDKit rejected '+id)
    try {
      fromSdf.remove_hs_in_place()
      if(mol.get_smiles()!==fromSdf.get_smiles()) throw new Error('SDF topology differs from SMILES '+id)
      const d=JSON.parse(mol.get_descriptors()), graph=JSON.parse(mol.get_json()).molecules[0]
      const aromaticAtoms=graph.extensions?.find(e=>e.name==='rdkitRepresentation')?.aromaticAtoms || []
      rows.push({id,name,formula,smiles:prop.SMILES,cid:prop.CID,...geometry,heavyAtoms:d.NumHeavyAtoms,totalAtoms:d.NumAtoms,mw:d.amw,rings:d.NumRings,aromaticRings:d.NumAromaticRings,aromaticAtoms,sourceUrl:`https://pubchem.ncbi.nlm.nih.gov/compound/${prop.CID}`,sdfUrl,sdfSha256:crypto.createHash('sha256').update(sdf).digest('hex')})
      console.log(id,'CID',prop.CID,'atoms',geometry.atoms.length,'heavy',d.NumHeavyAtoms,'rings',d.NumRings)
    } finally {mol.delete();fromSdf.delete()}
  }
  const out={provenance:'PubChem computed 3D conformer; not an experimental structure or molecular dynamics. Coordinates in angstrom. RDKit validates graph identity.',retrieved:'2026-09-08',rdkitVersion:rdkit.version(),rows}
  const file=path.join(root,'packages/student-web/src/lib/data/m03-molecules.json')
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n')
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
