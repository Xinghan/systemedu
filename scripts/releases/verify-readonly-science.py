"""Execute the authored M03 lecture snippet and verify its reference table."""
import contextlib
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
component = ROOT / 'packages/student-web/src/components/learning/skeleton-readonly.tsx'
code, = re.findall(r'const REPORT_CODE = `([^`]+)`', component.read_text())
output = io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(code, str(component) + ':REPORT_CODE', 'exec'), {})
rows = json.loads((ROOT / 'packages/student-web/src/lib/data/m03-molecules.json').read_text())['rows']
lines = output.getvalue().splitlines()
assert len(lines) == len(rows) == 4
for line, molecule in zip(lines, rows, strict=True):
    smiles, heavy, atoms, bonds, rings, aromatic, mass = line.split()
    assert smiles == molecule['smiles']
    assert int(heavy) == sum(a['element'] != 'H' for a in molecule['atoms'])
    assert int(atoms) == len(molecule['atoms'])
    assert int(bonds) == len(molecule['bonds'])
    assert int(rings) == molecule['rings']
    assert int(aromatic) == molecule['aromaticRings']
    assert abs(float(mass) - molecule['mw']) < 0.001
print(output.getvalue(), end='')
print('PASS: four exact lecture outputs match independent structural fixtures.')
