"""Generate deterministic instructional chemistry evidence, not measured activity."""
import json
from pathlib import Path
from rdkit import Chem, DataStructs, rdBase
from rdkit.Chem import rdFingerprintGenerator, Draw
from rdkit.Chem.Scaffolds import MurckoScaffold

ROOT = Path(__file__).resolve().parents[3]
SMILES = [
    ("苯", "c1ccccc1"), ("甲苯", "Cc1ccccc1"), ("乙苯", "CCc1ccccc1"),
    ("苯酚", "Oc1ccccc1"), ("苯胺", "Nc1ccccc1"), ("氟苯", "Fc1ccccc1"),
    ("氯苯", "Clc1ccccc1"), ("苯甲酸", "O=C(O)c1ccccc1"),
    ("吡啶", "c1ccncc1"), ("嘧啶", "c1cncnc1"), ("噻吩", "c1ccsc1"),
    ("呋喃", "c1ccoc1"), ("环己烷", "C1CCCCC1"), ("哌啶", "N1CCCCC1"),
    ("萘", "c1ccc2ccccc2c1"), ("吲哚", "c1ccc2[nH]ccc2c1"),
]
gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
rows, fps = [], []
for i, (name, smiles) in enumerate(SMILES):
    mol = Chem.MolFromSmiles(smiles)
    assert mol is not None
    scaffold = MurckoScaffold.GetScaffoldForMol(mol)
    fp = gen.GetFingerprint(mol)
    fps.append(fp)
    draw = Draw.MolDraw2DSVG(320, 180)
    draw.drawOptions().clearBackground = False
    Draw.rdMolDraw2D.PrepareAndDrawMolecule(draw, mol)
    draw.FinishDrawing()
    svg = draw.GetDrawingText()
    svg = svg[svg.index('<svg'):]
    scaffold_draw = Draw.MolDraw2DSVG(320, 180)
    scaffold_draw.drawOptions().clearBackground = False
    Draw.rdMolDraw2D.PrepareAndDrawMolecule(scaffold_draw, scaffold)
    scaffold_draw.FinishDrawing()
    scaffold_svg = scaffold_draw.GetDrawingText()
    scaffold_svg = scaffold_svg[scaffold_svg.index('<svg'):]
    rows.append(dict(id=f"D{i+1:02d}", name=name, smiles=Chem.MolToSmiles(mol),
                     scaffold=Chem.MolToSmiles(scaffold), bits=list(fp.GetOnBits()),
                     score=round(.98-i*.02, 2), svg=svg, scaffoldSvg=scaffold_svg))
matrix = [[DataStructs.TanimotoSimilarity(a,b) for b in fps] for a in fps]
out = dict(version="diversity-v1", rdkit=rdBase.rdkitVersion,
           provenance="教师构造的 16 个简单结构示例；RDKit 验证结构并计算 Morgan 指纹和 Murcko 骨架。分数人为设置，非活性预测、实验或药物名单；不是 M87 合成 ID 的真实结构。",
           fingerprint=dict(type="Morgan", radius=2, nBits=2048, includeChirality=False),
           rows=rows, matrix=matrix)
dest = ROOT / 'packages/student-web/src/lib/data/diversity-pool.json'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
print(f"16 structures validated; {len(set(r['scaffold'] for r in rows))} scaffolds; {dest.stat().st_size} bytes")
