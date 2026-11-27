"""Verify final media independently of generation; render contact sheets for visual review."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
PUBLIC=ROOT/'packages/student-web/public'
story=json.loads((ROOT/'packages/ios-app/content/space-expedition.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',20)
work=Path('/tmp/systemedu-film-verification');work.mkdir(exist_ok=True)
report=[]; audio_report=[]
for ident in json.loads((HERE/'dialogue.json').read_text()):
    file=PUBLIC/f'mission/space/expedition-v2/video/{ident}-complete.mp4'
    if not (HERE/ident/'composition.json').exists(): continue
    chapter=next(c for c in story['chapters'] if c['id']==ident)
    metadata=json.loads((HERE/ident/'composition.json').read_text())
    subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(file),'-f','null','-'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    volume=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-i',str(file),'-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
    peak=float(re.search(r'max_volume: (-?[\d.]+) dB',volume.stderr)[1]);assert peak < 0
    audio_report.append({'chapter':ident,'max_volume_dB':peak,'clipping':False})
    vtt=file.with_suffix('.vtt').read_text();previous=0
    for start,end in re.findall(r'00:00:([\d.]+) --> 00:00:([\d.]+)',vtt):
        assert float(start)>=previous and float(end)>float(start) and float(end)<=metadata['seconds']+.1
        previous=float(end)
    row=Image.new('RGB',(960,210),'#081925');draw=ImageDraw.Draw(row)
    draw.text((12,8),chapter['title'],font=font,fill='#ffd07b')
    hashes=[]
    for i,seconds in enumerate([2,6,metadata['seconds']-1]):
        target=work/f'{ident}-{i}.jpg'
        subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(seconds),'-i',str(file),'-frames:v','1','-vf','scale=320:180',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        row.paste(Image.open(target),(i*320,30));hashes.append(hashlib.sha256(target.read_bytes()).hexdigest())
    row.save(HERE/ident/'contact-sheet.jpg')
    report.append({'chapter':ident,'decode':'pass','different_sampled_frames':len(set(hashes))==3,'seconds':metadata['seconds']})
for start in range(0,len(report),5):
    items=report[start:start+5];sheet=Image.new('RGB',(960,210*len(items)))
    for i,item in enumerate(items):sheet.paste(Image.open(HERE/item['chapter']/'contact-sheet.jpg'),(0,210*i))
    sheet.save(HERE/f'contact-sheet-{start//5+1}.jpg')
(HERE/'decode-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(HERE/'audio-verification.json').write_text(json.dumps(audio_report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified_closings':len(report),'all_decode':True}))
