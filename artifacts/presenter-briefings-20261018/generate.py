"""Authored character shots; persisted tasks prevent duplicate paid submissions."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
import argparse,json,logging,os,subprocess,sys
import requests
from dashscope import VideoSynthesis
from systemedu.core.config import get_config
from systemedu.core.education.tts import _without_proxy_env
logging.disable(logging.CRITICAL)
H=Path(__file__).resolve().parent; R=H.parents[1]; P=R/'packages/student-web/public'
PEOPLE=json.loads((H/'presenters.json').read_text());SCRIPTS=json.loads((H/'scripts.json').read_text())
def save(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def ff(*args):subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',*map(str,args)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def duration(path):return float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(path)]))
def folder(f):p=H/f['line']/f['station'];p.mkdir(parents=True,exist_ok=True);return p

def voice(f):
 d=folder(f);person=PEOPLE[f['line']];raw=d/'voice.aiff';text=d/'voice.txt';text.write_text(f['dialogue'])
 if not raw.exists():subprocess.run(['say','-v',person['voice'],'-r','175','-f',str(text),'-o',str(raw)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 seconds=duration(raw);speed=max(1,seconds/8.8)
 if speed>1.2:raise ValueError('Script too long')
 ff('-i',raw,'-af',f'atempo={speed},adelay=500:all=1,apad,atrim=duration=10','-c:a','libmp3lame','-b:a','128k',d/'input-10s.mp3')
 save(d/'audio.json',dict(seconds=seconds,speed=speed,speech_start=.5,speech_end=.5+seconds/speed,voice=person['voice']))
 prompt=f"写实电影单镜头，延续参考图中同一位中国{person['role']}{person['name']}的身份、面容、发型、衣着和真实实验室。第一人称学生视角，研究员向坐在对面的学生讲述任务。自然、专注、友好，保持眼神交流。前0.5秒自然眨眼，之后严格跟随提供的中文音频讲话，台词为‘{f['dialogue']}’。说话时有一次小幅开放手势和轻微点头，手保持正常形状，不触摸器材，不遮挡脸。音频结束时合嘴，自然停顿，不添加台词。稳定固定中景，无切镜，背景设备稳定。真实皮肤与自然口型，无夸张动作，不加字幕、文字、水印、额外人物。"
 (d/'prompt.txt').write_text(prompt+'\n');print(json.dumps({'line':f['line'],'station':f['station'],'voice_seconds':round(seconds,2)}),flush=True)

def video(f,action):
 d=folder(f);state_path=d/'task.json';target=d/'source.mp4';key=get_config().tts.api_key or os.environ.get('DASHSCOPE_API_KEY');previous=json.loads(state_path.read_text()) if state_path.exists() else {}
 if not key:raise ValueError('Provider not configured')
 if action=='submit':
  if previous:return print(json.dumps({'line':f['line'],'station':f['station'],'skipped_existing_task':True}),flush=True)
  with state_path.open('x') as fp:json.dump({'line':f['line'],'station':f['station'],'status':'SUBMITTING'},fp)
  response=VideoSynthesis.async_call(model='wan2.6-i2v',api_key=key,img_url=(P/f"mission/{f['line']}/video/posters/presenter-v2.webp").as_uri(),audio_url=(d/'input-10s.mp3').as_uri(),prompt=(d/'prompt.txt').read_text(),negative_prompt='换脸，人物变形，夸张笑容，嘴型不同步，机械动作，多余手指，融化的手，屏幕扭曲，镜头切换，字幕，文字，额外人物',resolution='1080P',duration=10,prompt_extend=False,watermark=False,seed=202610180+list(PEOPLE).index(f['line'])*8+f['level'])
 else:
  if not previous.get('task_id'):raise ValueError('No accepted task to fetch')
  if previous.get('status')=='SUCCEEDED' and target.exists():return print(json.dumps({'line':f['line'],'station':f['station'],'cached':True}),flush=True)
  response=VideoSynthesis.fetch(task=previous['task_id'],api_key=key)
 out=response.output or {};state={'line':f['line'],'station':f['station'],'model':'wan2.6-i2v','resolution':'1080P','duration':10,'http_status':response.status_code,'task_id':out.get('task_id') or previous.get('task_id'),'status':out.get('task_status'),'code':response.code or out.get('code')};save(state_path,state)
 print(json.dumps(state),flush=True)
 if response.status_code!=200:raise ValueError('Provider request failed')
 if state['status']=='SUCCEEDED':
  url=out.get('video_url');parsed=urlparse(url or '')
  if parsed.scheme!='https' or not parsed.hostname:raise ValueError('No secure result')
  with requests.get(url,stream=True,timeout=(15,120))as result:
   result.raise_for_status();temp=target.with_suffix('.download')
   with temp.open('wb')as fp:
    for chunk in result.iter_content(1024*1024):fp.write(chunk)
   temp.replace(target)
  state.update(local_video=str(target.relative_to(R)),bytes=target.stat().st_size);save(state_path,state)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['voice','submit','fetch']);parser.add_argument('--line');parser.add_argument('--station');parser.add_argument('--workers',type=int,default=3);args=parser.parse_args();items=[f for f in SCRIPTS if(not args.line or f['line']==args.line)and(not args.station or f['station']==args.station)]
 def work(f):
  try:voice(f) if args.action=='voice' else video(f,args.action);return True
  except Exception as e:print(json.dumps({'line':f['line'],'station':f['station'],'error_type':type(e).__name__,'no_resubmission':True}),flush=True);return False
 with _without_proxy_env():
  with ThreadPoolExecutor(max_workers=args.workers)as pool:results=list(pool.map(work,items))
 sys.exit(0 if all(results) else 1)
