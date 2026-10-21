"""Narrate authored briefing segments using the existing course TTS configuration."""
import concurrent.futures,json,logging,subprocess
from pathlib import Path
from systemedu.core.education import tts
logging.disable(logging.CRITICAL)
HERE=Path(__file__).resolve().parent
items=json.loads((HERE/'scripts.json').read_text())
tts.SYSTEMEDU_HOME=Path('/tmp/systemedu-energy-mission-voices-20261010')
def run(job):
 item,index,text=job;folder=HERE/f"stage-{item['level']}";folder.mkdir(exist_ok=True);target=folder/f'voice-{index}.mp3'
 if not target.exists():
  relative,_=tts.synthesize_speech(text,'energy-laboratory-mission-v1',item['level']*10+index,'voice.wav')
  subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(tts.SYSTEMEDU_HOME/'media'/relative),'-c:a','libmp3lame','-b:a','128k',str(target)],check=True)
 seconds=float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(target)]))
 return item['level'],index,seconds
jobs=[(item,index,text) for item in items for index,text in enumerate([item['dialogue']]+[s['voice'] for s in item['steps']])]
results={i['level']:[0]*4 for i in items}
with tts._without_proxy_env():
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for level,index,seconds in pool.map(run,jobs):
   results[level][index]=seconds;print(json.dumps({'level':level,'segment':index,'seconds':seconds}),flush=True)
for level,seconds in results.items():(HERE/f'stage-{level}'/'audio.json').write_text(json.dumps({'seconds':seconds,'lengths':[s+.6 for s in seconds]},indent=2)+'\n')
