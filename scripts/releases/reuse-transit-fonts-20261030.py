"""Reuse real, already deployed WOFF2 bytes when Google Fonts is unreachable.

Next's response override only supplies CSS and absolute local font paths. It
does not substitute mock font bytes. Fail closed if the expected families,
subsets, WOFF2 headers, or layout configuration are missing.
"""
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

WEB = Path('/opt/systemedu/packages/student-web')
RELEASE = Path('/opt/systemedu/releases/transit-format-20261030')
output = RELEASE / 'fonts'
output.mkdir(exist_ok=True)
configs = [('Plus_Jakarta_Sans', ['400', '500', '600', '700', '800'], 'swap'),
           ('Manrope', ['400', '500', '600', '700'], 'optional'),
           ('Geist_Mono', None, 'swap')]
layout = (WEB / 'src/app/layout.tsx').read_text()
assert all(f'{name}({{' in layout for name, _, _ in configs)
js = """
const root=process.argv[1]+'/node_modules/next/dist/compiled/@next/font/dist/google/';
const {validateGoogleFontFunctionCall:validate}=require(root+'validate-google-font-function-call.js');
const {getFontAxes}=require(root+'get-font-axes.js');
const {getGoogleFontsUrl}=require(root+'get-google-fonts-url.js');
console.log(JSON.stringify(JSON.parse(process.argv[2]).map(([name,weight,display])=>{
 const p=validate(name,{...(weight?{weight}:{}),subsets:['latin'],display});
 return {family:p.fontFamily,url:getGoogleFontsUrl(p.fontFamily,getFontAxes(p.fontFamily,p.weights,p.styles,p.selectedVariableAxes),display)};
})));
"""
families = json.loads(subprocess.check_output(['node', '-e', js, str(WEB), json.dumps(configs)], text=True))
css = '\n'.join(p.read_text() for p in (WEB / '.next/static/css').glob('*.css'))
faces = list(dict.fromkeys(re.findall(r'@font-face\{([^}]+)\}', css)))
responses, evidence = {}, {}
for item in families:
    family = item['family']
    selected = [face for face in faces if re.search(r"font-family:['\"]?" + re.escape(family) + r"['\"]?;", face)]
    assert selected, f'Missing deployed family: {family}'
    rebuilt, hashes, has_latin = [], {}, False
    for face in selected:
        filename = re.search(r'src:url\(/_next/static/media/([^/)]+\.woff2)\)', face).group(1)
        src = WEB / '.next/static/media' / filename
        data = src.read_bytes()
        assert data[:4] == b'wOF2' and len(data) > 1000
        shutil.copyfile(src, output / filename)
        hashes[filename] = hashlib.sha256(data).hexdigest()
        latin = '.p.' in filename
        has_latin |= latin
        face = face.replace(f'url(/_next/static/media/{filename})', f'url({output / filename})')
        # Next's CSS extractor expects whitespace after src and subset comments.
        face = face.replace('src:url(', 'src: url(').replace(';', ';\n')
        rebuilt.append('/* ' + ('latin' if latin else 'other') + ' */\n@font-face {\n' + face + '\n}')
    assert has_latin
    responses[item['url']] = '\n'.join(rebuilt)
    evidence[family] = {'faces': len(selected), 'files': hashes, 'latin_preloaded': has_latin}
(RELEASE / 'font-responses.json').write_text(json.dumps(responses, indent=2) + '\n')
(RELEASE / 'font-reuse.json').write_text(json.dumps({'passed': True, 'source_build': (WEB / '.next/BUILD_ID').read_text().strip(), 'families': evidence}, indent=2) + '\n')
print(json.dumps({'reused_real_font_families': len(families), 'files': len(list(output.glob('*.woff2')))}))
