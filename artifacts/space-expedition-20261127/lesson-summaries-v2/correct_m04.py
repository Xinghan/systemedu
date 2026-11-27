"""Replace an off-topic star-map workbench with a dedicated data-analysis scene.

Keep the approved commander intro and exact display insert; no new speaking actor.
"""
import json
import shutil
import time
from urllib.parse import urlparse
import requests
from dashscope import VideoSynthesis
import generate as g

HERE=g.HERE/'M04';WORK=g.WORK/'M04';TASK=HERE/'data-workbench-task.json'
PROMPT='''原创精致二维日式科研动画，两个镜头，主题是分析一条恒星亮度随时间变化的数据曲线。全部发生在室内的数据分析工作台，绝对不要星空、星图、星系、天体影像或外太空背景。画面主体必须是二维数据曲线，不是星空照片。海军蓝、银白、琥珀金和青蓝配色，细致手绘背景。
镜头1 [0-5秒]：从斜上方俯视黑色不透明触控数据屏。屏幕是一张清楚的平面直角坐标图，细灰色网格，青色观测点在左边平稳，中间出现轻微的U形下降，右边回到平稳。一个琥珀色的窄矩形选区出现在中央下降处。只显示无文字、无数字的网格和点，不绘制任何可读字符。
镜头2 [5-10秒]：硬切到同一块数据屏的近景，只出现一双穿海军蓝科研制服袖口的手，不露脸。左手把选区左边界向左拖，右手把右边界向右拖，两条琥珀色边界分开，把下降前和下降后的平稳观测点一起留在窗口内。屏幕保持不透明的平面数据图，不能变成星图。触控笔最后停在下降旁边。动作克制清晰，分镜显著不同。
镜头中始终只允许网格、观测点、U形下降、矩形选区和操作的手。不要字幕、标签、文字、数字、水印、徽标或人物讲话。'''
(HERE/'data-workbench-prompt.txt').write_text(PROMPT+'\n')
g.dashscope.api_key=g.get_config().tts.api_key
with g._without_proxy_env():
    state=json.loads(TASK.read_text()) if TASK.exists() else {}
    if not state:
        g.save(TASK,{'status':'SUBMITTING'})
        response=VideoSynthesis.async_call(model='wan2.6-t2v',api_key=g.dashscope.api_key,prompt=PROMPT,negative_prompt='星空，星图，星系，太空背景，天体图，照片，真人，人物面孔，文字，数字，英文，乱码，字幕，水印',size='1280*720',duration=10,shot_type='multi',prompt_extend=True,watermark=False,seed=202611297)
        output=response.output or {}
        state=dict(model='wan2.6-t2v',task_id=output.get('task_id'),status=output.get('task_status'),http_status=response.status_code,code=response.code or output.get('code'))
        g.save(TASK,state)
        if response.status_code!=200:raise ValueError(f'Submission failed: {state["code"]}')
    assert state.get('task_id'),'Inspect uncertain submission before retrying'
    source=HERE/'data-workbench-source.mp4'
    while not source.exists():
        response=VideoSynthesis.fetch(task=state['task_id'],api_key=g.dashscope.api_key);output=response.output or {}
        state.update(status=output.get('task_status'),http_status=response.status_code,code=response.code or output.get('code'));g.save(TASK,state)
        print(json.dumps({'M04_data_workbench':state['status']}),flush=True)
        if response.status_code!=200 or state['status'] in ['FAILED','CANCELED','UNKNOWN']:raise ValueError(state.get('code'))
        if state['status']=='SUCCEEDED':
            url=output.get('video_url','');assert urlparse(url).scheme=='https'
            with requests.get(url,timeout=(15,120)) as download:download.raise_for_status();source.write_bytes(download.content)
        else:time.sleep(30)
    original=WORK/'initial-scenes.mp4'
    if not original.exists():shutil.copy2(HERE/'generated-scenes.mp4',original)
    # Use each generated shot at its original speed; trim its ending, never rush the hands.
    # The generated margins contain invented numeric ticks. Reframe inside the plot:
    # keep the animated selection/hands, exclude both unreliable numeric margins.
    # Exact quantities and axes appear only in the separately authored teaching shot.
    reframe='crop=840:472:250:0,scale=1280:720,setsar=1'
    filters=f'[0:v]trim=end=2.416667,setpts=PTS-STARTPTS[a];[1:v]trim=start=0:end=4.083333,setpts=PTS-STARTPTS,fps=24,{reframe}[b];[1:v]trim=start=5:end=9.083333,setpts=PTS-STARTPTS,fps=24,{reframe}[c];[0:v]trim=start=10.583333:end=15,setpts=PTS-STARTPTS[d];[a][b][c][d]concat=n=4:v=1:a=0[v]'
    g.ff('-i',original,'-i',source,'-filter_complex',filters,'-map','[v]','-an','-t',15,'-c:v','libx264','-crf',20,'-pix_fmt','yuv420p',HERE/'generated-scenes.mp4')
    g.save(HERE/'data-workbench-edit.json',{'cuts':[2.416667,6.5,10.583333],'source':'data-workbench-source.mp4','segments':[[0,4.083333],[5,9.083333]],'reframe':reframe,'note':'Crop out unreliable generated numeric margins while preserving animated hands and selection. The two workbench shots have similar colors; use explicit edit boundaries as well as scene detection.'})
    print('M04 corrected scene reel ready for visual review.',flush=True)
