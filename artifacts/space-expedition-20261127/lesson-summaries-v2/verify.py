"""Validate five scene-led films, not merely distinct hashes from a talking head."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageStat

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
PUBLIC=ROOT/'packages/student-web/public'
WORK=Path('/tmp/systemedu-v2-verification');WORK.mkdir(exist_ok=True)
ITEMS=json.loads((HERE/'storyboards.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',19)
report=[]

def extract(file,t,target,width=320):
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(t),'-i',str(file),'-frames:v','1','-vf',f'scale={width}:-2',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    return Image.open(target).convert('RGB')

for ident,item in ITEMS.items():
    folder=HERE/ident;timeline=json.loads((folder/'timeline.json').read_text());meta=json.loads((folder/'composition.json').read_text())
    file=PUBLIC/f'mission/space/expedition-v2/video/lesson-{ident.lower()}-summary.mp4'
    probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-show_format','-of','json',str(file)]))
    assert any(s['codec_name']=='h264' and s['width']==1280 and s['height']==720 and s['pix_fmt']=='yuv420p' for s in probe['streams'])
    assert any(s['codec_name']=='aac' and s['sample_rate']=='48000' for s in probe['streams'])
    assert 26<float(probe['format']['duration'])<36
    subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(file),'-f','null','-'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    audio=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-i',str(file),'-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
    peak=float(re.search(r'max_volume: (-?[\d.]+) dB',audio.stderr)[1]);assert -16<peak<0
    detected=meta['detected_scene_cuts'];cuts=meta.get('edit_cuts') or detected
    assert len(cuts)>=3 and 1.5<cuts[0]<4.5
    assert len(detected)>=(2 if meta.get('edit_cuts') else 3)
    assert 9<meta['generated_scene_seconds']<13
    vtt=file.with_suffix('.vtt').read_text()
    ranges=re.findall(r'(\d\d):(\d\d):(\d\d\.\d+) --> (\d\d):(\d\d):(\d\d\.\d+)',vtt)
    assert len(ranges)==len(timeline['cues'])+1
    previous=0
    for hh,mm,ss,eh,em,es in ranges:
        start=int(hh)*3600+int(mm)*60+float(ss);end=int(eh)*3600+int(em)*60+float(es)
        assert start>=previous and start<end<=meta['seconds']+.06;previous=end
    for cue in timeline['cues']:assert cue['text'] in vtt
    assert '已经归档' not in vtt
    sample_times=[1,(cuts[0]+cuts[1])/2,(cuts[1]+cuts[2])/2,13.4]
    sample_times += [(cue['start']+cue['end'])/2 for cue in timeline['cues'] if cue['section']=='demo']
    sample_times += [meta['seconds']-.4]
    sheet=Image.new('RGB',(1280,416),'#081925');draw=ImageDraw.Draw(sheet)
    for i,t in enumerate(sample_times):
        pic=extract(file,t,WORK/f'{ident}-final-{i}.png');x=i%4*320;y=i//4*208
        sheet.paste(pic,(x,y));draw.text((x+8,y+183),f'{ident} / {t:.1f}s',font=font,fill='#ffd080')
    sheet.save(folder/'final-storyboard.jpg')
    source=folder/'generated-scenes.mp4'
    rawsheet=Image.new('RGB',(1280,528),'#081925');draw=ImageDraw.Draw(rawsheet)
    for i,t in enumerate([1,3.8,6,8,10.5,13]):
        pic=extract(source,t,WORK/f'{ident}-source-{i}.png',426);x=i%3*426;y=i//3*264
        rawsheet.paste(pic,(x,y));draw.text((x+8,y+240),f'{ident} / {t:.1f}s',font=font,fill='white')
    rawsheet.save(folder/'generated-scene-review.jpg')
    # The rendered teaching process must change during its first narrated step.
    cue=next(q for q in timeline['cues'] if q['section']=='demo')
    a=extract(file,cue['start']+.15*(cue['end']-cue['start']),WORK/f'{ident}-motion-a.png')
    b=extract(file,cue['start']+.85*(cue['end']-cue['start']),WORK/f'{ident}-motion-b.png')
    # Compare only the instructional area, excluding the moving playback bar/footer.
    # A few new measured points are meaningful motion despite occupying little of the frame.
    delta=ImageChops.difference(a.crop((12,38,308,144)),b.crop((12,38,308,144)))
    difference=sum(ImageStat.Stat(delta).mean)/3
    assert difference>.1, f'{ident}: teaching area is static (difference {difference:.3f})'
    report.append(dict(ref=f'lightkurve-transit-detective:{ident}',seconds=float(probe['format']['duration']),decode='pass',audio_peak_dB=peak,clipping=False,first_scene_change=cuts[0],detected_scene_cuts=detected,edit_cuts=meta.get('edit_cuts'),display_closeup_replaced_at=meta['generated_scene_seconds'],teaching_motion_pixel_change=round(difference,3),captions='sentence-aligned',sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
sheet=Image.new('RGB',(1280,416*len(ITEMS)))
for i,ident in enumerate(ITEMS):sheet.paste(Image.open(HERE/ident/'final-storyboard.jpg'),(0,416*i))
sheet.save(HERE/'all-five-storyboards.jpg')
(HERE/'media-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified_films':len(report),'decode_audio_captions_scene_changes_motion':'pass'}))
