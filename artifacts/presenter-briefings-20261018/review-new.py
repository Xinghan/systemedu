from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
h=Path(__file__).resolve().parent;r=json.loads((h/'visual-review.json').read_text());done={(x['line'],x['station'])for x in r['reviewed']};items=[p for p in sorted(h.glob('*/*/contact-sheet.jpg'))if(p.parent.parent.name,p.parent.name)not in done][:6]
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20);out=Image.new('RGB',(1440,max(1,len(items))*302),(18,23,30));d=ImageDraw.Draw(out)
for i,p in enumerate(items):
 im=Image.open(p);d.text((8,i*302+4),p.parent.parent.name+'/'+p.parent.name,font=font,fill='white')
 for col,n in enumerate([0,2,3]):out.paste(im.crop(((n%3)*480,(n//3)*270,(n%3+1)*480,(n//3+1)*270)),(col*480,i*302+30))
out.save('/tmp/presenter-review-current.jpg');batch=[{'line':p.parent.parent.name,'station':p.parent.name}for p in items];Path('/tmp/presenter-review-current.json').write_text(json.dumps(batch));print(batch)
