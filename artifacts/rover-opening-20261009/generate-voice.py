"""Use the project's configured TTS; never log credentials or signed audio URLs."""
import json
import subprocess
from pathlib import Path
from systemedu.core.education import tts

ROOT = Path(__file__).resolve().parents[2]
tts.SYSTEMEDU_HOME = Path('/tmp/systemedu-rover-voice-20261009')
items = json.loads(Path(__file__).with_name('dialogue.json').read_text())
out = ROOT / 'packages/student-web/public/mission/rover/audio'
out.mkdir(parents=True, exist_ok=True)
for index, item in enumerate(items):
    target = out / f"{item['id']}.mp3"
    if target.exists():
        continue
    relative, _ = tts.synthesize_speech(item['text'], 'rover-opening', index, 'voice.wav')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i',
                    str(tts.SYSTEMEDU_HOME / 'media' / relative), '-codec:a', 'libmp3lame',
                    '-b:a', '96k', str(target)], check=True)
    print(f"saved {target.name}: {target.stat().st_size} bytes", flush=True)
