"""Reuse existing talking shots; synthesize only four changed off-camera sentences."""
import json, shutil, subprocess, logging, hashlib
from pathlib import Path
from systemedu.core.education import tts
logging.disable(logging.CRITICAL)
HERE=Path(__file__).resolve().parent
OLD=HERE.parent/'biomed-stage-films-v2-20261010'
WORK=Path('/tmp/systemedu-biomed-integration-films-20261013');WORK.mkdir(exist_ok=True)
items=json.loads((HERE/'film-scripts.json').read_text());old={i['station']:i for i in json.loads((OLD/'scripts.json').read_text())}
report=[]
for item in items:
 if item['assetVersion']!='v3':continue
 source=OLD/f"stage-{item['source_level']}";folder=WORK/f"stage-{item['level']}";folder.mkdir(exist_ok=True)
 for name in ['source.mp4','audio.json','step1.mp3','step2.mp3','step3.mp3']:shutil.copyfile(source/name,folder/name)
 audio=json.loads((source/'audio.json').read_text())
 for idx,step in enumerate(item['steps']):
  if step['voice']==old[item['station']]['steps'][idx]['voice']:continue
  tts.SYSTEMEDU_HOME=WORK/'tts'
  relative,_=tts.synthesize_speech(step['voice'],'biomed-mission-integration-v3',item['level']*10+idx,'voice.wav')
  subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(tts.SYSTEMEDU_HOME/'media'/relative),'-c:a','libmp3lame','-b:a','128k',str(folder/f'step{idx+1}.mp3')],check=True)
  audio['step_seconds'][idx]=float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(folder/f'step{idx+1}.mp3')]))
 (folder/'audio.json').write_text(json.dumps(audio,indent=2)+'\n')
 report.append({'station':item['station'],'source_sha256':hashlib.sha256((folder/'source.mp4').read_bytes()).hexdigest(),'source_reused':True,'changed_voices':[i+1 for i,s in enumerate(item['steps']) if s['voice']!=old[item['station']]['steps'][i]['voice']]})
 print(json.dumps(report[-1]),flush=True)
(HERE/'film-reuse.json').write_text(json.dumps(report,indent=2)+'\n')
