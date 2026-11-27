"""Generate only five requested lesson closings, using the accepted Lin Lan voice.

Reuse the existing resumable Wan pipeline. No learner identity or photograph is sent.
The commander is actual generated animation; the ending is an exact teaching diagram.
"""
import argparse
import concurrent.futures
import importlib.util
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('chapter_films', HERE.parent / 'chapter-film-pairs/generate.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
ITEMS = json.loads((HERE / 'dialogue.json').read_text())
base.HERE = HERE
base.WORK = Path('/tmp/systemedu-five-lesson-summaries')
base.DIALOGUE = {key: value['dialogue'] for key, value in ITEMS.items()}

def font(size):
    return ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', size)

def board(ident, path):
    image = Image.new('RGB', (1280, 720), '#071725')
    d = ImageDraw.Draw(image)
    gold, pale, muted = '#ffca71', '#c6e3ef', '#8ca9bb'
    d.text((58, 34), ITEMS[ident]['title'], font=font(26), fill=gold)
    d.text((58, 89), ITEMS[ident]['takeaway'], font=font(43), fill='white')
    d.rounded_rectangle((58, 168, 1222, 526), radius=22, fill='#102b3e')
    def label(x, y, text, size=28, fill=pale): d.text((x, y), text, font=font(size), fill=fill)
    def arrow(x1, y1, x2, y2):
        d.line((x1, y1, x2, y2), fill=gold, width=4)
        d.polygon([(x2,y2),(x2-13,y2-8),(x2-13,y2+8)],fill=gold)
    if ident == 'M01':
        label(98, 207, '观测到的现象', 31, gold)
        label(98, 265, '同一测量方式下，读数降低')
        arrow(525, 292, 650, 292)
        label(692, 207, '需要继续检验的解释', 31, gold)
        for i, text in enumerate(['遮挡？', '恒星自身变化？', '测量过程变化？']): label(710, 265+i*48, text)
        label(98, 442, '下降是调查起点，单独一个低点不能确认行星。', 28)
    elif ident == 'M02':
        d.ellipse((126,240,246,360), fill='#ffca71')
        label(106, 391, 'Kepler-10', 32, 'white'); label(145,437,'恒星',24)
        arrow(278, 302, 488, 302); label(350,255,'星光',24)
        d.rounded_rectangle((520,245,690,345), radius=18, fill='#a4c8dc')
        d.ellipse((496,245,548,345),fill='#4b718c')
        label(547,391,'Kepler',32,'white'); label(538,437,'空间望远镜',24)
        arrow(728,302,850,302)
        label(888,217,'观测记录',30,gold)
        for i,text in enumerate(['时间  |  通量','每行对应一次测量','还要核对来源与单位']): label(868,285+i*54,text,25)
    elif ident in ['M03', 'M04']:
        d.line((166,222,166,455,1125,455),fill=muted,width=3)
        values=[100,100,100,99,97,96,97,99,100,100,100]
        pts=[(215+i*78,260+(100-v)*30) for i,v in enumerate(values)]
        if ident == 'M04':
            d.rounded_rectangle((432,226,860,450),radius=12,outline=gold,width=3)
            label(470,184,'候选区间：保留下降前后',23,gold)
        for x,y in pts: d.ellipse((x-6,y-6,x+6,y+6),fill=pale)
        for i in [0, 5, 10]:
            x=215+i*78; d.line((x,455,x,461),fill=muted,width=2); label(x-8,461,str(i),17)
        label(350,490,'时间 / 秒（构造示例）',20)
        label(190,192,'模拟读数',23)
        label(105,250,'100',20); label(115,370,'96',20)
        if ident == 'M03':
            x,y=pts[5]; d.ellipse((x-12,y-12,x+12,y+12),outline=gold,width=3)
            label(710,317,'第 5 秒，读数 96',24,gold)
        else:
            label(230,405,'前',25,gold); label(960,405,'后',25,gold)
        label(785,473,'示意数据，非 Kepler-10 实测',20,muted)
    else:
        entries=[('问题','为什么调查'),('来源','哪份观测文件'),('标注图','时间、亮度与单位'),('区间','位置与选择理由')]
        for i,(name,desc) in enumerate(entries):
            x=90+i*281
            d.rounded_rectangle((x,215,x+255,371),radius=16,outline=muted,width=2)
            label(x+22,241,name,32,gold); label(x+22,310,desc,23)
        label(201,426,'观察  /  可能解释  /  尚待检查',32,'white')
    label(58, 568, '下一步  →  ' + ITEMS[ident]['next'], 30, gold)
    label(58, 629, '林岚 · 星际远航科研指挥官', 22, muted)
    label(58, 675, 'Music: Firmament_Active · PeriTune · CC BY 4.0', 18, muted)
    image.save(path)

def compose(ident, work, speech_end):
    talk_end = min(15, speech_end + .6)
    total = talk_end + 5
    board(ident, work / 'board.png')
    ff = base.ff
    ff('-i', work/'source.mp4', '-i', work/'input.mp3', '-map', '0:v:0', '-map', '1:a:0', '-t', talk_end,
       '-vf', 'scale=1280:720,fps=24', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', work/'talk.mp4')
    ff('-loop', '1', '-i', work/'board.png', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', 5,
       '-vf', 'fps=24', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', work/'ending.mp4')
    filters = f'[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][voice];[2:a]atrim=duration={total},asetpts=PTS-STARTPTS,loudnorm=I=-24:TP=-3:LRA=7,aresample=48000,volume=\'if(lt(t,{speech_end}),0.398,0.398+0.602*min((t-{speech_end})/0.8,1))\':eval=frame,afade=t=in:d=0.6,afade=t=out:st={total-1.1}:d=1.1[bg];[voice][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=0[a]'
    out = base.MEDIA / 'video' / ('lesson-' + ident.lower() + '-summary')
    credit = 'Music: Firmament_Active by PeriTune. ' + base.CREDIT['sourceURL'] + ' CC BY 4.0 ' + base.CREDIT['licenseURL'] + ' Changes: excerpt, normalization, ducking, fades, voiceover mix.'
    ff('-i', work/'talk.mp4', '-i', work/'ending.mp4', '-i', base.MUSIC, '-filter_complex', filters,
       '-map', '[v]', '-map', '[a]', '-t', total, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-metadata', 'comment='+credit, str(out)+'.mp4')
    ff('-ss', 3, '-i', work/'source.mp4', '-frames:v', 1, '-vf', 'scale=960:-2', str(out)+'-poster.jpg')
    cues=['WEBVTT','']; start=.4
    for i,part in enumerate(filter(None,re.split('(?<=[。])',ITEMS[ident]['dialogue']))):
        end=start+(speech_end-.4)*len(part)/len(ITEMS[ident]['dialogue'])
        cues += [str(i+1),f'00:00:{start:06.3f} --> 00:00:{end:06.3f}',part,''];start=end
    cues += ['scene',f'00:00:{talk_end:06.3f} --> 00:00:{total:06.3f}',ITEMS[ident]['takeaway']+' · '+ITEMS[ident]['next'],'']
    Path(str(out)+'.vtt').write_text('\n'.join(cues))
    base.save(HERE/ident/'composition.json',{'seconds':base.duration(str(out)+'.mp4'),'talk_end':talk_end,'musicCredit':base.CREDIT,'voice_source':'original commander TTS, no pitch or speed changes','ref':ITEMS[ident]['ref']})

base.compose = compose

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('lessons',nargs='*');parser.add_argument('--boards-only',action='store_true');args=parser.parse_args()
    chosen=args.lessons or list(ITEMS)
    assert set(chosen) <= set(ITEMS)
    if args.boards_only:
        for ident in chosen:
            target=HERE/ident;target.mkdir(exist_ok=True);board(ident,target/'teaching-board.png')
    else:
        base.dashscope.api_key=base.get_config().tts.api_key
        failed=[]
        with base._without_proxy_env(), concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            tasks={pool.submit(base.produce, ident):ident for ident in chosen}
            for task in concurrent.futures.as_completed(tasks):
                try:task.result()
                except Exception as error:
                    failed.append(tasks[task]);print(json.dumps({'lesson':tasks[task],'error':type(error).__name__,'message':str(error)[:150],'no_automatic_resubmission':True}),flush=True)
        raise SystemExit(bool(failed))
