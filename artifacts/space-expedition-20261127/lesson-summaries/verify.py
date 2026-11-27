"""Decode all five final films, validate captions/audio, and sample speaking/board frames."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUBLIC = ROOT / 'packages/student-web/public'
work = Path('/tmp/systemedu-five-summary-verification'); work.mkdir(exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 20)
report = []
items = json.loads((HERE / 'dialogue.json').read_text())
for ident, item in items.items():
    file = PUBLIC / f'mission/space/expedition-v2/video/lesson-{ident.lower()}-summary.mp4'
    metadata = json.loads((HERE / ident / 'composition.json').read_text())
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(file), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    volume = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', str(file), '-vn', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', volume.stderr)[1])
    assert -8 < peak < 0
    vtt = file.with_suffix('.vtt').read_text(); previous = 0
    ranges = re.findall(r'00:00:([\d.]+) --> 00:00:([\d.]+)', vtt)
    assert len(ranges) >= 3
    for start, end in ranges:
        assert float(start) >= previous and float(end) > float(start) and float(end) <= metadata['seconds'] + .1
        previous = float(end)
    assert '已经归档' not in vtt and '已归档' not in vtt
    spoken = ''.join(re.findall(r'\d+\n00:00:[^\n]+\n([^\n]+)', vtt))
    assert spoken == item['dialogue']
    row = Image.new('RGB', (1280, 274), '#081925'); draw = ImageDraw.Draw(row)
    draw.text((12, 8), item['title'], font=font, fill='#ffd07b')
    hashes = []
    for index, seconds in enumerate([1.5, 4, 7, metadata['seconds'] - 1]):
        target = work / f'{ident}-{index}.jpg'
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(seconds), '-i', str(file), '-frames:v', '1', '-vf', 'scale=320:180', str(target)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        row.paste(Image.open(target), (index * 320, 40)); hashes.append(hashlib.sha256(target.read_bytes()).hexdigest())
        draw.text((index * 320 + 12, 232), f'{seconds:.1f}s', font=font, fill='white')
    assert len(set(hashes)) == 4
    row.save(HERE / ident / 'contact-sheet.jpg')
    report.append({'ref': item['ref'], 'seconds': metadata['seconds'], 'decode': 'pass', 'max_volume_dB': peak, 'clipping': False, 'caption_sequence': 'pass', 'distinct_sampled_frames': True})
sheet = Image.new('RGB', (1280, 274 * 5))
for index, ident in enumerate(items): sheet.paste(Image.open(HERE / ident / 'contact-sheet.jpg'), (0, 274 * index))
sheet.save(HERE / 'contact-sheet.jpg')
(HERE / 'decode-audio-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'verified_lesson_summaries': len(report), 'decode_audio_captions': 'pass'}))
