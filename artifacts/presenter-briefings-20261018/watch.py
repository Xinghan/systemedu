"""Finish existing tasks only; never submits new paid requests."""
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import contextlib,io,json,time
import generate as g
import compose as c
H=Path(__file__).resolve().parent
futures={};last=None
with ThreadPoolExecutor(max_workers=2) as encoders, g._without_proxy_env(),g.verified_curl():
 for cycle in range(80):
  errors=[]
  for item in g.SCRIPTS:
   d=g.folder(item);key=item['line']+'/'+item['station'];state=json.loads((d/'task.json').read_text())
   if state.get('task_id') and (state.get('status') not in ['SUCCEEDED','FAILED','CANCELED'] or not (d/'source.mp4').exists()):
    try:
     # Provider details stay in per-task redacted state, not noisy console logs.
     with contextlib.redirect_stdout(io.StringIO()):g.video(item,'fetch')
    except Exception as e:errors.append({'item':key,'error':type(e).__name__})
    time.sleep(.3)
   state=json.loads((d/'task.json').read_text())
   if state.get('status')=='SUCCEEDED' and (d/'source.mp4').exists() and key not in futures:
    futures[key]=encoders.submit(c.compose,item)
  counts=Counter(json.loads(p.read_text()).get('status') for p in H.glob('*/*/task.json'))
  completed=sum(f.done() and not f.exception() for f in futures.values());failed=[k for k,f in futures.items() if f.done() and f.exception()]
  summary={'provider':dict(counts),'composed':completed,'compose_failed':failed,'fetch_errors':errors}
  (H/'progress.json').write_text(json.dumps(summary,indent=2)+'\n')
  if summary!=last:print(json.dumps(summary),flush=True);last=summary
  if completed==40:break
  if counts.get('FAILED') or counts.get('CANCELED') or failed:raise RuntimeError('Review failed tasks; no resubmission performed')
  time.sleep(45)
 else:raise TimeoutError('Tasks remain pending; retained for later fetch without resubmission')
