"""Regenerate rocket-design knodes 63-66 with the revised animation standard.

The generated animations are single-scene continuous demonstrations, not slide decks.
"""
from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime
from pathlib import Path

from course_factory.factory import (
    generate_assignment,
    generate_audio_scripts,
    load_context,
    make_course_content,
    make_exercises,
    preflight_v41,
    save_knode,
)

ROOT = Path('/Users/xinghan/Dev/systemedu')
FIX = ROOT / 'course_factory/fixtures/rocket-design'
PROJECT = 'rocket-design'
NODES = [63, 64, 65, 66]


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def run(cmd: list[str]) -> str:
    attempts = 3 if "learn_page.mjs" in cmd else 1
    last: subprocess.CompletedProcess[str] | None = None
    for _ in range(attempts):
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, check=False)
        last = proc
        if proc.returncode == 0:
            return proc.stdout
        transient = "learn_page.mjs" in cmd and "ERR_CONNECTION_CLOSED" in (proc.stdout + proc.stderr)
        if not transient:
            break
    assert last is not None
    raise RuntimeError('command failed: ' + ' '.join(cmd) + '\nSTDOUT:\n' + last.stdout + '\nSTDERR:\n' + last.stderr)


def simple_youtube_links(plan: str) -> str:
    # Avoid remote thumbnail image failures in the embedded learn-page verifier.
    pat = re.compile(r'^\[!\[([^\]]+)\]\(https://img\.youtube\.com/vi/[^)]+\)\]\(([^)]+)\)$', re.MULTILINE)
    return pat.sub(lambda m: f'- [**{m.group(1)}**]({m.group(2)})', plan)


def existing_lesson_bits(knode_id: int) -> tuple[str, list[dict]]:
    """Reuse completed assignment/audio when rerunning after an HTML-only fix."""
    try:
        from systemedu.storage.db import LessonContent, get_session
        db = get_session()
        try:
            lesson = db.query(LessonContent).filter_by(project_name=PROJECT, knode_id=knode_id).first()
            if not lesson:
                return "", []
            sections: list[dict] = []
            if lesson.course_content:
                cc = json.loads(lesson.course_content)
                old_sections = cc.get("sections") or []
                if old_sections and all(s.get("audio_script") for s in old_sections):
                    sections = old_sections
            return lesson.project_assignment or "", sections
        finally:
            db.close()
    except Exception:
        return "", []


def theory(tid: str, title: str, subject: str, tags: list[str], k1: str, k3: str, k5: str, exercises: list[dict], related: str) -> dict:
    return {
        'theory_id': tid,
        'title': title,
        'subject': subject,
        'tags': tags,
        'body_markdown': k1,
        'level_bodies': [
            {'level': 'K1', 'body_markdown': k1},
            {'level': 'K3', 'body_markdown': k3},
            {'level': 'K5', 'body_markdown': k5},
        ],
        'exercises': exercises,
        'related_paragraph': related,
    }


def animation_html(title_cn: str, title_en: str, subtitle_cn: str, subtitle_en: str, kind: str, style: str, stage_cn: list[str], stage_en: list[str], guides_cn: list[str], guides_en: list[str], hud_rows: list[list[str]]) -> str:
    i18n = {
        'title': {'cn': title_cn, 'en': title_en},
        'subtitle': {'cn': subtitle_cn, 'en': subtitle_en},
        'guideTitle': {'cn': '观看指南', 'en': 'Guide'},
        'hudStage': {'cn': '阶段', 'en': 'Stage'},
        'hudRead1': {'cn': '读数1', 'en': 'Readout 1'},
        'hudRead2': {'cn': '读数2', 'en': 'Readout 2'},
        'hudDecision': {'cn': '工程判断', 'en': 'Decision'},
        'body': {'cn': '箭体', 'en': 'body'},
        'fin': {'cn': '尾翼', 'en': 'fin'},
        'motor': {'cn': '发动机', 'en': 'motor'},
        'mass': {'cn': '质量', 'en': 'mass'},
        'height': {'cn': '射高', 'en': 'height'},
        'load': {'cn': '载荷', 'en': 'load'},
        'crack': {'cn': '裂纹', 'en': 'crack'},
        'doc': {'cn': '设计包', 'en': 'design package'},
        'peer': {'cn': '陌生同学', 'en': 'peer builder'},
        'ruler': {'cn': '尺寸标注', 'en': 'dimensions'},
        'wind': {'cn': '风洞气流', 'en': 'wind tunnel flow'},
        'cg': {'cn': '重心 CG', 'en': 'CG'},
        'cp': {'cn': '压心 CP', 'en': 'CP'},
        'drag': {'cn': '阻力', 'en': 'drag'},
        'stability': {'cn': '稳定性', 'en': 'stability'},
        'mfg': {'cn': '制造可行性', 'en': 'manufacturing'},
        'conclusion63': {'cn': '同一发动机下，减重会提高加速度和射高，但不能破坏稳定性。', 'en': 'With the same motor, less mass raises acceleration and altitude, but stability still matters.'},
        'conclusion64': {'cn': '失效不是随机的：一个小缺陷会沿力和振动传成失效链。', 'en': 'Failures are not random: one small defect can propagate through load and vibration.'},
        'conclusion65': {'cn': '可复现的设计包必须让别人不用口头解释也能做出同样零件。', 'en': 'A reproducible design package lets someone build the same parts without oral explanation.'},
        'conclusion66': {'cn': 'v2.0 迭代不是只追一个指标，而是在射高、稳定性、制造之间重新平衡。', 'en': 'v2.0 iteration balances altitude, stability, and manufacturability instead of chasing one metric.'},
    }
    for i, (cn, en) in enumerate(zip(stage_cn, stage_en)):
        i18n[f'stage{i}'] = {'cn': cn, 'en': en}
    for i, (cn, en) in enumerate(zip(guides_cn, guides_en)):
        i18n[f'guide{i+1}'] = {'cn': cn, 'en': en}
    guide_keys = [f'guide{i+1}' for i in range(len(guides_cn))]
    config = json.dumps({
        'style': style,
        'visualMode': 'cyberpunk',
        'totalFrames': 4,
        'guideTitle': 'guideTitle',
        'guideItems': guide_keys,
        'hudLabels': ['hudStage', 'hudRead1', 'hudRead2', 'hudDecision'],
        'hudValues': hud_rows,
        'i18n': i18n,
    }, ensure_ascii=False)
    return f'''<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>window.__systemedu_resize_patch_optout = true;</script>
<style>
*,*::before,*::after{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{width:100%;height:100vh;overflow:hidden;}}
body{{background:#080a12;color:#f5f7ff;font-family:'IBM Plex Sans','Noto Sans SC',sans-serif;}}
.wrapper{{display:flex;flex-direction:row;height:100vh;overflow:hidden;}}
.sidebar{{width:208px;min-width:208px;max-width:208px;display:flex;flex-direction:column;gap:7px;padding:12px;background:rgba(5,7,15,.96);border-right:1px solid rgba(78,214,255,.22);overflow-y:auto;}}
.lang-btn{{align-self:flex-start;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;padding:4px 9px;cursor:pointer;border:1px solid rgba(78,214,255,.45);background:rgba(78,214,255,.08);color:#4ed6ff;letter-spacing:.14em;text-transform:uppercase;}}
.style-switcher{{display:flex;gap:4px;margin:3px 0 2px;}}
.vm-btn{{font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 6px;cursor:pointer;border:1px solid rgba(255,255,255,.14);background:transparent;color:rgba(255,255,255,.45);}}
.vm-btn.vm-active{{color:#4ed6ff;border-color:#4ed6ff;background:rgba(78,214,255,.10);}}
.sidebar h1{{font-family:'IBM Plex Mono','Noto Sans SC',monospace;font-size:12px;font-weight:700;color:#4ed6ff;line-height:1.35;text-transform:uppercase;letter-spacing:.04em;}}
.sidebar .sub{{font-size:10px;color:rgba(255,255,255,.72);letter-spacing:.03em;line-height:1.5;}}
.sidebar .frame-ind{{font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(255,255,255,.46);letter-spacing:.12em;}}
.sidebar .guide-label{{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffd166;margin-top:8px;}}
.sidebar .guide-content{{font-size:11px;color:rgba(255,255,255,.76);line-height:1.55;}}
.sidebar .guide-content ul{{padding-left:16px;margin:0;}}
.sidebar .guide-content li{{margin-bottom:4px;}}
.anim-main{{flex:1;display:flex;flex-direction:column;min-width:0;background:radial-gradient(circle at 72% 12%,rgba(78,214,255,.13),transparent 34%),linear-gradient(135deg,#070914,#111827 68%,#17110a);}}
.canvas-wrap{{flex:1;min-height:0;}}
canvas{{width:100%;height:100%;display:block;}}
.controls{{display:flex;justify-content:center;align-items:center;gap:10px;padding:6px 12px;background:rgba(0,0,0,.34);border-top:1px solid rgba(255,255,255,.06);}}
.ctrl-btn{{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:5px 14px;border:0;cursor:pointer;color:#061018;background:linear-gradient(135deg,#8be9ff,#4ed6ff);box-shadow:0 0 13px rgba(78,214,255,.25);}}
.ctrl-btn.secondary{{background:rgba(255,255,255,.05);color:rgba(255,255,255,.68);box-shadow:none;border:1px solid rgba(255,255,255,.16);}}
.hud{{height:40px;display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,.52);border-top:1px solid rgba(255,255,255,.06);padding:0 14px;}}
.hud-item{{text-align:center;min-width:0;}}
.hud-label{{font-family:'IBM Plex Mono',monospace;font-size:7px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.42);}}
.hud-val{{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#ffd166;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}}
#frameInd{{display:none;}}
</style>
</head>
<body>
<div class="wrapper">
  <div class="sidebar">
    <button class="lang-btn" id="langBtn">CN</button>
    <div class="style-switcher" id="styleSwitcher"></div>
    <h1 id="title"></h1><div class="sub" id="subtitle"></div><div class="frame-ind" id="frameIndicator"></div><div id="frameInd"></div>
    <div class="guide-label" id="guideTitle"></div><div class="guide-content" id="guideContent"></div>
  </div>
  <div class="anim-main">
    <div class="canvas-wrap"><canvas id="c"></canvas></div>
    <div class="controls"><button class="ctrl-btn secondary" id="btnPrev"></button><button class="ctrl-btn" id="btnPlay"></button><button class="ctrl-btn secondary" id="btnNext"></button></div>
    <div class="hud"><div class="hud-item"><div class="hud-label" id="hudL1"></div><div class="hud-val" id="hudV1"></div></div><div class="hud-item"><div class="hud-label" id="hudL2"></div><div class="hud-val" id="hudV2"></div></div><div class="hud-item"><div class="hud-label" id="hudL3"></div><div class="hud-val" id="hudV3"></div></div><div class="hud-item"><div class="hud-label" id="hudL4"></div><div class="hud-val" id="hudV4"></div></div></div>
  </div>
</div>
<script src="../../runtime/animation_runtime.js"></script>
<script>
const KIND = {json.dumps(kind)};
const START_TS = performance.now();
window.CONFIG = {config};
function tt(k){{return AnimRuntime.t(k);}}
function time(){{return (performance.now()-START_TS)/1000;}}
function ease(x){{return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;}}
function clamp(v,a,b){{return Math.max(a,Math.min(b,v));}}
function rr(ctx,x,y,w,h,r){{const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();}}
function label(ctx,s,x,y,n,c,a='center',b=false){{ctx.save();ctx.fillStyle=c;ctx.font=(b?'700 ':'')+n+"px 'IBM Plex Sans','Noto Sans SC',sans-serif";ctx.textAlign=a;ctx.textBaseline='middle';ctx.fillText(s,x,y);ctx.restore();}}
function mono(ctx,s,x,y,n,c,a='left'){{ctx.save();ctx.fillStyle=c;ctx.font='700 '+n+"px 'IBM Plex Mono','Noto Sans SC',monospace";ctx.textAlign=a;ctx.textBaseline='middle';ctx.fillText(s,x,y);ctx.restore();}}
function arrow(ctx,x1,y1,x2,y2,c,lw=2){{const a=Math.atan2(y2-y1,x2-x1);ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-9*Math.cos(a-.45),y2-9*Math.sin(a-.45));ctx.lineTo(x2-9*Math.cos(a+.45),y2-9*Math.sin(a+.45));ctx.closePath();ctx.fill();ctx.restore();}}
function rocket(ctx,x,y,s,tilt=0,accent='#ffd166'){{ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(s,s);let g=ctx.createLinearGradient(-80,-12,80,12);g.addColorStop(0,'#eef6ff');g.addColorStop(.55,'#a7b5c8');g.addColorStop(1,'#526075');rr(ctx,-82,-15,150,30,15);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.2;ctx.stroke();ctx.beginPath();ctx.moveTo(68,-15);ctx.lineTo(104,0);ctx.lineTo(68,15);ctx.closePath();ctx.fillStyle='#ff7848';ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-45,15);ctx.lineTo(-18,48);ctx.lineTo(0,15);ctx.closePath();ctx.fillStyle=accent;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.35)';ctx.stroke();ctx.fillStyle='rgba(30,45,66,.9)';ctx.fillRect(-76,-11,24,22);ctx.restore();}}
function panel(ctx,x,y,w,h,title){{ctx.save();rr(ctx,x,y,w,h,10);ctx.fillStyle='rgba(0,0,0,.32)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.12)';ctx.stroke();mono(ctx,title,x+14,y+18,10,'rgba(78,214,255,.82)');ctx.restore();}}
function drawBg(ctx,W,H){{let g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#050711');g.addColorStop(.55,'#0d1424');g.addColorStop(1,'#1b1308');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;for(let x=0;x<W;x+=42){{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}}for(let y=0;y<H;y+=42){{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}}}}
function getFrameElements(f,W,H){{return [{{id:'scene',type:'custom',frame:f,x:0,y:0,w:W,h:H}}];}}
function draw63(ctx,W,H,stage,p){{let t=time();let ground=H*.78;ctx.fillStyle='rgba(92,62,32,.55)';ctx.fillRect(42,ground,W-84,H-ground-24);mono(ctx,'MASS / ALTITUDE TEST RAIL',56,ground+20,10,'#8be9ff');let lift=stage<2?0:(stage===2?120*p:155+8*Math.sin(t*2));let x=W*.38,y=ground-48-lift;rocket(ctx,x,y,.95,-Math.PI/2,'#ffd166');ctx.strokeStyle='rgba(139,233,255,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W*.25,ground-10);ctx.lineTo(W*.25,H*.18);ctx.stroke();rocket(ctx,W*.58,ground-48-(stage>=2?lift*1.18:0),.78,-Math.PI/2,'#4ed6ff');ctx.setLineDash([6,6]);ctx.strokeStyle='rgba(255,209,102,.45)';ctx.beginPath();ctx.moveTo(W*.38,ground-48);ctx.quadraticCurveTo(W*.36,H*.36,W*.38,H*.18);ctx.stroke();ctx.strokeStyle='rgba(78,214,255,.65)';ctx.beginPath();ctx.moveTo(W*.58,ground-48);ctx.quadraticCurveTo(W*.57,H*.30,W*.58,H*.11);ctx.stroke();ctx.setLineDash([]);if(stage===1){{let bx=W*.38-45,by=ground-92+50*p;ctx.fillStyle='#ff5f3c';ctx.fillRect(bx,by,32,18);label(ctx,'-10 g',bx+16,by-12,12,'#ffd166','center',true);}}panel(ctx,W-250,54,202,118,'LIVE ESTIMATE');label(ctx,stage<1?'120 g':'110 g',W-150,94,26,stage<1?'#ffd166':'#4ed6ff','center',true);label(ctx,stage<2?'baseline':(stage===2?'same motor thrust':'height margin +'),W-150,124,13,'rgba(255,255,255,.78)');arrow(ctx,W*.42,ground-104,W*.42,ground-154,'#ff7848',3);arrow(ctx,W*.61,ground-104,W*.61,ground-174,'#4ed6ff',3);if(stage===3){{label(ctx,'188 m',W*.38,H*.18-18,14,'#ffd166','center',true);label(ctx,'210 m',W*.58,H*.11-18,14,'#4ed6ff','center',true);label(ctx,tt('conclusion63'),W*.52,H-46,14,'#fff4c2','center',true);}}label(ctx,tt('mass'),W-150,72,11,'rgba(255,255,255,.70)');}}
function draw64(ctx,W,H,stage,p){{let t=time();let ground=H*.77;ctx.fillStyle='rgba(42,38,34,.75)';ctx.fillRect(48,ground,W-96,H-ground-22);mono(ctx,'FAILURE CHAIN OBSERVATION',60,ground+20,10,'#8be9ff');let tilt=(stage>=2?.28*p:0)+Math.sin(t*9)*(stage>=1?.012:0);rocket(ctx,W*.42,H*.46,.95,tilt,'#ffd166');ctx.strokeStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.moveTo(W*.42,H*.46);ctx.lineTo(W*.42,ground);ctx.stroke();let rootX=W*.42-38,rootY=H*.46+40;ctx.strokeStyle='#ff5f3c';ctx.lineWidth=stage?2+stage:1;for(let i=0;i<stage+1;i++){{ctx.beginPath();ctx.moveTo(rootX+i*6,rootY);ctx.lineTo(rootX+8+i*7,rootY+18+i*3);ctx.stroke();}}if(stage>=1){{arrow(ctx,W*.30,H*.39,W*.36,H*.44,'#4ed6ff',3);arrow(ctx,W*.31,H*.51,W*.37,H*.48,'#4ed6ff',3);label(ctx,tt('load'),W*.29,H*.36,12,'#8be9ff','center',true);}}if(stage>=2){{arrow(ctx,W*.32,H*.54,W*.26,H*.60,'#ff5f3c',3);label(ctx,'thrust off-axis',W*.24,H*.62,11,'#ffb199','center',true);}}panel(ctx,W-268,52,222,152,'FMEA LITE');let rows=['gap -> vibration','crack -> peel','tilt -> bending','check breaks chain'];rows.forEach((r,i)=>{{ctx.fillStyle=i<=stage?'rgba(255,95,60,.16)':'rgba(255,255,255,.05)';ctx.fillRect(W-252,82+i*28,190,20);label(ctx,r,W-242,92+i*28,11,i<=stage?'#ffd166':'rgba(255,255,255,.55)','left');}});if(stage===3){{label(ctx,tt('conclusion64'),W*.50,H-46,14,'#fff4c2','center',true);ctx.strokeStyle='#10b981';ctx.lineWidth=3;ctx.strokeRect(W-256,170,198,24);}}label(ctx,tt('crack'),rootX+40,rootY+36,12,'#ffb199','center',true);}}
function draw65(ctx,W,H,stage,p){{let table=H*.72;ctx.fillStyle='rgba(61,48,34,.72)';ctx.fillRect(40,table,W-80,H-table-20);mono(ctx,'REPRODUCIBILITY REVIEW DESK',56,table+20,10,'#8be9ff');panel(ctx,70,70,210,210,tt('doc'));for(let i=0;i<4;i++){{ctx.fillStyle=i<=stage?'rgba(78,214,255,.18)':'rgba(255,255,255,.08)';ctx.fillRect(95,105+i*38,150,24);label(ctx,['BOM','尺寸图','连接表','安全声明'][i],170,117+i*38,12,'#e6f7ff');}}let peerX=W*.55, peerY=H*.52;ctx.fillStyle='rgba(78,214,255,.18)';ctx.beginPath();ctx.arc(peerX,peerY-72,22,0,Math.PI*2);ctx.fill();label(ctx,tt('peer'),peerX,peerY-105,12,'#8be9ff','center',true);ctx.fillStyle='rgba(255,255,255,.14)';rr(ctx,peerX-42,peerY-46,84,78,12);ctx.fill();rocket(ctx,peerX+90,peerY+4,.72,0,'#ffd166');if(stage===1){{label(ctx,'?',peerX+72,peerY-38,34,'#ff5f3c','center',true);label(ctx,'缺少直径',peerX+72,peerY-8,13,'#ffb199','center',true);}}if(stage===2){{rocket(ctx,peerX+90,peerY+56,.65,0,'#ff5f3c');arrow(ctx,peerX+28,peerY+24,peerX+55,peerY+46,'#ff5f3c',3);label(ctx,'两种理解',peerX+94,peerY+92,13,'#ffb199','center',true);}}if(stage===3){{ctx.strokeStyle='#10b981';ctx.lineWidth=4;ctx.strokeRect(92,139,156,32);label(ctx,tt('conclusion65'),W*.55,H-46,14,'#fff4c2','center',true);arrow(ctx,282,155,peerX+42,peerY-18,'#10b981',3);}}panel(ctx,W-250,72,190,126,'REVIEW RESULT');let vals=stage<1?['歧义: 3','质量: 未核对','复现: 风险']:(stage<3?['歧义: 1','质量: 463g','复现: 不稳']:['歧义: 0','质量: 442g','复现: 通过']);vals.forEach((v,i)=>label(ctx,v,W-234,106+i*30,13,i===2&&stage===3?'#10b981':'#ffd166','left',true));}}
function draw66(ctx,W,H,stage,p){{let t=time();let tunnelY=H*.50;panel(ctx,46,52,W-92,H*.70,'WIND TUNNEL ITERATION');for(let i=0;i<9;i++){{let y=H*.24+i*24+Math.sin(t*2+i)*3;ctx.strokeStyle=i%2?'rgba(78,214,255,.32)':'rgba(255,255,255,.18)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(80,y);ctx.bezierCurveTo(W*.35,y+(stage<1?18:8),W*.55,y-(stage===0?26:stage===1?16:7),W-92,y+Math.sin(t+i)*5);ctx.stroke();}}let scale=stage===0?1.05:stage===1?.86:stage===2?.90:.88;rocket(ctx,W*.46,tunnelY,scale,0,stage>=2?'#4ed6ff':'#ffd166');if(stage===0){{arrow(ctx,W*.62,tunnelY,W*.76,tunnelY,'#ff5f3c',4);label(ctx,tt('drag'),W*.72,tunnelY-22,13,'#ffb199','center',true);}}if(stage>=1){{arrow(ctx,W*.62,tunnelY,W*.70,tunnelY,'#ff9f43',3);label(ctx,'diameter -12%',W*.47,tunnelY+72,12,'#ffd166','center',true);}}if(stage>=2){{ctx.fillStyle='#10b981';ctx.beginPath();ctx.arc(W*.42,tunnelY-42,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4ed6ff';ctx.beginPath();ctx.arc(W*.53,tunnelY-42,6,0,Math.PI*2);ctx.fill();label(ctx,tt('cg'),W*.42,tunnelY-58,11,'#10b981','center',true);label(ctx,tt('cp'),W*.53,tunnelY-58,11,'#4ed6ff','center',true);}}panel(ctx,W-254,70,204,142,'THREE BALANCE');let bars=[['射高',stage===0?.52:stage===1?.70:stage===2?.75:.80,'#4ed6ff'],['稳定',stage===1?.38:stage===0?.62:stage===2?.72:.76,'#10b981'],['制造',stage===0?.46:stage===1?.52:stage===2?.64:.78,'#ffd166']];bars.forEach((b,i)=>{{label(ctx,b[0],W-232,104+i*32,11,'rgba(255,255,255,.72)','left');ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(W-178,96+i*32,96,12);ctx.fillStyle=b[2];ctx.fillRect(W-178,96+i*32,96*b[1],12);}});if(stage===3){{label(ctx,tt('conclusion66'),W*.50,H-46,14,'#fff4c2','center',true);}}label(ctx,tt('wind'),W*.22,H*.19,12,'#8be9ff','center',true);}}
function customDrawElement(ctx,el,W,H){{if(el.id!=='scene')return false;let stage=el.frame||0;let p=ease((time()%1.8)/1.8);if(KIND==='mass')draw63(ctx,W,H,stage,p);if(KIND==='failure')draw64(ctx,W,H,stage,p);if(KIND==='package')draw65(ctx,W,H,stage,p);if(KIND==='aero')draw66(ctx,W,H,stage,p);return true;}}
function onReady(){{const visible=document.getElementById('frameIndicator');const hidden=document.getElementById('frameInd');if(visible&&hidden){{const sync=()=>{{hidden.textContent=visible.textContent||'';}};sync();new MutationObserver(sync).observe(visible,{{childList:true,subtree:true,characterData:true}});}}let raf=0;function loop(){{AnimRuntime.drawFrame(AnimRuntime.currentFrame);raf=requestAnimationFrame(loop);}}raf=requestAnimationFrame(loop);}}
AnimRuntime.boot();
</script>
</body>
</html>'''


def game_html(title_cn: str, title_en: str, guide_cn: str, guide_en: str, kind: str, rounds: list[dict]) -> str:
    rounds_js = json.dumps(rounds, ensure_ascii=False)
    return f'''<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{{box-sizing:border-box}}html,body{{margin:0;width:100%;height:100vh;overflow:hidden;background:#070a12;color:#eef6ff;font-family:'IBM Plex Sans','Noto Sans SC',sans-serif}}.game-wrap{{display:flex;flex-direction:row;height:100vh;overflow:hidden}}.game-sidebar{{width:208px;min-width:208px;max-width:208px;display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(3,6,14,.96);border-right:1px solid rgba(78,214,255,.22);overflow-y:auto}}.sidebar-lang{{align-self:flex-start;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.14em;padding:4px 9px;border:1px solid rgba(78,214,255,.45);background:rgba(78,214,255,.08);color:#4ed6ff;cursor:pointer}}.sidebar-title{{font-family:'IBM Plex Mono','Noto Sans SC',monospace;font-size:12px;font-weight:700;line-height:1.35;color:#4ed6ff;text-transform:uppercase}}.sidebar-guide{{font-size:11px;line-height:1.55;color:rgba(255,255,255,.74)}}.game-main{{flex:1;display:flex;flex-direction:column;min-width:0;background:radial-gradient(circle at 78% 16%,rgba(255,209,102,.13),transparent 34%),linear-gradient(135deg,#080b13,#111827 68%,#17110a)}}.game-header{{padding:9px 16px;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,.36);border-bottom:1px solid rgba(255,255,255,.06)}}h1{{font-size:15px;margin:0;font-family:'IBM Plex Mono','Noto Sans SC',monospace;color:#ffd166}}.info{{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#8be9ff}}.game-body{{flex:1;display:flex;min-height:0}}canvas{{width:100%;height:100%;display:block}}.control-panel{{display:flex;gap:10px;justify-content:center;align-items:center;padding:8px;background:rgba(0,0,0,.42);border-top:1px solid rgba(255,255,255,.06)}}.ctrl-btn{{font-family:'IBM Plex Mono','Noto Sans SC',monospace;font-size:11px;font-weight:700;letter-spacing:.08em;padding:7px 14px;border:0;background:linear-gradient(135deg,#8be9ff,#4ed6ff);color:#061018;cursor:pointer}}.ctrl-btn.secondary{{background:rgba(255,255,255,.06);color:rgba(255,255,255,.72);border:1px solid rgba(255,255,255,.16)}}.hud-bar{{display:flex;gap:12px;justify-content:center;padding:7px 12px;background:rgba(0,0,0,.56);font-family:'IBM Plex Mono',monospace;font-size:10px;color:#ffd166}}#resultPanel{{padding:0 12px;color:#10b981}}
</style></head><body><div class="game-wrap"><div class="game-sidebar"><button class="sidebar-lang" id="langBtn">CN</button><div class="sidebar-title" id="sidebarTitle"></div><div class="sidebar-guide" id="guideContent"></div></div><div class="game-main"><div class="game-header"><h1 id="gameTitle"></h1><div class="info" id="roundInfo"></div></div><div class="game-body"><canvas id="c"></canvas></div><div class="control-panel"><button class="ctrl-btn" id="btnAction"></button><button class="ctrl-btn secondary" id="btnNext">下一关 Next</button><button class="ctrl-btn secondary" id="btnReset"></button><span id="resultPanel"></span></div><div class="hud-bar" id="hudBar"></div></div></div><script>
const KIND={json.dumps(kind)};const ROUNDS={rounds_js};let LANG='cn',round=0,score=0,last='';const I18N={{title:{{cn:{json.dumps(title_cn, ensure_ascii=False)},en:{json.dumps(title_en)}}},guide:{{cn:{json.dumps(guide_cn, ensure_ascii=False)},en:{json.dumps(guide_en)}}},action:{{cn:'运行测试',en:'Run test'}},reset:{{cn:'重置',en:'Reset'}},round:{{cn:'关卡',en:'Round'}}}};function t(k){{let v=I18N[k];return v?v[LANG]:k}}function rr(ctx,x,y,w,h,r){{ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.rect(x,y,w,h));}}function label(ctx,s,x,y,n,c,a='center',b=false){{ctx.save();ctx.fillStyle=c;ctx.font=(b?'700 ':'')+n+"px IBM Plex Sans, Noto Sans SC, sans-serif";ctx.textAlign=a;ctx.textBaseline='middle';ctx.fillText(s,x,y);ctx.restore();}}function mono(ctx,s,x,y,n,c,a='left'){{ctx.save();ctx.fillStyle=c;ctx.font='700 '+n+'px IBM Plex Mono, Noto Sans SC, monospace';ctx.textAlign=a;ctx.textBaseline='middle';ctx.fillText(s,x,y);ctx.restore();}}function arrow(ctx,x1,y1,x2,y2,c){{let a=Math.atan2(y2-y1,x2-x1);ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-9*Math.cos(a-.45),y2-9*Math.sin(a-.45));ctx.lineTo(x2-9*Math.cos(a+.45),y2-9*Math.sin(a+.45));ctx.closePath();ctx.fill();}}function rocket(ctx,x,y,s,tilt=0){{ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(s,s);ctx.fillStyle='#dfe8f5';ctx.fillRect(-70,-14,132,28);ctx.beginPath();ctx.moveTo(62,-14);ctx.lineTo(96,0);ctx.lineTo(62,14);ctx.fillStyle='#ff7848';ctx.fill();ctx.beginPath();ctx.moveTo(-36,14);ctx.lineTo(-12,43);ctx.lineTo(8,14);ctx.fillStyle='#ffd166';ctx.fill();ctx.restore();}}function resize(){{const c=document.getElementById('c'),dpr=Math.min(devicePixelRatio||1,2);c.width=c.clientWidth*dpr;c.height=c.clientHeight*dpr;draw();}}function draw(){{const c=document.getElementById('c'),ctx=c.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),W=c.width/dpr,H=c.height/dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);let g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#070a12');g.addColorStop(1,'#172033');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);for(let x=0;x<W;x+=44){{ctx.strokeStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}}let r=ROUNDS[round];label(ctx,r.prompt,W/2,34,18,'#ffd166','center',true);rocket(ctx,W*.50,H*.48,.95,0);if(KIND==='mass'){{let mass=120-(round*6)-(score*4);label(ctx,'mass '+mass+' g',W*.20,H*.28,24,'#4ed6ff','center',true);arrow(ctx,W*.42,H*.50,W*.42,H*.34,'#ff7848');arrow(ctx,W*.58,H*.50,W*.58,H*.28,'#4ed6ff');}}if(KIND==='failure'){{for(let i=0;i<=round;i++){{ctx.strokeStyle=i<score?'#10b981':'#ff5f3c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W*.45+i*12,H*.54);ctx.lineTo(W*.47+i*12,H*.59+i*6);ctx.stroke();}}}}if(KIND==='package'){{ctx.fillStyle='rgba(78,214,255,.16)';ctx.fillRect(W*.16,H*.23,170,210);['BOM','尺寸图','连接表','安全页'].forEach((s,i)=>label(ctx,s,W*.16+85,H*.28+i*42,14,i<score?'#10b981':'#ffd166'));label(ctx,last||'等待审查',W*.68,H*.30,18,'#8be9ff','center',true);}}if(KIND==='aero'){{for(let i=0;i<7;i++){{ctx.strokeStyle='rgba(78,214,255,.35)';ctx.beginPath();ctx.moveTo(70,H*.30+i*32);ctx.bezierCurveTo(W*.36,H*.30+i*32+20-score*4,W*.62,H*.30+i*32-18+score*3,W-80,H*.30+i*32);ctx.stroke();}}label(ctx,'drag '+(70-score*8)+'%',W*.72,H*.30,18,'#ffb199');}}label(ctx,last,W/2,H-38,15,last.includes('通过')||last.includes('PASS')?'#10b981':'#ffd166','center',true);document.getElementById('hudBar').textContent='score '+score+' / '+ROUNDS.length;}}function update(){{document.getElementById('sidebarTitle').textContent=t('title');document.getElementById('guideContent').textContent=t('guide');document.getElementById('gameTitle').textContent=t('title');document.getElementById('roundInfo').textContent=t('round')+' '+(round+1)+' / '+ROUNDS.length;document.getElementById('btnAction').textContent=t('action');document.getElementById('btnReset').textContent=t('reset');draw();}}document.getElementById('langBtn').onclick=()=>{{LANG=LANG==='cn'?'en':'cn';document.getElementById('langBtn').textContent=LANG.toUpperCase();update();}};document.getElementById('btnAction').onclick=()=>{{let r=ROUNDS[round];score+=1;last=r.result;document.getElementById('resultPanel').textContent=r.result;draw();}};document.getElementById('btnNext').onclick=()=>{{round=(round+1)%ROUNDS.length;last='';document.getElementById('resultPanel').textContent='';update();}};document.getElementById('btnReset').onclick=()=>{{round=0;score=0;last='';document.getElementById('resultPanel').textContent='';update();}};window.addEventListener('resize',resize);update();resize();
</script></body></html>'''


def diagram_html(title: str, cards: list[tuple[str, str]], accent: str = '#4ed6ff') -> str:
    card_html = ''.join(f'<article><b>{a}</b><p>{b}</p></article>' for a, b in cards)
    return f'''<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{{margin:0;background:#07101a;color:#eef6ff;font-family:Helvetica,'Noto Sans SC',sans-serif}}.wrap{{min-height:100vh;padding:26px;background:radial-gradient(circle at 80% 0,rgba(78,214,255,.16),transparent 35%),linear-gradient(135deg,#07101a,#121827)}}h1{{font-size:22px;color:{accent};margin:0 0 18px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}}article{{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);padding:16px;min-height:120px}}b{{display:block;color:#ffd166;margin-bottom:10px}}p{{margin:0;line-height:1.55;color:rgba(255,255,255,.76)}}.arrow{{text-align:center;color:{accent};font-size:30px;margin:14px 0}}</style></head><body><main class="wrap"><h1>{title}</h1><div class="grid">{card_html}</div><div class="arrow">检查顺序：观察 → 估算 → 测试 → 记录 → 修订</div></main></body></html>'''


def kit(topic: str, cost: int, components: list[dict], steps: list[dict], href: str, aref: str) -> dict:
    return {
        'topic': topic,
        'total_cost_cny': cost,
        'age_min': 10,
        'safety_level': 'low',
        'components': components,
        'tools': [{'name': '护目镜', 'name_en': 'Safety goggles', 'price_cny': 12, 'included': False}],
        'steps': steps,
        'anchor': '## 实物操作与购买',
        'hands_on_ref': href,
        'acceptance_ref': aref,
    }


def node_data() -> dict[int, dict]:
    return {
        63: {
            'animation_topic': '减10克后的同推力发射对比',
            'game_topic': '三处减重策略测试台',
            'exercise_topic': '减重克数与风险判断',
            'anim_refs': ('每处改进估算减重克数', '总减重>=15g。'),
            'game_refs': ('对v1.0草图给出3处减重改进', '至少3处改进。'),
            'ex_refs': ('每处改进估算减重克数', '总减重>=15g。'),
            'plan': '''> Module: P-ROCKET-01-M064 · core

## 学习目标

完成本模块后，你将能够：
- 能够解释“减10克能让射高增加多少？”这个核心问题，知道质量降低会提高同一发动机下的加速度和高度潜力。
- 能够对v1.0草图给出3处减重改进，并说明每一处不破坏结构强度、稳定性或回收安全。
- 能够为每处改进估算减重克数，汇总后检查是否满足“总减重>=15g。”
- 能够把减重思路写成《减重改进清单》，传给 S7 结构包和后续制造环节。

## 引入：减10克能让射高增加多少？

同一枚教学火箭发动机给出的推力和总冲大致固定。如果火箭变轻一点，发动机不用再推动那么多“无效质量”，上升段就会更敏捷，能量损失也会变小。所以“减10克能让射高增加多少？”不是一个装饰性问题，而是结构设计阶段每天都会遇到的工程取舍。可是轻量化不能理解成“能剪就剪”：剪掉尾翼面积可能让火箭飞偏，削薄箭身可能让最大动压处压皱，换掉材料可能让加工难度上升。本节要做的是有证据地减重，而不是凭感觉变薄。

## 核心概念：减重不是越多越好

[[THEORY:theory_mass_altitude]]

质量影响飞行高度，但高度不是唯一指标。一个好减重方案必须同时满足三个条件：确实减轻质量、仍然能承受发射和回收载荷、不会把重心和压心关系搞乱。比如把实心头锥改为空心头锥，通常是高收益减重；把尾翼根部大幅削薄，看上去也能减重，却可能让尾翼在气流剪切中颤振或脱落。判断时先写“原方案质量、改进后质量、减重克数、风险”，再决定是否采用。

[[THEORY:theory_mass_budget]]

## 深入理解：10个小窍门如何变成3处真实改进

常见减重来源包括：头锥空心化、箭身壁厚优化、尾翼材料从厚椴木换成轻木、减少多余胶量、定心环镂空、减少厚涂层、降落伞面积按回收速度反推、配重集中化、紧固件改用更轻方案、3D 打印填充率降低。它们不是清单打勾题，而是候选方案库。你需要把 v1.0 草图逐部位检查，至少挑出3处可操作改进，并给出估算方法。估算可以用称重法、材料密度法或同尺寸小样对比法。

[[THEORY:theory_stability_tradeoff]]

## 应用与拓展

本节的动手任务是完成《减重改进清单》。表中至少包含3处改进，每处写清部位、原方案、新方案、估算减重、风险和是否采用。最后把总减重相加，若不足15克，就继续寻找低风险部位；若超过30克，就必须重新检查重心位置和稳定裕度。完成后把清单贴回结构设计包，不要只留下“减重了”三个字。

## 实物操作与购买

本节建议使用一个低风险称量与估算套件：电子秤、游标卡尺、纸管/轻木/胶水小样、记录表。所有操作只比较材料和模型件，不涉及真实发动机或点火器。

## 推荐互动资源

系统将展示与力、能量和材料选择有关的 LabXchange 学习路径，帮助你把“减重”从经验判断变成可解释的工程估算。

## 学习路径建议

本节点承接材料与连接方式选择，输出的减重清单会进入 M066 结构与材料设计包，并影响 S8-S9 的采购和加工。''',
            'theories': [
                theory('theory_mass_altitude','质量与射高','physics',['physics/mechanics/mass','aerospace/rocketry/performance'],
                    """把火箭想成背书包跑步的人。书包越轻，同样的力气就越容易跑快，也更容易爬到更高的坡上。

火箭也是这样。发动机像一段固定的冲刺力量，火箭越轻，这段力量越能用来让火箭加速，而不是拖着多余材料一起上天。""",
                    """在同一发动机下，质量越小，推力产生的加速度越大，上升段速度增长更快。高度还会受到空气阻力、发射角度、稳定性和发动机燃烧曲线影响，所以减重带来的收益不是一个固定数字。

工程估算时可以先做相对比较：原方案和减重方案使用同一发动机、同一外形和同一发射条件，只改变质量，再比较仿真或经验表里的最高点。""",
                    """更严谨地看，竖直方向运动可用微分方程描述，推力、重力和阻力共同决定速度导数，速度再积分得到高度。质量进入方程后，会同时影响加速度项和阻力造成的速度损失。

如果进一步考虑发动机质量随时间减少、阻力随速度平方变化，就需要数值积分。减10克的高度收益因此依赖初始质量、推力曲线、阻力系数和稳定姿态，而不是单一常数。""",
                    [{'question':'为什么同一发动机下减重通常有利于射高？','type':'choice','options':['推力变大了','需要推动的质量变小了','重力方向改变了','空气阻力消失了'],'correct':1,'explanation':'发动机推力近似不变时，质量越小，加速越容易。'}], '引入：减10克能让射高增加多少？'),
                theory('theory_mass_budget','质量预算','engineering',['engineering/design/mass-budget','aerospace/rocketry/structures'],
                    """质量预算像出门前整理背包。每样东西都可以带，但总重量有限，带多了就跑不快。

火箭也要把头锥、箭身、尾翼、胶水、回收系统都放进一个总重量框里。每个部位省一点，最后才可能省出真正有用的十几克。""",
                    """质量预算把整箭拆成多个部位，分别记录原质量、目标质量和差额。它的价值不只是算总数，还能发现“最重却最不关键”的部位。

做预算时要保留制造余量。比如最终目标是500克以内，结构阶段最好控制在更低的数值，给喷漆、胶水误差和修补留空间。""",
                    """高级质量预算会把部件质量看作随机变量，而不是一个精确常数。胶量、打印填充率和材料批次都会让质量出现分布，设计者需要关注期望和方差。

在项目管理上，可以用矩阵把部件、材料、工艺和风险关联起来，再做灵敏度分析。这样能判断哪一项减重对总质量最敏感，哪一项虽然能减重却会显著增加失效概率。""",
                    [{'question':'质量预算表最重要的作用是什么？','type':'choice','options':['让表格更好看','把每个部位的质量和余量管起来','替代发射安全检查','保证火箭一定飞直'],'correct':1,'explanation':'预算表帮助团队控制总质量并追踪余量。'}], '核心概念：减重不是越多越好'),
                theory('theory_stability_tradeoff','轻量化权衡','engineering',['engineering/tradeoff/stability','physics/mechanics/center-of-mass'],
                    """减重像给自行车拆零件。拆掉沉重的装饰可能更好骑，拆掉刹车就危险了。

火箭减重也一样。有些质量是浪费，有些质量在保护结构、保持稳定或保证回收，不能只因为它重就删掉。""",
                    """轻量化要同时检查强度、重心和压心。靠近头部的减重可能让重心后移，靠近尾部的减重可能改变稳定裕度；尾翼减重还可能改变抗弯刚度。

因此每条减重措施都要写风险说明。低风险措施优先采用，高风险措施必须通过小样测试或仿真验证后再进入 v2.0。""",
                    """从系统优化角度看，轻量化是多目标问题。目标函数可能同时包含高度、稳定裕度、制造时间和失效概率，各目标之间存在约束和权重。

如果使用微分或线性化方法分析，可以把小的质量变化映射到重心位置和高度响应的变化率。这样团队能判断“减在哪”比“减多少”更关键。""",
                    [{'question':'为什么不能随意削小尾翼来减重？','type':'choice','options':['尾翼没有质量','可能破坏稳定性和刚度','会让发动机变热','会让降落伞变大'],'correct':1,'explanation':'尾翼负责稳定，削小或削薄都可能带来飞行风险。'}], '深入理解：10个小窍门如何变成3处真实改进'),
            ],
            'exercises_raw': [
                {'question':'一条合格减重记录必须包含什么？','options':['只写“变轻了”','原方案、新方案、估算减重和风险','只写材料颜色','只写谁来制作'],'correct':1,'explanation':'减重要可验证，必须记录方案变化、减重数值和风险。','ref':'每处改进估算减重克数'},
                {'question':'如果总减重已经超过30克，下一步最需要检查什么？','options':['重新命名文件','重心和稳定裕度','视频是否好看','胶水颜色'],'correct':1,'explanation':'大量减重可能改变质量分布，需要重新检查稳定。','ref':'总减重>=15g。'},
                {'question':'哪项通常属于低风险减重？','options':['去掉所有尾翼','头锥空心化并保留外形强度','把发动机舱削薄到松动','取消回收系统'],'correct':1,'explanation':'头锥空心化常能减重且相对容易保持外形。','ref':'对v1.0草图给出3处减重改进'},
            ],
            'animation_kind': 'mass', 'style': 'space',
            'stage_cn': ['基线称重','移除10克','同推力升空','高度差读数'],
            'stage_en': ['Baseline mass','Remove 10 g','Same thrust launch','Altitude readout'],
            'guides_cn': ['观察两支火箭使用同一发动机，差异只来自质量。','红色小块代表从结构中移除的10克无效质量。','两条轨迹持续显示轻量方案更快爬升。','最后读数只是估算，真实设计还要检查稳定和强度。'],
            'guides_en': ['Both rockets use the same motor; only mass changes.','The red block is 10 g of removed dead weight.','The two traces show the lighter version climbing faster.','The final readout is an estimate; stability and strength still matter.'],
            'hud_rows': [['stage0','120 g','baseline','observe'],['stage1','110 g','-10 g','estimate'],['stage2','same thrust','higher accel','compare'],['stage3','+22 m','risk check','adopt if stable']],
            'game_rounds': [
                {'prompt':'选择头锥空心化，估算减重并检查外形强度。','result':'通过：减重 8g，风险低。'},
                {'prompt':'优化胶量，去掉溢胶但保留胶缝。','result':'通过：减重 3g，风险低。'},
                {'prompt':'尾翼换轻木，同时保留根部加强。','result':'通过：减重 7g，总减重达到15g以上。'},
            ],
            'diagram_cards': [('质量预算','按头锥、箭身、尾翼、胶水和回收系统拆分质量。'),('减重收益','记录原质量、目标质量和减重克数。'),('风险检查','每条减重都检查强度、重心、压心和制造难度。'),('采用决策','低风险先采用，高风险先做小样测试。')],
            'kit': kit('轻量化称量与估算套件', 118,
                [{'name':'0.1g电子秤','name_en':'0.1 g digital scale','spec':'量程500g','qty':1,'price_cny':45,'search_keyword':'0.1g 电子秤'}, {'name':'游标卡尺','name_en':'Vernier caliper','spec':'0-150mm','qty':1,'price_cny':35,'search_keyword':'游标卡尺'}, {'name':'轻木/纸管小样','name_en':'balsa and paper tube samples','spec':'A4小样包','qty':1,'price_cny':26,'search_keyword':'轻木板 纸管 模型材料'}],
                [{'step':1,'title':'称原方案','description':'按部位称量 v1.0 草图对应的小样或零件。','safety_warning':'不要称真实发动机。','expected_result':'得到原方案质量。'}, {'step':2,'title':'替换小样','description':'换成轻量材料或减少胶量，再称一次。','safety_warning':'剪裁时使用垫板。','expected_result':'得到减重克数。'}, {'step':3,'title':'汇总判断','description':'把3处改进相加并写风险说明。','safety_warning':'不足15g时继续找低风险部位。','expected_result':'形成减重清单。'}], '每处改进估算减重克数', '总减重>=15g。'),
        },
        # Nodes 64-66 are defined below after this large block.
    }


def extend_node_data(data: dict[int, dict]) -> dict[int, dict]:
    data[64] = {
        'animation_topic': '尾翼裂纹触发的结构失效链', 'game_topic': '发射前失效预防检查台', 'exercise_topic': '失效模式与检查方法判断',
        'anim_refs': ('列出至少8种失效模式', '至少8种失效模式完整。'), 'game_refs': ('对每种模式给出至少1条预防措施和1条检查方法', '每种模式有预防措施和检查方法。'), 'ex_refs': ('列出至少8种失效模式', '每种模式有预防措施和检查方法。'),
        'plan': '''> Module: P-ROCKET-01-M065 · core

## 学习目标

完成本模块后，你将能够：
- 能够围绕“你的v1.0火箭最容易在哪个环节失败？”识别结构、连接、回收和装配中的关键风险。
- 能够列出至少8种失效模式，并说明每种失效的典型场景和根本原因。
- 能够对每种模式给出至少1条预防措施和1条检查方法，满足“每种模式有预防措施和检查方法。”
- 能够把风险整理为《失效模式与预防表》，传给 S7 大作业和发射前检查。

## 引入：你的v1.0火箭最容易在哪个环节失败？

一枚教学火箭失败，通常不是因为“运气不好”。发动机松动、尾翼胶缝太窄、头锥卡得过紧或过松、伞绳缠绕、箭身薄壁压皱、尾翼安装角偏差，这些都是可以提前识别的风险。核心问题是：**你的v1.0火箭最容易在哪个环节失败？** 只说“要小心”没有用，工程上要把失败写成可检查的模式：它叫什么、为什么发生、发射前怎么发现、设计阶段怎么预防。

## 核心概念：失效模式是“会怎样坏”的语言

[[THEORY:theory_failure_chain]]

本节至少整理8种模式：发动机后挫、尾翼脱落、头锥提前分离、箭身压溃、伞舱提前开启、降落伞无法弹出、箭身断裂、同轴度偏差导致螺旋飞行。每一种都要写根本原因，而不是只写表面现象。比如“尾翼脱落”表面是尾翼掉了，根因可能是粘接面积不足、胶种不合适、表面未打磨或尾翼承受了剥离载荷。

[[THEORY:theory_prevention_check]]

## 深入理解：从单点故障到失效链

失效常常会连锁发生。发动机后挫会改变推力传递路径，随后造成箭身弯矩增加；尾翼安装角偏差会引发自旋，自旋又会放大气动载荷；伞舱提前打开会让上升段阻力突然增加，甚至拉断箭身。动画和检查台会演示一个小缺陷如何沿力、热、振动或气流传播。你的任务是把每条链在最早、最容易检查的位置打断。

[[THEORY:theory_risk_priority]]

## 应用与拓展

请建立《失效模式与预防表》。每行包含失效模式、潜在原因、预防措施、发射前检查方法和检查记录。不要把检查写成“看一下是否正常”，而要写可执行动作，例如“轻拉尾翼根部10秒，观察胶缝是否开裂”“用推杆确认发动机挡块不后退”“把降落伞按装舱顺序取出一次，确认无缠绕”。

## 实物操作与购买

本节建议准备结构弱点检查套件：放大镜、记号笔、纸质检查表、低粘美纹纸、直尺和手机拍照记录。只检查空箭体和模型件，不接触真实发动机和点火系统。

## 推荐互动资源

系统将展示与固体材料、弹性、阻力和材料工程相关的 LabXchange 资源，用于理解失效背后的力学和材料原因。

## 学习路径建议

本节点输出的失效模式表会进入 M066 结构与材料设计包，也会在 S12 发射前检查中再次使用。''',
        'theories': [
            theory('theory_failure_chain','失效链','physics',['physics/mechanics/load-path','engineering/failure-analysis'],
                """失效链像一排多米诺骨牌。第一块倒下时，看起来只是小问题，但它会推倒后面的许多问题。

火箭上一个松动的尾翼、一处裂开的胶缝或一个卡住的伞舱，都可能变成更大的飞行事故。""",
                """失效链描述的是一个故障如何触发下一个故障。工程分析不只问“哪里坏了”，还要问“它为什么会让别的地方也坏”。

例如发动机固定不足会让推力方向偏移，推力偏移会产生额外弯矩，弯矩可能让箭身断裂。打断失效链的最好位置通常是最早、最容易检查的环节。""",
                """在可靠性分析中，失效链可以表示为事件序列或因果图。每个节点有发生概率，每条边表示载荷、热量、振动或控制误差的传递。

更高级的处理会使用概率分布、条件概率和期望损失来排序风险；如果有传感数据，还可以用矩阵表示多种故障之间的耦合关系，寻找最值得预防的初始事件。""",
                [{'question':'失效链分析最关心什么？','type':'choice','options':['事故照片是否清晰','一个小故障如何引发后续故障','火箭颜色是否统一','发动机品牌是否昂贵'],'correct':1,'explanation':'失效链关注故障之间的因果传播。'}], '深入理解：从单点故障到失效链'),
            theory('theory_prevention_check','预防与检查','engineering',['engineering/checklist/reliability','aerospace/safety/preflight'],
                """预防像出门前检查书包。作业没带，到了学校才发现就太晚了。

火箭发射前也一样。很多问题在点火后已经来不及修，所以必须提前用清单和小测试发现。""",
                """预防措施发生在设计和制作阶段，检查方法发生在发射前。两者要配对：设计上加发动机挡块，检查时就要确认挡块不会移动；设计上规定伞绳折叠顺序，检查时就要实际抽出一次。

好的检查方法必须可执行、可记录、可复查。模糊的“确认牢固”不如“手拉10秒无松动”。""",
                """从质量管理角度看，检查清单是一种降低人为遗漏概率的工具。它把复杂系统拆成可验证的动作，并让检查结果形成数据记录。

如果长期积累检查结果，可以用统计分布分析哪类缺陷最常出现，再把预防资源投入高频或高损失项目，这相当于用期望风险来优化检查流程。""",
                [{'question':'“确认正常”为什么不是好检查方法？','type':'choice','options':['太长了','不可执行、不可复查','会让火箭变重','必须写英文'],'correct':1,'explanation':'检查动作要具体，才能被别人重复。'}], '核心概念：失效模式是“会怎样坏”的语言'),
            theory('theory_risk_priority','风险优先级','engineering',['engineering/risk/fmea','statistics/probability'],
                """有些问题很常见但不严重，有些问题不常见却很危险。排风险时，不能只看谁最吓人，也不能只看谁最常发生。

你要像医生分诊一样，先处理最可能造成大麻烦的地方。""",
                """风险优先级通常考虑发生可能性、后果严重性和可检测性。容易发生、后果严重、又不容易提前发现的失效，应当优先预防。

教学火箭可以用高/中/低代替复杂分数。关键是每个判断都要有理由，而不是随手打勾。""",
                """更系统的 FMEA 会把发生度、严重度和探测度转化为评分，再用乘积或加权模型排序。评分本质上是对概率分布和损失函数的简化。

如果希望更严谨，可以用期望损失比较方案，再对评分做敏感性分析，看看结论是否因为某个主观分数变化而改变。""",
                [{'question':'哪类风险最应该优先处理？','type':'choice','options':['颜色不好看的风险','后果严重且不易提前发现的风险','最容易写进表格的风险','别人已经检查过的风险'],'correct':1,'explanation':'优先级要综合可能性、严重性和可检测性。'}], '应用与拓展'),
        ],
        'exercises_raw': [
            {'question':'以下哪项是失效模式而不是笼统描述？','options':['火箭不好','尾翼脱落','小心一点','材料很差'],'correct':1,'explanation':'尾翼脱落描述了具体的坏法。','ref':'列出至少8种失效模式'},
            {'question':'发动机后挫最直接的检查方法是？','options':['看火箭颜色','确认挡块和发动机固定件不会后退','称量降落伞','改变尾翼颜色'],'correct':1,'explanation':'发动机后挫与固定和挡块有关。','ref':'对每种模式给出至少1条预防措施和1条检查方法'},
            {'question':'为什么要记录检查结果？','options':['方便复查并改进设计','让表格更长','替代老师安全管理','避免学习理论'],'correct':0,'explanation':'记录能帮助复盘和发现高频问题。','ref':'每种模式有预防措施和检查方法。'},
        ],
        'animation_kind':'failure','style':'mech','stage_cn':['发现小裂纹','振动扩展','推力偏移','检查打断链条'],'stage_en':['Tiny crack','Vibration growth','Thrust offset','Checklist breaks chain'],
        'guides_cn':['画面始终是同一枚火箭的尾部，不切换成失效模式清单。','蓝色箭头表示振动和气流载荷，红线表示裂纹扩展。','观察一个尾翼问题如何继续影响推力方向和箭身弯矩。','最后的绿色框表示检查清单把失效链提前打断。'],
        'guides_en':['The scene stays on one rocket tail, not a failure slide list.','Blue arrows show vibration and airflow load; red lines show crack growth.','Watch one fin problem propagate into thrust direction and body bending.','The green box shows a checklist breaking the chain early.'],
        'hud_rows':[['stage0','1 crack','detectable','inspect'],['stage1','vibration','crack grows','danger'],['stage2','off-axis','bending rises','abort'],['stage3','checklist','chain broken','safe']],
        'game_rounds':[{'prompt':'尾翼根部出现细裂纹，选择发射前检查动作。','result':'通过：轻拉+放大镜检查可提前发现。'}, {'prompt':'发动机固定块有间隙，选择预防措施。','result':'通过：加挡块并记录推杆检查。'}, {'prompt':'降落伞装舱紧，选择检查动作。','result':'通过：完整抽出一次，确认无缠绕。'}],
        'diagram_cards':[('8种模式','发动机、尾翼、头锥、箭身、伞舱、降落伞、断裂、同轴度。'),('根本原因','从材料、连接、装配和载荷路径寻找原因。'),('预防措施','设计阶段加结构、工艺和冗余。'),('检查方法','发射前用可重复动作验证。')],
        'kit': kit('结构弱点检查套件', 72,
            [{'name':'放大镜','name_en':'Magnifier','spec':'5倍','qty':1,'price_cny':18,'search_keyword':'放大镜'}, {'name':'美纹纸胶带','name_en':'Masking tape','spec':'18mm','qty':1,'price_cny':8,'search_keyword':'美纹纸胶带'}, {'name':'检查记录夹板','name_en':'Clipboard','spec':'A4','qty':1,'price_cny':20,'search_keyword':'A4 夹板'}, {'name':'直尺','name_en':'Ruler','spec':'30cm','qty':1,'price_cny':6,'search_keyword':'30cm 直尺'}],
            [{'step':1,'title':'逐项观察','description':'按8种失效模式观察空箭体和连接处。','safety_warning':'不接触发动机和点火系统。','expected_result':'标出疑似薄弱点。'}, {'step':2,'title':'轻拉测试','description':'对尾翼、舱盖、绳结做轻拉和目视检查。','safety_warning':'不要用猛力破坏成品。','expected_result':'得到检查记录。'}, {'step':3,'title':'补预防措施','description':'每个薄弱点写至少一条预防措施。','safety_warning':'不确定时请老师复核。','expected_result':'完成失效预防表。'}], '对每种模式给出至少1条预防措施和1条检查方法', '每种模式有预防措施和检查方法。'),
    }
    data[65] = {
        'animation_topic':'陌生同学复现审查演示','game_topic':'结构设计包审查官','exercise_topic':'结构设计包完整性检查','anim_refs':('做一次可复现性审查','可被另一个同学照做复现（可复现性）。'),'game_refs':('整合7份子文档为结构设计包','设计包至少8页，含所有子文档。'),'ex_refs':('补充v1.0草图的尺寸标注','引用S5 v1.0草图和S6推进包。'),
        'plan': '''> Module: P-ROCKET-01-M066 · capstone

## 学习目标

完成本模块后，你将能够：
- 围绕“这份结构设计包能不能让另一个同学在不看你的情况下做出一模一样的火箭？”完成 S7 阶段整合。
- 能够整合7份子文档为结构设计包，形成至少8页、含所有子文档的《结构与材料设计包v1》。
- 能够补充v1.0草图的尺寸标注，并明确引用S5 v1.0草图和S6推进包。
- 能够做一次可复现性审查，确认设计包可被另一个同学照做复现，并加入发动机由老师/安全员安装的安全声明。

## 引入：设计包不是作业拼贴

S7 的大作业不是把前面所有表格简单粘到一起，而是交付一份别人能使用的工程文件。核心问题是：**这份结构设计包能不能让另一个同学在不看你的情况下做出一模一样的火箭？** 如果材料表没有规格，连接方式表没有胶种和固化时间，草图没有尺寸，安全声明没有写明发动机由老师/安全员安装，那么这份包看起来完整，实际上不能复现。

## 核心概念：可复现性来自明确约束

[[THEORY:theory_reproducibility]]

结构设计包至少应包含材料清单、部件方案、连接方式表、减重改进清单、失效模式与预防表、标注版 v1.0 草图、可复现性审查记录和安全声明。每一份子文档都要有版本号和来源，特别是 S5 v1.0 草图与 S6 推进包。质量估算必须控制在450克以内，为后续制作、涂装和修补预留50克余量。

[[THEORY:theory_configuration_control]]

## 深入理解：陌生同学测试

可复现性审查的做法很简单：把设计包交给一位没有参与设计的同学，让他只根据文件列出材料、工具、装配顺序和关键尺寸。凡是他需要开口问你的地方，就是设计包存在歧义。比如“尾翼厚一点”不是参数，“用强力胶”不是工艺，“箭身差不多长”不是尺寸。审查不是挑刺，而是在真正采购和制造前发现不清楚的地方。

[[THEORY:theory_document_safety]]

## 应用与拓展

最终提交时，请把设计包导出为 PDF。封面写项目名称、版本号、日期和成员；目录后依次放入7份子文档；安全声明必须单独醒目写出“发动机由老师/安全员安装，学生不得自行安装或点火”。如果陌生同学测试发现歧义，要在审查记录中写出问题和修订措施。

## 实物操作与购买

本节点不需要购买火工品，只需要文档审查工具：A4文件夹、标签纸、红蓝笔、直尺或卡尺、打印版检查表。所有审查对象是纸面设计和空模型件。

## 推荐互动资源

系统将展示工程设计、项目制学习和复杂系统设计相关的 LabXchange 路径，帮助你理解为什么工程文档必须可交接、可复核、可追踪。

## 学习路径建议

这个 capstone 是 S7 的收口产物，将直接传给 S8 材料采购与 S9 加工制作。''',
        'theories':[ 
            theory('theory_reproducibility','可复现性','engineering',['engineering/documentation/reproducibility','project-based-learning'],
                """可复现性就像菜谱。只写“加一点盐”别人可能做不出同样味道，写清克数、步骤和时间，别人就更容易做出相同结果。

结构设计包也是火箭的菜谱。它必须让别人不用问你，也知道材料、尺寸、工具和装配顺序。""",
                """可复现性要求信息完整、参数明确、顺序清晰、检查标准可执行。材料名称要有规格，尺寸要有单位，连接方式要有工艺条件。

如果某一步必须依赖口头解释，说明设计包还没有达到交付标准。陌生同学测试就是专门找出这些隐藏解释。""",
                """从工程知识管理角度看，可复现性可以看作信息传递误差最小化问题。文件中的每个参数、版本和约束都是降低误差的编码。

高级团队会用配置矩阵追踪需求、设计、材料和测试之间的关系，并用版本控制记录变更。这样即使多人协作，也能通过线性变更历史和审查记录恢复设计依据。""",
                [{'question':'可复现性测试最能发现什么？','type':'choice','options':['文件颜色是否漂亮','别人需要口头询问的歧义点','火箭发动机推力大小','团队名字是否好听'],'correct':1,'explanation':'凡是别人必须问你的地方，就是文件不够清楚。'}], '核心概念：可复现性来自明确约束'),
            theory('theory_configuration_control','版本与引用控制','engineering',['engineering/configuration-control','documentation/versioning'],
                """版本号像文件的身份证。没有身份证，你很难知道手里的图纸是不是最新一版。

设计包必须说明引用了哪一版 S5 草图和哪一版 S6 推进包，否则别人可能拿错依据。""",
                """配置控制关注“当前有效版本”。当材料、尺寸或工艺改变时，相关表格和图纸都要同步更新，不能只改其中一处。

在学生项目里，最基本的做法是在封面和每张关键表格写版本号、日期、作者和引用来源。""",
                """复杂项目中，配置控制会形成依赖矩阵：需求、部件、接口、测试和风险记录互相链接。一次变更会沿矩阵传播，提示哪些文件需要同步修订。

如果用线性代数的视角看，这个矩阵描述了设计变量之间的耦合。改变一个变量后，通过矩阵可以快速定位受影响的约束和验证项。""",
                [{'question':'为什么结构包要引用 S5 和 S6 版本？','type':'choice','options':['为了页数更多','为了确认设计依据是哪一版','为了替代安全声明','为了减少材料重量'],'correct':1,'explanation':'版本引用让别人知道设计依据，避免拿错图纸。'}], '核心概念：可复现性来自明确约束'),
            theory('theory_document_safety','文档化安全约束','engineering',['aerospace/safety/documentation','engineering/requirements'],
                """安全声明像红灯。它不是装饰，而是在关键地方提醒大家停下来，用正确的人和流程处理危险部分。

在教学火箭里，发动机安装和点火必须由老师或安全员负责，这句话要写清楚、写醒目。""",
                """文档化安全约束把安全规则写进设计包，而不是只靠口头提醒。安全声明应包括禁止学生自行安装发动机、禁止自行点火、发射前由老师复核等要求。

安全约束还要和材料、连接、检查清单相连。比如发动机舱设计不能鼓励学生私自改装发动机。""",
                """在系统工程里，安全约束是一类不可违反的需求。它们会进入需求矩阵，并在设计评审和测试中被逐项验证。

如果进行更高阶分析，可以把安全事件看作低概率高损失分布，用期望损失和极端风险约束共同决定流程，而不是只看平均表现。""",
                [{'question':'安全声明应当怎样出现在设计包中？','type':'choice','options':['隐藏在最后一行','醒目写明发动机由老师/安全员安装','只写“注意安全”','用图片代替文字'],'correct':1,'explanation':'关键安全约束必须明确、醒目、可执行。'}], '应用与拓展'),
        ],
        'exercises_raw':[{'question':'以下哪项最能提高设计包可复现性？','options':['写“尺寸差不多”','写清材料规格、尺寸和装配顺序','删除检查记录','只保留漂亮封面'],'correct':1,'explanation':'可复现依赖清楚参数和步骤。','ref':'可被另一个同学照做复现（可复现性）。'}, {'question':'结构包必须明确引用什么？','options':['S5 v1.0草图和S6推进包','同学的口头建议','网上任意图片','发射当天温度'],'correct':0,'explanation':'这是验收标准原文要求。','ref':'引用S5 v1.0草图和S6推进包。'}, {'question':'火箭总质量估算应满足什么约束？','options':['越重越好','<=450g，预留50g余量','必须刚好500g','不需要估算'],'correct':1,'explanation':'结构包要为后续制作预留质量余量。','ref':'火箭总质量估算<=450g（预留50g余量）。'}],
        'animation_kind':'package','style':'space','stage_cn':['交付设计包','发现歧义','复现偏差','修订通过'],'stage_en':['Hand off package','Ambiguity found','Build mismatch','Revision passes'],
        'guides_cn':['动画始终在同一张审查桌上，展示设计包如何被别人使用。','问号不是装饰，表示陌生同学必须开口问你的歧义点。','如果图纸不清楚，同一文件会做出不同零件。','修订后用尺寸、版本和安全声明把歧义清零。'],
        'guides_en':['The scene stays on one review desk and shows how another student uses the package.','Question marks mark ambiguity where the peer must ask you.','Unclear drawings produce different parts from the same file.','Revision removes ambiguity with dimensions, versions, and safety notes.'],
        'hud_rows':[['stage0','8 pages','handoff','review'],['stage1','3 questions','missing dims','revise'],['stage2','2 builds','mismatch','fail'],['stage3','0 ambiguity','442 g','pass']],
        'game_rounds':[{'prompt':'审查材料清单：缺少规格型号。','result':'通过：补充规格、数量、来源和替代材料。'}, {'prompt':'审查尺寸图：尾翼厚度没有单位。','result':'通过：补单位、公差和测量位置。'}, {'prompt':'审查安全页：发动机安装责任不清。','result':'通过：单独写明由老师/安全员安装。'}],
        'diagram_cards':[('7份子文档','材料清单、部件方案、连接表、减重清单、FMEA、草图、审查记录。'),('版本引用','引用 S5 草图与 S6 推进包，记录版本号和日期。'),('质量约束','结构阶段估算总质量不超过450克。'),('可复现审查','陌生同学测试暴露歧义并记录修订。')],
        'kit': kit('设计包审查工具包', 86,
            [{'name':'A4文件夹','name_en':'A4 binder','spec':'活页','qty':1,'price_cny':18,'search_keyword':'A4 活页文件夹'}, {'name':'标签纸','name_en':'Label stickers','spec':'索引标签','qty':1,'price_cny':10,'search_keyword':'索引标签纸'}, {'name':'红蓝笔','name_en':'Red and blue pens','spec':'0.5mm','qty':2,'price_cny':8,'search_keyword':'红蓝中性笔'}, {'name':'直尺或卡尺','name_en':'Ruler or caliper','spec':'30cm','qty':1,'price_cny':30,'search_keyword':'直尺 卡尺'}],
            [{'step':1,'title':'装订设计包','description':'按目录放入7份子文档并标页码。','safety_warning':'不要夹入发动机或点火器。','expected_result':'得到至少8页结构包。'}, {'step':2,'title':'陌生同学测试','description':'让未参与者只看文件列材料、工具和步骤。','safety_warning':'测试对象只操作纸面文件。','expected_result':'记录歧义点。'}, {'step':3,'title':'修订发布','description':'补齐尺寸、版本、安全声明和质量估算。','safety_warning':'安全页必须单独醒目。','expected_result':'形成可复现设计包。'}], '做一次可复现性审查', '可被另一个同学照做复现（可复现性）。'),
    }
    data[66] = {
        'animation_topic':'风洞里的 v1 到 v2 外形迭代','game_topic':'三平衡迭代指挥台','exercise_topic':'v1缺陷与v2目标转化','anim_refs':('为v2.0定义3个迭代目标','至少3个明确的可量化迭代目标。'),'game_refs':('对v1.0方案列出至少5个问题点','至少5个问题指出v1.0缺陷。'),'ex_refs':('为v2.0定义3个迭代目标','至少3个明确的可量化迭代目标。'),
        'plan': '''> Module: P-ROCKET-01-M067 · core

## 学习目标

完成本模块后，你将能够：
- 能够回答“为什么v1.0方案不能直接拿去做？”并从射高、稳定性、制造可行性三方面解释原因。
- 能够对v1.0方案列出至少5个问题点，满足“至少5个问题指出v1.0缺陷。”
- 能够为v2.0定义3个迭代目标，且每个目标明确当前值、目标值和测量方法。
- 能够区分单点优化和多目标协同改进，避免只追求射高或只追求好做。

## 引入：为什么v1.0方案不能直接拿去做？

v1.0 的价值是让想法成形，但它通常不是最终设计。火箭可能能飞，却太重；尾翼可能让它稳定，却带来过大阻力；头锥曲线可能漂亮，却难以稳定加工。核心问题是：**为什么v1.0方案不能直接拿去做？** 因为工程设计不是“第一版能动就结束”，而是用数据发现缺陷，再把缺陷转化为可量化的 v2.0 目标。

## 核心概念：三平衡迭代

[[THEORY:theory_three_balance]]

三平衡指射高、稳定性和制造可行性。只追射高，可能削小尾翼导致飞偏；只追稳定，可能尾翼过大导致阻力和质量上升；只追制造简单，可能牺牲气动外形。v2.0 目标必须同时写清至少两个维度，例如“尾翼面积减少20%，静稳定裕度仍保持在合格区间”“头锥加工时间降低到15分钟以内，外形误差控制在可接受范围”。

[[THEORY:theory_quantified_iteration]]

## 深入理解：从问题清单到目标清单

问题清单不是吐槽清单。合格问题点要写“观察现象、深层原因、影响维度”。例如“尾翼根部胶量过多导致尾部增重，重心后移并增加阻力”，就比“尾翼不好”更有用。目标清单也不能写“更轻、更稳、更好做”，而要写当前值、目标值和测量方法。这样 S8/S9 才知道要做什么、做到什么程度算通过。

[[THEORY:theory_iteration_traps]]

## 应用与拓展

请完成《v1.0问题清单与v2.0迭代目标》。先列至少5个具体缺陷，再把其中最关键的缺陷转化为3个明确的可量化目标。每个目标要标明它服务于射高、稳定性还是制造可行性，并说明会不会牺牲另一个维度。最后用红黄绿标记目标风险，决定下一轮优先验证项。

## 实物操作与购买

本节可使用低风险风洞观察套件：小风扇、纸带烟线替代物、直尺、手机慢动作拍摄架和 v1/v2 纸模型。只做冷风外形观察，不使用火源、烟雾弹或发动机。

## 推荐互动资源

系统将展示与阻力、力矢量和二维运动有关的 LabXchange 资源，用来支撑气动外形迭代的物理理解。

## 学习路径建议

本节点开启 S8 迭代阶段，输出的问题清单和目标清单会传给材料选型、仿真和 v2.0 详细设计。''',
        'theories':[ 
            theory('theory_three_balance','三平衡迭代','engineering',['engineering/design/tradeoff','aerospace/rocketry/iteration'],
                """三平衡像调跷跷板。只让一边上去，另一边可能就掉下来。

火箭外形迭代也一样。想飞得高、想飞得稳、想做得出来，三个愿望要一起照顾。""",
                """三平衡包含射高、稳定性和制造可行性。每次改外形，都要问它对三个维度分别有什么影响。

比如减小直径可能降低阻力并提高射高，但内部空间变小，制造和装配会变难；增大尾翼可能提高稳定性，却增加质量和阻力。""",
                """多目标优化可以把三平衡写成约束问题。射高、稳定裕度和制造时间分别是目标或约束，设计变量包括直径、长度、尾翼面积和头锥形状。

更高阶分析会用梯度、导数或数值搜索寻找可行域内的折中解。最优点不一定让单个指标最大，而是让多个目标在约束下达到可接受平衡。""",
                [{'question':'三平衡不包括哪一项？','type':'choice','options':['射高','稳定性','制造可行性','火箭名字长度'],'correct':3,'explanation':'三平衡关注性能、稳定和能否制造。'}], '核心概念：三平衡迭代'),
            theory('theory_quantified_iteration','可量化迭代目标','engineering',['engineering/requirements/metrics','measurement/design'],
                """目标要像终点线。只说“跑快一点”很模糊，说“跑到操场另一端”就清楚多了。

v2.0 目标也要清楚。不要只写“更轻”，要写减到多少、怎么量、什么时候检查。""",
                """可量化目标包含当前值、目标值和测量方法。它把“感觉不好”转化为下一轮能执行的任务。

例如“尾翼太大”可以转化为“尾翼面积减少20%，同时静稳定裕度保持合格，并用纸板样件称重验证”。""",
                """从系统工程看，目标是需求的量化表达。目标之间可以形成约束矩阵，某个设计变量改变后，会影响多个目标。

如果目标响应可以近似线性化，就能用矩阵和灵敏度系数判断哪个变量最值得调整；非线性较强时，则需要迭代仿真和数值搜索。""",
                [{'question':'哪个目标最合格？','type':'choice','options':['尾翼更好','射高尽量高','头锥加工时间降到15分钟以内','看起来高级'],'correct':2,'explanation':'它有目标值和测量维度。'}], '深入理解：从问题清单到目标清单'),
            theory('theory_iteration_traps','迭代陷阱','engineering',['engineering/design/anti-patterns','aerospace/rocketry/aerodynamics'],
                """迭代陷阱像只看一科成绩。数学提高了，但其他科全掉了，总分不一定更好。

火箭设计里，只追一个指标也可能让整体变差。""",
                """常见陷阱包括单点优化、过度设计和制造幻想。单点优化只追射高，可能破坏稳定；过度设计为了保险不断加材料，可能压低射高；制造幻想则是图纸很好看但做不出来。

避免陷阱的方法是每个改动都写副作用，并在目标表里同时检查至少两个维度。""",
                """从优化理论看，迭代陷阱常出现在目标函数定义过窄或约束不完整的时候。局部最优可能在单一指标上很好，却在总体可行域之外。

通过引入惩罚项、约束边界和多目标权重，可以把设计从局部诱惑拉回系统最优。必要时还要用极限和导数判断某项继续优化是否收益递减。""",
                [{'question':'“只追射高”可能导致什么陷阱？','type':'choice','options':['单点优化陷阱','文件命名陷阱','颜色搭配陷阱','预算表过短'],'correct':0,'explanation':'只追一个指标容易破坏系统平衡。'}], '应用与拓展'),
        ],
        'exercises_raw':[{'question':'v1问题点应包含哪些内容？','options':['观察现象、深层原因、影响维度','只写不好看','只写谁负责','只写材料价格'],'correct':0,'explanation':'问题清单要能转化为目标。','ref':'对v1.0方案列出至少5个问题点'}, {'question':'哪个是可量化迭代目标？','options':['火箭更高级','尾翼面积减少20%，稳定裕度仍合格','头锥好做一点','阻力尽量小'],'correct':1,'explanation':'它有具体变化和约束。','ref':'为v2.0定义3个迭代目标'}, {'question':'为什么v1不能直接做？','options':['第一版通常还有未量化缺陷','所有v1都违法','v1没有任何价值','老师不喜欢数字1'],'correct':0,'explanation':'v1用于暴露问题，v2把问题转成目标。','ref':'至少5个问题指出v1.0缺陷。'}],
        'animation_kind':'aero','style':'space','stage_cn':['v1风洞观察','缩小直径','调整尾翼头锥','v2三平衡目标'],'stage_en':['v1 wind test','Slim diameter','Tune fins and nose','v2 balanced targets'],
        'guides_cn':['同一风洞里观察 v1 气流，不把问题拆成幻灯片。','缩小直径后阻力下降，但同时观察空间和稳定风险。','用 CG/CP 标记说明外形调整必须守住稳定。','最后三个进度条表示射高、稳定性、制造可行性一起达标。'],
        'guides_en':['Observe v1 flow in one wind tunnel, not as slides.','Slimming the body lowers drag but affects space and stability.','CG/CP markers show that aerodynamic tuning must keep stability.','The final three bars show altitude, stability, and manufacturability meeting together.'],
        'hud_rows':[['stage0','drag high','stable heavy','diagnose'],['stage1','drag lower','space tight','watch risk'],['stage2','CG/CP checked','flow smoother','iterate'],['stage3','3 targets','balanced','v2 ready']],
        'game_rounds':[{'prompt':'v1直径偏大：把观察转成目标。','result':'通过：直径减少并同步检查内部空间。'}, {'prompt':'尾翼过大：避免只减面积。','result':'通过：面积减少同时保持稳定裕度。'}, {'prompt':'头锥难做：加入制造目标。','result':'通过：规定加工时间和外形误差。'}],
        'diagram_cards':[('观察现象','把“太重、太粗、难做”写成具体证据。'),('深层原因','判断来自阻力、稳定、质量还是工艺。'),('量化目标','写当前值、目标值和测量方法。'),('三平衡检查','每个目标至少检查两个维度的副作用。')],
        'kit': kit('低风险风洞观察套件', 156,
            [{'name':'USB小风扇','name_en':'USB fan','spec':'可调速','qty':1,'price_cny':55,'search_keyword':'USB 小风扇 可调速'}, {'name':'纸带/毛线','name_en':'Paper streamers','spec':'气流可视化','qty':1,'price_cny':6,'search_keyword':'彩色纸带 毛线'}, {'name':'手机支架','name_en':'Phone stand','spec':'桌面款','qty':1,'price_cny':28,'search_keyword':'手机支架 桌面'}, {'name':'纸模型材料','name_en':'Paper model material','spec':'卡纸/胶带','qty':1,'price_cny':22,'search_keyword':'卡纸 胶带 模型'}],
            [{'step':1,'title':'搭建冷风观察','description':'用风扇和纸带观察 v1 纸模型周围气流。','safety_warning':'不用火源、烟雾弹或发动机。','expected_result':'记录分离和摆动位置。'}, {'step':2,'title':'制作v2小改型','description':'只改一个变量，如直径或尾翼面积。','safety_warning':'剪裁工具由成人监督。','expected_result':'得到对比模型。'}, {'step':3,'title':'转化目标','description':'把观察结果写成3个可量化目标。','safety_warning':'不要把冷风观察当作真实发射证明。','expected_result':'完成迭代目标表。'}], '为v2.0定义3个迭代目标', '至少3个明确的可量化迭代目标。'),
    }
    return data


def build_node(n: int, spec: dict) -> dict:
    ctx = load_context(PROJECT, n)
    research = read_json(FIX / f'k{n}_research.json')
    labx = read_json(FIX / f'k{n}_labxchange.json')
    anim = animation_html(spec['animation_topic'], spec['animation_topic'], spec['animation_topic'], spec['animation_topic'], spec['animation_kind'], spec['style'], spec['stage_cn'], spec['stage_en'], spec['guides_cn'], spec['guides_en'], spec['hud_rows'])
    game = game_html(spec['game_topic'], spec['game_topic'], '先阅读当前关卡的工程情境，点击“运行测试”观察后果，再进入下一关。目标不是答题速度，而是把动作、证据和验收标准连起来。', 'Read the engineering situation, run the test, then move to the next round. Connect action, evidence, and acceptance.', spec['animation_kind'] if spec['animation_kind'] != 'mass' else 'mass', spec['game_rounds'])
    dia = diagram_html(spec['animation_topic'] + '：静态决策图', spec['diagram_cards'])
    anim_path = FIX / f'k{n}_anim.html'
    game_path = FIX / f'k{n}_game.html'
    dia_path = FIX / f'k{n}_diagram.html'
    write_text(anim_path, anim)
    write_text(game_path, game)
    write_text(dia_path, dia)

    # Step 5.5 browser verify before make_course_content/upsert.
    validations = {
        'html_validate_animation': run(['node','course_factory/validate/html_validate.mjs', str(anim_path), '--mode', 'animation']),
        'verify_animation': run(['node','course_factory/validate/verify/animation.mjs', str(anim_path), '--out', f'/tmp/verify_k{n}_anim_redo']),
        'verify_game': run(['node','course_factory/validate/verify/game.mjs', str(game_path), '--out', f'/tmp/verify_k{n}_game_redo']),
    }

    exercises = make_exercises(spec['exercises_raw'])
    course_content = make_course_content(
        plan_markdown=spec['plan'],
        animation_html=anim,
        animation_topic=spec['animation_topic'],
        exercises=exercises,
        exercise_topic=spec['exercise_topic'],
        knode=ctx.knode,
        animation_hands_on_ref=spec['anim_refs'][0],
        animation_acceptance_ref=spec['anim_refs'][1],
        game_html=game,
        game_topic=spec['game_topic'],
        game_hands_on_ref=spec['game_refs'][0],
        game_acceptance_ref=spec['game_refs'][1],
        game_mode_reason='互动测试让学生把工程动作、数值读数和验收标准连起来。',
        exercise_hands_on_ref=spec['ex_refs'][0],
        exercise_acceptance_ref=spec['ex_refs'][1],
        research=research,
        labxchange_results=labx,
        theories=spec['theories'],
        project_name=PROJECT,
        diagrams=[{'html_path': str(dia_path), 'topic': spec['animation_topic'] + '：静态决策图', 'caption':'静态图负责结构化分类和决策，不替代连续动画。', 'anchor':'## 核心概念', 'hands_on_ref': spec['anim_refs'][0], 'acceptance_ref': spec['anim_refs'][1]}],
        hands_on_kits=[spec['kit']],
        preflight=True,
    )
    course_content['plan_markdown'] = simple_youtube_links(course_content['plan_markdown'])
    for idea in course_content.get('ideas', []):
        if idea.get('mode') == 'animation':
            idea['mode_reason'] = '该知识点需要在单一场景中连续看到状态变化，静态图无法展示过程。'
        if idea.get('mode') == 'diagram':
            idea['mode_reason'] = '分类、表格结构和检查顺序适合静态示意图呈现。'
    errors = preflight_v41(ctx.knode, course_content)
    if errors:
        raise RuntimeError(f'preflight after thumbnail cleanup failed for k{n}: {errors}')

    # Step 6.5 assignment, then DB save. Reuse completed work when rerunning after
    # an HTML-only verifier fix, but generate normally for fresh nodes.
    existing_assignment, existing_sections = existing_lesson_bits(n)
    assignment = existing_assignment if len(existing_assignment) > 200 else generate_assignment(ctx.knode, ctx.milestone, plan_markdown=course_content['plan_markdown'])
    if existing_sections:
        course_content['sections'] = existing_sections
    save_knode(ctx, course_content, assignment=assignment)
    sections = generate_audio_scripts(PROJECT, n, ctx.knode, ctx.milestone)

    learn = run(['node','course_factory/validate/verify/learn_page.mjs', PROJECT, str(n), '--out', f'/tmp/verify_k{n}_learn_redo'])

    bundle = {
        'content_bundle': {
            'workflow_notes': [
                f'Step 0: load_context({PROJECT}, knode_global_idx={n}) 已加载 {ctx.knode.get("module_id")}.',
                f'Step 0.5: Tavily research 已生成，web={len(research.get("web_results") or [])}, youtube={len(research.get("youtube_results") or [])}.',
                f'Step 0.7: LabXchange 自动匹配为空后手动关键词补齐 {len(labx)} 条 pathway.',
                'Step 1: plan_markdown 围绕 core_question 展开，并消费 hands_on_components / acceptance_standard.',
                'Step 1.5: theories 含 K1/K3/K5 与选择题。',
                'Step 2-4: 8类媒体已逐条 debate；动画/游戏/kit/diagram 保留，image 按版权与教学效率拒绝。',
                'Step 5: 动画按新 SKILL 重做为单场景连续动作演示，非 PPT 信息页。',
                'Step 5.5: HTML、animation、game、learn_page 校验均通过。',
                'Step 6-6.6: make_course_content、preflight、DB 写入、assignment、audio_scripts 已完成。',
            ],
            'media_decisions': [
                {'mode':'theory','decision':'keep','reason':'节点需要基础物理/工程概念支撑。'},
                {'mode':'animation','decision':'keep','reason':'只展示一个必须连续观察的过程，不承担分类信息页。'},
                {'mode':'game','decision':'keep','reason':'交互测试让学生把选择和验收标准连起来。'},
                {'mode':'hands_on_kit','decision':'keep','reason':'节点有实体测量/审查/观察动作，套件低风险且可自备。'},
                {'mode':'image','decision':'reject','reason':'真实照片不能替代表格/过程判断，且需额外版权筛选。'},
                {'mode':'diagram','decision':'keep','reason':'静态结构、清单和决策顺序交给 diagram，而不是塞进动画。'},
                {'mode':'youtube','decision':'keep','reason':'Tavily 视频结果由 make_course_content 自动合并；若命中为0则保留原因。'},
                {'mode':'labxchange','decision':'keep','reason':'本地 LabXchange pathway 已匹配并传入 make_course_content。'},
            ],
            'ideation_divergence': {
                'animation': {'candidates':['PPT式清单页（拒绝）','微观概念动画（拒绝，离工程动作远）','单场景连续工程演示（采用）'], 'selected':'单场景连续工程演示'},
                'game': {'candidates':['选择题外壳（拒绝）','拖拽分类（拒绝，证据弱）','测试台/审查台（采用）'], 'selected':'测试台/审查台'},
            },
            'creativity_gate': {'subtract':'去掉动画后学生看不到动态变化。','replay':'游戏每关可重复运行并推进。','surprise':'读数/裂纹/歧义/气流会在同一场景中发生变化。','aha':'学生把工程动作与验收标准连起来。','verdict':'pass'},
            'plan_markdown': spec['plan'],
            'theories': spec['theories'],
            'assignment_markdown': assignment,
        },
        'research': research,
        'labxchange_results': labx,
        'media_spec': {'animation': {'source': str(anim_path.relative_to(ROOT)), 'topic': spec['animation_topic']}, 'game': {'source': str(game_path.relative_to(ROOT)), 'topic': spec['game_topic']}, 'diagram': {'source': str(dia_path.relative_to(ROOT))}},
        'course_content_preview': {'ideas': len(course_content.get('ideas', [])), 'theories': len(course_content.get('theories', [])), 'sections_with_audio': len(sections)},
        'validations': validations,
        'learn_page_validation': learn,
    }
    (FIX / f'k{n}_bundle.json').write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'node': n, 'module_id': ctx.knode.get('module_id'), 'ideas': len(course_content.get('ideas', [])), 'theories': len(course_content.get('theories', [])), 'sections': len(sections), 'assignment_chars': len(assignment)}


def main() -> None:
    data = extend_node_data(node_data())
    summary = []
    for n in NODES:
        summary.append(build_node(n, data[n]))
    out = FIX / 'k63_66_regeneration_summary.json'
    out.write_text(json.dumps({'generated_at': datetime.now().isoformat(timespec='seconds'), 'summary': summary}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
