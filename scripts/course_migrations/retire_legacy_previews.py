"""One-time development preview redirects. Keeps original pages as migration evidence."""
from pathlib import Path
import json
from molecule_numbering import ROOT, ID_MAP
routes={'m01-discovery':'M01','m02-runtime':'M02','m03-evidence':'M03','m04-controlled':'M04','m05-smiles':'M05','m06-capstone':'M06','m23-pubchem':'M23','m38-multimodal':'M38','m80':'M80','m81':'M81','m87':'M87','m90-workbench':'M90','molecule-batch':'M78','molecule-spatial':'M03','diversity-batch':'M88','lesson-reading':'M04'}
backup=ROOT/'artifacts/molecule-numbering-20260912/preview-before'
if backup.exists():raise ValueError('Already redirected; refusing a second pass')
backup.mkdir(parents=True)
for route,old in routes.items():
 p=ROOT/'packages/student-web/src/app/slide-preview'/route/'page.tsx'
 (backup/(route+'.tsx')).write_bytes(p.read_bytes())
 p.write_text('import {notFound,redirect} from "next/navigation"\nexport default function Page(){if(process.env.NODE_ENV!=="development")notFound();redirect("/slide-preview/molecule-v2/'+ID_MAP[old]+'")}\n')
print(json.dumps({route:ID_MAP[old] for route,old in routes.items()}))
