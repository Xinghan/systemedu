"""冻结教学数据；运行前将原始 ESOL CSV 放在参数路径。无需访问账号或私有数据。"""
import csv
import hashlib
import json
import sys
from pathlib import Path
from rdkit import Chem, rdBase
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
from rdkit.Chem.Scaffolds import MurckoScaffold

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'packages/student-web/src/lib/project-lines/biomed-data.json'
raw = Path(sys.argv[1]).read_bytes()
digest = hashlib.sha256(raw).hexdigest()
if digest != '8c06a76f0c6487d29ab0f903e6a7a7139f189ab3c1178f159c8be8964602f189':
    raise ValueError('输入不是 v1 固定的数据文件；更新数据需要显式升级课程版本。')
expected = '108af2176a5f876c2df1df922baadb02d647c826'
rows, seen = [], set()
for index, row in enumerate(csv.DictReader(raw.decode().splitlines())):
    mol = Chem.MolFromSmiles(row['smiles'].strip())
    if mol is None:
        continue
    smiles = Chem.MolToSmiles(mol)
    if smiles in seen:
        continue
    seen.add(smiles)
    scaffold = MurckoScaffold.MurckoScaffoldSmiles(mol=mol)
    # 无环分子共用一个骨架，不能为了配比拆散这一组。
    group = scaffold or '[acyclic]'
    bucket = int(hashlib.sha256(('biomed-v1:' + group).encode()).hexdigest()[:8], 16) % 10
    split = 'train' if bucket < 6 else 'validation' if bucket < 8 else 'blind'
    rows.append(dict(id=f'ESOL-{index+1:04d}', name=row['Compound ID'].strip(), smiles=smiles,
                     scaffold=group, split=split, mw=round(Descriptors.MolWt(mol), 3),
                     logp=round(Descriptors.MolLogP(mol), 4), psa=round(Descriptors.TPSA(mol), 3),
                     rings=rdMolDescriptors.CalcNumRings(mol),
                     measured=float(row['measured log solubility in mols per litre'])))
selected = []
for split, count in [('train', 48), ('validation', 16), ('blind', 16)]:
    candidates = sorted((r for r in rows if r['split'] == split), key=lambda r: hashlib.sha256(r['smiles'].encode()).hexdigest())
    selected.extend(candidates[:count])
assert len(selected) == 80
assert not any(set(r['scaffold'] for r in selected if r['split']==a) & set(r['scaffold'] for r in selected if r['split']==b) for a,b in [('train','validation'),('train','blind'),('validation','blind')])

models = []
for id_, name, smiles, cid in [('ethanol', '乙醇', 'CCO', 702), ('aspirin', '阿司匹林', 'CC(=O)Oc1ccccc1C(=O)O', 2244), ('caffeine', '咖啡因', 'Cn1c(=O)c2c(ncn2C)n(C)c1=O', 2519)]:
    mol = Chem.MolFromSmiles(smiles)
    flat = Chem.Mol(mol)
    AllChem.Compute2DCoords(flat)
    space = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 20260921
    assert AllChem.EmbedMolecule(space, params) == 0
    AllChem.MMFFOptimizeMolecule(space)
    # 原子索引保留：显式氢添加在重原子之后；2D 表示省略氢，不谎称完全原子图。
    def xyz(conf, i):
        p = conf.GetAtomPosition(i)
        return [round(p.x, 5), round(p.y, 5), round(p.z, 5)]
    models.append(dict(id=id_, name=name, cid=cid, smiles=Chem.MolToSmiles(mol), formula=rdMolDescriptors.CalcMolFormula(mol),
                       mw=round(Descriptors.MolWt(mol), 3),
                       atoms=[dict(element=a.GetSymbol(), position=xyz(space.GetConformer(), a.GetIdx()), flat=xyz(flat.GetConformer(), a.GetIdx()) if a.GetIdx()<mol.GetNumAtoms() else None) for a in space.GetAtoms()],
                       bonds=[dict(a=b.GetBeginAtomIdx(), b=b.GetEndAtomIdx(), order=b.GetBondTypeAsDouble()) for b in space.GetBonds()]))

data = dict(version='esol-classroom/1', source=dict(url=f'https://raw.githubusercontent.com/deepchem/deepchem/{expected}/datasets/delaney-processed.csv',
    sha256=digest, checked_at='2026-09-21', original_rows=1128, rdkit=rdBase.rdkitVersion,
    target='measured log solubility in mols per litre', units='log10(mol/L)',
    split='SHA256(biomed-v1:Murcko骨架)模10按6/2/2分组；每组再按规范SMILES哈希取48/16/16。无环分子共组，重复规范SMILES保留第一行。',
    descriptors='MW、MolLogP、TPSA、环数由同版本 RDKit 从 SMILES 重新计算；不使用原表 ESOL predicted 列。',
    limitations='教学小样本，不是完整 ESOL 基准；骨架不重叠不保证统计代表性。分子 3D 为 ETKDGv3/MMFF 计算构象，不是显微照片或实验测得结构。'), molecules=selected, models=models)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
public = ROOT / 'packages/student-web/public/project-lines/biomedicine/data'
public.mkdir(parents=True, exist_ok=True)
(public / 'source.json').write_text(json.dumps(data['source'], ensure_ascii=False, indent=2) + '\n')
with (public / 'esol-classroom.csv').open('w') as out:
    writer = csv.DictWriter(out, fieldnames=list(selected[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(selected)
print('80 molecules; 48/16/16 scaffold-disjoint; three computed molecular models; SHA256', digest)
