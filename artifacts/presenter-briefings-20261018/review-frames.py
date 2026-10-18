"""Contact sheets for human inspection, never runtime artwork."""
from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw,ImageFont
H=Path(__file__).resolve().parent;items=json.loads((H/'scripts.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20)
for line in dict.fromkeys(f['line'] for f in items):
 group=[f for f in items if f['line']==line];sheet=Image.new('RGB',(1440,8*238),(18,23,30));draw=ImageDraw.Draw(sheet)
 for row,f in enumerate(group):
  folder=H/line/f['station'];source=folder/'source.mp4'
  if not source.exists():continue
  draw.text((8,row*238+4),f"{f['level']:02} {line} / {f['station']}",font=font,fill='white')
  for col,t in enumerate([1,3,5,7]):
   frame=folder/f'review-{t}.jpg'
   if not frame.exists():subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(source),'-vf','scale=360:202','-frames:v','1',str(frame)],check=True)
   sheet.paste(Image.open(frame).convert('RGB'),(col*360,row*238+32))
 sheet.save(H/f'{line}-all-shots.jpg',quality=90)
