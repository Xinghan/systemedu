import type { CourseContent, CourseIdeaSummary } from "@/lib/types/api"
import baseCourseContent from "./rocket-design-node-22.json"

const ANIMATION_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{
  --phys-0: oklch(0.78 0.13 215);
  --phys-1: oklch(0.55 0.13 215);
  --phys-2: oklch(0.35 0.10 215);
  --phys-3: oklch(0.92 0.08 215);
  --gold: oklch(0.85 0.14 85);
  --bg-0: oklch(0.14 0.035 265);
  --bg-1: oklch(0.18 0.04 265);
  --bg-2: oklch(0.22 0.045 265);
  --bg-3: oklch(0.28 0.05 265);
  --fg: oklch(0.96 0.01 265);
  --fg-dim: oklch(0.75 0.02 265);
  --fg-mute: oklch(0.55 0.03 265);
  --line: oklch(0.35 0.05 265 / 0.35);
  --line-strong: oklch(0.55 0.08 265 / 0.55);
  --scan: rgba(120, 203, 255, 0.08);
  --sidebar-w: 220px;
  --radius: 14px;
  --bg-main: linear-gradient(180deg, var(--bg-0), var(--bg-1));
  --bg-panel: linear-gradient(180deg, color-mix(in oklch, var(--bg-2), transparent 18%), color-mix(in oklch, var(--bg-1), transparent 12%));
  --bg-panel-strong: linear-gradient(180deg, color-mix(in oklch, var(--bg-3), transparent 8%), color-mix(in oklch, var(--bg-2), transparent 8%));
  --text-main: var(--fg);
  --text-dim: var(--fg-dim);
  --text-mute: var(--fg-mute);
  --accent: var(--phys-0);
  --accent-strong: var(--phys-1);
  --accent-soft: color-mix(in oklch, var(--phys-0), transparent 85%);
  --sb-bg: color-mix(in oklch, var(--bg-1), transparent 8%);
  --sb-border: var(--line);
  --sb-accent: var(--accent);
  --sb-dim: var(--text-dim);
  --sb-mute: var(--text-mute);
  --sb-btn-bd: color-mix(in oklch, var(--accent), transparent 55%);
  --sb-btn-bg: transparent;
  --hud-bg: color-mix(in oklch, var(--bg-2), transparent 12%);
  --hud-border: var(--line);
  --hud-label: var(--text-mute);
  --hud-value: var(--text-main);
  --ctrl-bg: linear-gradient(135deg, var(--accent), var(--gold));
  --ctrl-color: #04121e;
  --grid-color: rgba(255,255,255,0.05);
}
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{
  font-family:"Inter","Noto Sans SC",sans-serif;
  background:var(--bg-main);
  color:var(--text-main);
}
.app{
  display:grid;
  grid-template-columns:var(--sidebar-w) 1fr;
  width:100%;
  height:100vh;
}
.sidebar{
  position:relative;
  min-width:0;
  padding:16px 14px;
  background:var(--sb-bg);
  border-right:1px solid var(--sb-border);
  display:flex;
  flex-direction:column;
  gap:10px;
  overflow-y:auto;
  padding-bottom:18px;
  scrollbar-width:thin;
}
.sidebar::before{
  content:"";
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 20% 0%, color-mix(in oklch, var(--accent), transparent 78%), transparent 45%),
    radial-gradient(circle at 100% 100%, color-mix(in oklch, var(--gold), transparent 86%), transparent 35%);
  pointer-events:none;
}
.sidebar > *{position:relative;z-index:1}
.lang-row{display:flex;gap:8px;align-items:center}
.lang-btn,.scene-btn,.ctrl-btn,.vm-btn{
  font-family:"JetBrains Mono",monospace;
  letter-spacing:0.08em;
  text-transform:uppercase;
}
.lang-btn{
  border:1px solid var(--sb-btn-bd);
  background:var(--sb-btn-bg);
  color:var(--sb-accent);
  padding:6px 10px;
  font-size:10px;
  font-weight:700;
  cursor:pointer;
}
.style-switcher{display:flex;gap:4px;margin:2px 0 4px}
.vm-btn{
  border:1px solid var(--sb-btn-bd);
  background:var(--sb-btn-bg);
  color:var(--sb-dim);
  padding:4px 6px;
  font-size:8px;
  font-weight:700;
  cursor:pointer;
  transition:all .18s ease;
}
.vm-btn:hover,.vm-btn.vm-active{
  color:var(--sb-accent);
  border-color:var(--sb-accent);
  background:color-mix(in oklch, var(--accent), transparent 88%);
}
.meta{
  display:grid;
  gap:4px;
  padding:14px 12px;
  border:1px solid var(--line);
  border-radius:var(--radius);
  background:var(--bg-panel);
  position:relative;
  overflow:hidden;
}
.meta::before,.meta::after,.info-panel::before,.info-panel::after,.hud-card::before,.hud-card::after{
  content:"";
  position:absolute;
  width:10px;
  height:10px;
  border:1px solid color-mix(in oklch, var(--accent), transparent 40%);
  opacity:.55;
}
.meta::before,.info-panel::before,.hud-card::before{top:8px;left:8px;border-right:none;border-bottom:none}
.meta::after,.info-panel::after,.hud-card::after{right:8px;bottom:8px;border-left:none;border-top:none}
.eyebrow{
  font-family:"JetBrains Mono",monospace;
  font-size:10px;
  color:var(--gold);
  letter-spacing:.14em;
}
.title{
  font-family:"Space Grotesk",sans-serif;
  font-size:22px;
  line-height:1.1;
  font-weight:700;
}
.subline{
  font-size:12px;
  line-height:1.6;
  color:var(--text-dim);
}
.progress-chip{
  display:inline-flex;
  align-items:center;
  width:max-content;
  padding:6px 10px;
  border:1px solid var(--line);
  border-radius:999px;
  background:var(--bg-panel);
  font-family:"JetBrains Mono",monospace;
  font-size:10px;
  color:var(--text-dim);
  letter-spacing:.12em;
  text-transform:uppercase;
}
.scene-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.scene-btn{
  border:1px solid var(--line);
  background:var(--bg-panel);
  color:var(--text-main);
  text-align:left;
  padding:10px 12px;
  font-size:10px;
  cursor:pointer;
  border-radius:12px;
  transition:all .18s ease;
}
.scene-btn small{
  display:block;
  margin-top:4px;
  font-size:10px;
  color:var(--text-mute);
  letter-spacing:0;
  text-transform:none;
}
.scene-btn.active{
  border-color:color-mix(in oklch, var(--accent), transparent 20%);
  background:linear-gradient(180deg, color-mix(in oklch, var(--accent), transparent 88%), color-mix(in oklch, var(--bg-3), transparent 8%));
  transform:translateX(2px);
}
.palette{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:8px;
}
.swatch{
  border:1px solid var(--line);
  padding:8px;
  border-radius:12px;
  background:var(--bg-panel);
}
.swatch .label{
  display:block;
  font-family:"JetBrains Mono",monospace;
  font-size:9px;
  color:var(--text-mute);
  letter-spacing:.12em;
}
.swatch .value{
  display:block;
  margin-top:5px;
  font-size:11px;
  font-weight:700;
  color:var(--text-main);
}
.main{
  position:relative;
  min-width:0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.main::before{
  content:"";
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 70% 10%, color-mix(in oklch, var(--accent), transparent 84%), transparent 25%),
    radial-gradient(circle at 10% 100%, color-mix(in oklch, var(--gold), transparent 92%), transparent 28%);
  pointer-events:none;
}
.content{
  position:relative;
  z-index:1;
  display:flex;
  flex-direction:column;
  height:100%;
  min-height:0;
  padding:16px 18px 18px;
  gap:14px;
}
.hero{
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:flex-start;
}
.hero-copy h1{
  margin:0;
  font-family:"Space Grotesk",sans-serif;
  font-size:30px;
  line-height:1.14;
  letter-spacing:-0.03em;
  padding-bottom:4px;
}
.hero-copy p{
  margin:8px 0 0;
  color:var(--text-dim);
  font-size:13px;
  line-height:1.7;
  max-width:760px;
}
.hero-badges{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.hud-card{
  min-width:132px;
  padding:12px 14px;
  border:1px solid var(--hud-border);
  border-radius:var(--radius);
  background:var(--hud-bg);
  position:relative;
  overflow:hidden;
}
.hud-card .k{
  font-family:"JetBrains Mono",monospace;
  font-size:10px;
  color:var(--hud-label);
  letter-spacing:.12em;
  text-transform:uppercase;
}
.hud-card .v{
  margin-top:6px;
  font-size:14px;
  font-weight:700;
  color:var(--hud-value);
}
.stage{
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns:1fr 310px;
  gap:16px;
}
.arena{
  position:relative;
  isolation:isolate;
  overflow:hidden;
  border-radius:18px;
  border:1px solid var(--line);
  background:linear-gradient(180deg, color-mix(in oklch, var(--bg-2), transparent 8%), color-mix(in oklch, var(--bg-0), transparent 0%));
}
.bg-canvas{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  display:block;
  z-index:0;
}
.arena::before{
  content:"";
  position:absolute;
  inset:0;
  background:
    linear-gradient(transparent 0 calc(100% - 70px), color-mix(in oklch, var(--phys-2), transparent 14%) calc(100% - 70px) 100%),
    linear-gradient(90deg, transparent 0 7%, color-mix(in oklch, var(--accent), transparent 90%) 7% 8%, transparent 8% 92%, color-mix(in oklch, var(--accent), transparent 90%) 92% 93%, transparent 93% 100%);
  pointer-events:none;
  z-index:0;
}
.grid{
  position:absolute;
  inset:0;
  background-image:
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size:64px 64px;
  opacity:.55;
  z-index:1;
}
.scene-header{
  position:absolute;
  top:14px;
  left:18px;
  right:18px;
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
  z-index:2;
}
.scene-header .left .code{
  font-family:"JetBrains Mono",monospace;
  color:var(--gold);
  font-size:10px;
  letter-spacing:.16em;
}
.scene-header .left .name{
  margin-top:6px;
  font-size:17px;
  font-weight:700;
}
.scene-header .left .tip{
  margin-top:6px;
  font-size:12px;
  color:var(--text-dim);
  max-width:520px;
  line-height:1.6;
}
.props{
  display:flex;
  gap:10px;
  align-items:center;
}
.prop{
  width:54px;
  height:54px;
  border:1px solid var(--line);
  background:var(--bg-panel);
  border-radius:14px;
  display:grid;
  place-items:center;
}
.prop svg{
  width:30px;
  height:30px;
  stroke:var(--accent);
  fill:none;
  stroke-width:1.5;
  opacity:.92;
}
.lanes{
  position:absolute;
  inset:108px 18px 82px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:22px;
  z-index:2;
}
.lane{
  position:relative;
  border:1px solid color-mix(in oklch, var(--line-strong), transparent 35%);
  border-radius:18px 18px 0 0;
  background:linear-gradient(180deg, color-mix(in oklch, var(--accent), transparent 94%), transparent 34%);
}
.lane::before{
  content:"";
  position:absolute;
  left:12px;
  right:12px;
  bottom:0;
  border-top:2px dashed color-mix(in oklch, var(--phys-3), transparent 28%);
}
.lane-head{
  padding-top:14px;
  text-align:center;
}
.lane-title{
  font-size:16px;
  font-weight:700;
}
.lane-note{
  margin-top:4px;
  color:var(--text-mute);
  font-size:11px;
}
.drop-zone{
  position:absolute;
  inset:72px 16px 20px;
}
.object{
  position:absolute;
  left:50%;
  top:12px;
  transform:translateX(-50%);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:800;
  color:#042032;
  letter-spacing:.02em;
  box-shadow:0 0 36px color-mix(in oklch, var(--accent), transparent 86%);
}
.object.ball,.object.small{border-radius:50%}
.object.ball{width:74px;height:74px}
.object.small{width:62px;height:62px}
.object.paper{width:112px;height:26px;border-radius:10px}
.object.book{width:126px;height:34px;border-radius:12px;color:#f8fafc}
.object.metal{background:linear-gradient(180deg, color-mix(in oklch, var(--phys-3), transparent 12%), var(--phys-0))}
.object.wood{background:linear-gradient(180deg, #ffd48d, #df9d43)}
.object.paperFlat{background:linear-gradient(180deg, #fffdf2, #e8dfc7)}
.object.bookObj{background:linear-gradient(180deg, #f25f5c, #b42318)}
.field-arc{
  position:absolute;
  left:50%;
  top:82px;
  width:280px;
  height:140px;
  transform:translateX(-50%);
  border-top:1px dashed color-mix(in oklch, var(--accent), transparent 35%);
  border-radius:280px 280px 0 0;
  opacity:.6;
  z-index:1;
}
.field-lines{
  position:absolute;
  left:50%;
  bottom:30px;
  width:340px;
  height:110px;
  transform:translateX(-50%);
  opacity:.38;
  z-index:1;
}
.field-lines svg{width:100%;height:100%}
.info-panel{
  position:relative;
  border:1px solid var(--line);
  border-radius:18px;
  padding:16px;
  background:var(--bg-panel-strong);
  display:flex;
  flex-direction:column;
  gap:12px;
  overflow:hidden;
}
.info-panel h3{
  margin:0;
  font-family:"Space Grotesk",sans-serif;
  font-size:19px;
}
.info-panel p{
  margin:0;
  color:var(--text-dim);
  font-size:13px;
  line-height:1.7;
}
.note-box{
  border:1px solid var(--line);
  background:color-mix(in oklch, var(--bg-3), transparent 10%);
  border-radius:12px;
  padding:12px;
}
.note-box strong{
  display:block;
  margin-bottom:6px;
  font-family:"JetBrains Mono",monospace;
  font-size:10px;
  color:var(--accent);
  letter-spacing:.14em;
  text-transform:uppercase;
}
.note-box span{
  color:var(--text-main);
  font-size:13px;
  line-height:1.65;
}
.controls{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-top:auto;
}
.ctrl-btn{
  border:1px solid var(--line);
  background:var(--ctrl-bg);
  color:var(--ctrl-color);
  padding:10px 12px;
  font-size:10px;
  font-weight:700;
  cursor:pointer;
  border-radius:12px;
}
.ctrl-btn.secondary{
  background:var(--bg-panel);
  color:var(--text-main);
}
body.mode-light{
  --bg-main: linear-gradient(180deg, #fafaf5, #f0f0ea);
  --bg-panel: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(244,244,238,0.92));
  --bg-panel-strong: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(240,240,234,0.98));
  --text-main: #0f172a;
  --text-dim: rgba(15,23,42,0.76);
  --text-mute: rgba(15,23,42,0.5);
  --sb-bg: rgba(255,255,255,0.92);
  --sb-border: rgba(15,23,42,0.08);
  --sb-dim: rgba(15,23,42,0.58);
  --sb-mute: rgba(15,23,42,0.42);
  --hud-bg: rgba(255,255,255,0.92);
  --hud-border: rgba(15,23,42,0.08);
  --hud-label: rgba(15,23,42,0.45);
  --hud-value: #0f172a;
  --ctrl-bg: linear-gradient(135deg, var(--phys-0), var(--gold));
  --ctrl-color: #0f172a;
  --grid-color: rgba(15,23,42,0.04);
  --scan: transparent;
}
body.mode-light .arena{
  box-shadow: inset 0 0 0 6px rgba(15,23,42,0.04);
}
body.mode-dark{
  --bg-main: linear-gradient(180deg, #0a0a0a, #111111);
  --bg-panel: linear-gradient(180deg, rgba(25,25,25,0.86), rgba(15,15,15,0.96));
  --bg-panel-strong: linear-gradient(180deg, rgba(31,31,31,0.92), rgba(18,18,18,0.98));
  --text-main: #e5e5e5;
  --text-dim: rgba(229,229,229,0.72);
  --text-mute: rgba(229,229,229,0.46);
  --sb-bg: rgba(12,12,12,0.92);
  --sb-border: rgba(255,255,255,0.1);
  --sb-dim: rgba(229,229,229,0.66);
  --sb-mute: rgba(229,229,229,0.4);
  --hud-bg: rgba(18,18,18,0.88);
  --hud-border: rgba(255,255,255,0.08);
  --hud-label: rgba(229,229,229,0.45);
  --hud-value: #e5e5e5;
  --grid-color: rgba(255,255,255,0.03);
}
body.mode-dark .hero::before{
  content:"";
  position:absolute;
  left:0;
  right:0;
  top:0;
  height:2px;
  background:linear-gradient(90deg, transparent, var(--accent), transparent);
}
body.mode-cyberpunk{
  --bg-main: linear-gradient(180deg, #05060f, #0d0e1a);
  --bg-panel: linear-gradient(180deg, rgba(15,17,32,0.86), rgba(8,10,20,0.92));
  --bg-panel-strong: linear-gradient(180deg, rgba(17,20,38,0.9), rgba(10,12,24,0.98));
  --text-main: #e2e8f0;
  --text-dim: rgba(226,232,240,0.72);
  --text-mute: rgba(226,232,240,0.46);
  --sb-bg: rgba(8,10,24,0.9);
  --sb-border: rgba(120,203,255,0.14);
  --sb-dim: rgba(226,232,240,0.62);
  --sb-mute: rgba(226,232,240,0.42);
  --hud-bg: rgba(13,16,32,0.86);
  --hud-border: rgba(120,203,255,0.14);
  --hud-label: rgba(226,232,240,0.45);
  --hud-value: #e2e8f0;
  --grid-color: color-mix(in oklch, var(--accent), transparent 88%);
}
body.mode-cyberpunk .arena::after{
  content:"";
  position:absolute;
  inset:0;
  background:
    repeating-linear-gradient(180deg, transparent 0 3px, var(--scan) 3px 6px),
    radial-gradient(circle at 50% 24%, color-mix(in oklch, var(--accent), transparent 88%), transparent 30%);
  pointer-events:none;
}
@media (max-width: 980px){
  .stage{grid-template-columns:1fr}
  .info-panel{min-height:280px}
}
</style>
</head>
<body class="mode-cyberpunk">
<div class="app">
  <aside class="sidebar">
    <div class="lang-row">
      <button class="lang-btn" id="langBtn">CN</button>
    </div>
    <div class="style-switcher" id="styleSwitcher"></div>
    <section class="meta">
      <div class="eyebrow" id="eyebrow">自由落体实验</div>
      <div class="title" id="sideTitle">自由落体的秘密</div>
      <div class="subline" id="sideTagline">先预测谁先落地，再看清空气阻力和重力加速度各自起了什么作用。</div>
    </section>
    <div class="progress-chip" id="frameInd">1 / 3</div>
    <div class="scene-list" id="sceneList"></div>
  </aside>
  <main class="main">
    <div class="content">
      <section class="hero">
        <div class="hero-copy">
          <h1 id="heroTitle">如果把大象和老鼠一起放手，会同时落地吗？</h1>
          <p id="heroDesc">观察三个经典场景：空气拖慢平展开的纸、书替纸挡掉空气、忽略空气后不同质量物体共享同一种下落节奏。</p>
        </div>
        <div class="hero-badges">
          <div class="hud-card"><div class="k" id="hudLabel1">核心判断</div><div class="v" id="hudValue1">硬币先到</div></div>
          <div class="hud-card"><div class="k" id="hudLabel2">空气影响</div><div class="v" id="hudValue2">明显</div></div>
          <div class="hud-card"><div class="k" id="hudLabel3">重力节奏</div><div class="v" id="hudValue3">每秒约 +9.8 m/s</div></div>
        </div>
      </section>
      <section class="stage">
        <div class="arena">
          <canvas id="c" class="bg-canvas"></canvas>
          <div class="grid"></div>
          <div class="field-arc"></div>
          <div class="field-lines">
            <svg viewBox="0 0 340 110" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 90 C80 20, 120 20, 170 90" stroke="currentColor" stroke-dasharray="4 4"/>
              <path d="M70 100 C120 38, 160 38, 205 100" stroke="currentColor" stroke-dasharray="4 4"/>
              <path d="M130 102 C180 44, 220 44, 270 102" stroke="currentColor" stroke-dasharray="4 4"/>
              <path d="M190 100 C235 38, 275 38, 320 100" stroke="currentColor" stroke-dasharray="4 4"/>
            </svg>
          </div>
          <div class="scene-header">
            <div class="left">
              <div class="code" id="sceneCode">OBSERVATION 01</div>
              <div class="name" id="sceneName">空气中的硬币和纸</div>
              <div class="tip" id="sceneTip">先看最普通的一幕：平展开的纸为什么会被空气拖慢？</div>
            </div>
            <div class="props" aria-hidden="true">
              <div class="prop">
                <svg viewBox="0 0 24 24"><path d="M12 3v10"/><circle cx="12" cy="16.5" r="3.5"/><path d="M7 3h10"/></svg>
              </div>
              <div class="prop">
                <svg viewBox="0 0 24 24"><path d="M5 18l5-12 4 8 5-3"/><path d="M5 18h14"/></svg>
              </div>
              <div class="prop">
                <svg viewBox="0 0 24 24"><path d="M7 5v8a5 5 0 0 0 10 0V5"/><path d="M7 5h4"/><path d="M13 5h4"/></svg>
              </div>
            </div>
          </div>
          <div class="lanes">
            <section class="lane">
              <div class="lane-head">
                <div class="lane-title" id="leftTitle">硬币</div>
                <div class="lane-note" id="leftNote">空气中</div>
              </div>
              <div class="drop-zone" id="leftZone"></div>
            </section>
            <section class="lane">
              <div class="lane-head">
                <div class="lane-title" id="rightTitle">平展开的纸</div>
                <div class="lane-note" id="rightNote">空气中</div>
              </div>
              <div class="drop-zone" id="rightZone"></div>
            </section>
          </div>
        </div>
        <aside class="info-panel">
          <h3 id="takeawayTitle">场景 1：空气会把纸拖住</h3>
          <p id="takeawayBody">硬币和纸都受重力向下拉，但平展开的纸迎风面积更大，更容易被空气“托住”，所以看起来掉得慢。</p>
          <div class="note-box"><strong>你应该看到</strong><span id="observationText">左侧硬币更快贴近地面，右侧的纸下落时像被空气轻轻托着。</span></div>
          <div class="note-box"><strong>和火箭有什么关系</strong><span id="rocketText">火箭回收时如果打开降落伞，本质上也是故意把迎风面积做大，让空气来帮忙减速。</span></div>
          <div class="controls">
            <button class="ctrl-btn secondary" id="btnPrev">上一个场景</button>
            <button class="ctrl-btn" id="replayBtn">重播场景</button>
            <button class="ctrl-btn secondary" id="btnNext">下一个场景</button>
          </div>
        </aside>
      </section>
    </div>
  </main>
</div>
<script>
(function () {
  var LANG = 'cn';
  var MODE = 'cyberpunk';
  var I18N = {
    sideTitle: { cn: '自由落体的秘密', en: 'The Secret of Free Fall' },
    sideTagline: { cn: '先预测谁先落地，再看清空气阻力和重力加速度各自起了什么作用。', en: 'Predict which object lands first, then separate air drag from gravitational acceleration.' },
    heroTitle: { cn: '如果把大象和老鼠一起放手，会同时落地吗？', en: 'If an elephant and a mouse are dropped together, do they land together?' },
    heroDesc: { cn: '观察三个经典场景：空气拖慢平展开的纸、书替纸挡掉空气、忽略空气后不同质量物体共享同一种下落节奏。', en: 'Watch three classic cases: air slows flat paper, a book shields paper from drag, and without air different masses share the same falling rhythm.' },
    hud1: { cn: '核心判断', en: 'Core Judgment' },
    hud2: { cn: '空气影响', en: 'Air Effect' },
    hud3: { cn: '重力节奏', en: 'Gravity Rate' },
    gravityRate: { cn: '每秒约 +9.8 m/s', en: 'About +9.8 m/s every second' },
    prev: { cn: '上一个场景', en: 'Previous Scene' },
    replay: { cn: '重播场景', en: 'Replay Scene' },
    next: { cn: '下一个场景', en: 'Next Scene' }
  };
  var SCENES = [
    {
      code: { cn: 'OBSERVATION 01', en: 'OBSERVATION 01' },
      name: { cn: '空气中的硬币和纸', en: 'Coin vs Flat Paper in Air' },
      tip: { cn: '先看最普通的一幕：平展开的纸为什么会被空气拖慢？', en: 'Start with the ordinary case: why does flat paper get slowed by air?' },
      leftTitle: { cn: '硬币', en: 'Coin' },
      leftNote: { cn: '空气中', en: 'In Air' },
      rightTitle: { cn: '平展开的纸', en: 'Flat Paper' },
      rightNote: { cn: '空气中', en: 'In Air' },
      metric1: { cn: '硬币先到', en: 'Coin Lands First' },
      metric2: { cn: '明显', en: 'Strong' },
      takeTitle: { cn: '场景 1：空气会把纸拖住', en: 'Scene 1: Air Holds the Paper Back' },
      takeBody: { cn: '硬币和纸都受重力向下拉，但平展开的纸迎风面积更大，更容易被空气“托住”，所以看起来掉得慢。', en: 'Both objects are pulled downward by gravity, but flat paper presents much more area to the air and gets slowed more strongly.' },
      observation: { cn: '左侧硬币更快贴近地面，右侧的纸下落时像被空气轻轻托着。', en: 'The coin gets down faster while the paper seems to float on a cushion of air.' },
      rocket: { cn: '火箭回收时如果打开降落伞，本质上也是故意把迎风面积做大，让空气来帮忙减速。', en: 'Rocket recovery uses the same idea on purpose: a parachute increases area so air can help slow the fall.' },
      left: { className: 'ball metal', text: { cn: '硬币', en: 'Coin' }, duration: 1400 },
      right: { className: 'paper paperFlat', text: { cn: '纸', en: 'Paper' }, duration: 2400 }
    },
    {
      code: { cn: 'OBSERVATION 02', en: 'OBSERVATION 02' },
      name: { cn: '书盖纸实验', en: 'Book Covers Paper' },
      tip: { cn: '这里最容易打破“重的一定先到”的直觉。关键是：纸前方的空气被书先处理掉了。', en: 'This is where the heavy-first intuition breaks. The book clears the air in front of the paper.' },
      leftTitle: { cn: '书 + 纸', en: 'Book + Paper' },
      leftNote: { cn: '纸贴在书上', en: 'Paper on Book' },
      rightTitle: { cn: '单独一本书', en: 'Book Alone' },
      rightNote: { cn: '空气中', en: 'In Air' },
      metric1: { cn: '几乎同时', en: 'Almost Together' },
      metric2: { cn: '被书削弱', en: 'Reduced by Book' },
      takeTitle: { cn: '场景 2：书先帮纸挡掉空气', en: 'Scene 2: The Book Shields the Paper' },
      takeBody: { cn: '当纸贴在书上，纸前方不再直接迎风，空气阻力一下子小了很多，于是它跟着书一起掉。', en: 'When the paper rides on top of the book, it no longer meets the air directly, so drag drops sharply.' },
      observation: { cn: '左右两边都快速接近地面，左边的纸没有再明显落后。', en: 'Both sides rush down, and the paper no longer lags behind.' },
      rocket: { cn: '工程上常通过整流罩和顺滑外形减少迎风阻力，这和“书盖纸”的想法是同一种策略。', en: 'Engineers reduce drag with fairings and smooth shapes. It is the same strategy as the book shielding the paper.' },
      left: { className: 'book bookObj', text: { cn: '书+纸', en: 'Book+Paper' }, duration: 1500 },
      right: { className: 'book bookObj', text: { cn: '书', en: 'Book' }, duration: 1500 }
    },
    {
      code: { cn: 'OBSERVATION 03', en: 'OBSERVATION 03' },
      name: { cn: '忽略空气时的自由落体', en: 'Free Fall with Air Ignored' },
      tip: { cn: '现在尽量拿掉空气干扰，看看真正留下来的共同节奏。', en: 'Now strip away air interference and look at the shared gravity rhythm.' },
      leftTitle: { cn: '钢球', en: 'Steel Ball' },
      leftNote: { cn: '近似无空气', en: 'Air Nearly Ignored' },
      rightTitle: { cn: '木球', en: 'Wood Ball' },
      rightNote: { cn: '近似无空气', en: 'Air Nearly Ignored' },
      metric1: { cn: '同时到达', en: 'Same Arrival' },
      metric2: { cn: '接近没有', en: 'Very Small' },
      takeTitle: { cn: '场景 3：g 描述的是共同的加速节奏', en: 'Scene 3: g Is a Shared Acceleration Rhythm' },
      takeBody: { cn: '忽略空气时，重的和轻的都会按照同样的重力加速度变快。区别在重量，不在“每秒变快多少”这件事上。', en: 'With air effects removed, heavy and light objects gain speed with the same gravitational acceleration.' },
      observation: { cn: '两个球几乎同时到地。你会发现“谁更重”不再决定“谁更快到”。', en: 'The two balls arrive together. Heavier no longer means faster arrival.' },
      rocket: { cn: '发动机熄火后，火箭会先减速到顶，再在重力节奏下越来越快地下落，后面的飞行曲线和测高判断都要用到这条规律。', en: 'After burnout, rockets slow to apogee and then speed up downward under gravity. Later flight-path estimates depend on this rule.' },
      left: { className: 'small metal', text: { cn: '钢球', en: 'Steel' }, duration: 1650 },
      right: { className: 'small wood', text: { cn: '木球', en: 'Wood' }, duration: 1650 }
    }
  ];
  var MODES = [
    { id: 'light', label: 'LIGHT' },
    { id: 'dark', label: 'DARK' },
    { id: 'cyberpunk', label: 'CYBER' }
  ];
  var currentIndex = 0;

  function tx(value) {
    return value[LANG] || value.cn || value.en || '';
  }

  function resizeCanvas() {
    var canvas = document.getElementById('c');
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas: canvas, ctx: ctx, width: rect.width, height: rect.height };
  }

  function cssVar(name, fallback) {
    var value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
  }

  function drawBackdrop() {
    var pack = resizeCanvas();
    if (!pack) return;
    var ctx = pack.ctx;
    var w = pack.width;
    var h = pack.height;
    var accent = cssVar('--accent', '#78cbff');
    var accentStrong = cssVar('--accent-strong', '#3fb4ff');
    var bgTop = cssVar('--bg-2', '#151a2c');
    var bgBottom = cssVar('--bg-0', '#070b16');
    var grid = cssVar('--grid-color', 'rgba(255,255,255,0.05)');

    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, bgTop);
    bg.addColorStop(1, bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= w; gx += 64) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (var gy = 0; gy <= h; gy += 64) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    var glow = ctx.createRadialGradient(w * 0.5, h * 0.22, 0, w * 0.5, h * 0.22, w * 0.42);
    glow.addColorStop(0, 'rgba(120,203,255,0.12)');
    glow.addColorStop(1, 'rgba(120,203,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = accentStrong;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1.2;
    for (var i = 0; i < 4; i++) {
      var startX = 28 + i * 78;
      ctx.beginPath();
      ctx.moveTo(startX, h - 46);
      ctx.bezierCurveTo(w * 0.28, h * 0.18, w * 0.52, h * 0.18, w * 0.5 + i * 54, h - 42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(120,203,255,0.08)';
    ctx.fillRect(0, h - 70, w, 70);

    ctx.fillStyle = accent;
    ctx.font = '700 12px "JetBrains Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('SCENE ' + (currentIndex + 1), 20, 26);
  }

  function buildStyleSwitcher() {
    var host = document.getElementById('styleSwitcher');
    host.innerHTML = '';
    for (var i = 0; i < MODES.length; i++) {
      var mode = MODES[i];
      var btn = document.createElement('button');
      btn.className = 'vm-btn' + (MODE === mode.id ? ' vm-active' : '');
      btn.textContent = mode.label;
      btn.addEventListener('click', (function (nextMode) {
        return function () {
          MODE = nextMode;
          document.body.className = 'mode-' + nextMode;
          render();
        };
      })(mode.id));
      host.appendChild(btn);
    }
  }

  function buildSceneButtons() {
    var list = document.getElementById('sceneList');
    list.innerHTML = '';
    for (var i = 0; i < SCENES.length; i++) {
      var scene = SCENES[i];
      var btn = document.createElement('button');
      btn.className = 'scene-btn' + (i === currentIndex ? ' active' : '');
      btn.innerHTML = (i + 1) + '. ' + tx(scene.name) + '<small>' + tx(scene.tip) + '</small>';
      btn.addEventListener('click', (function (idx) {
        return function () {
          currentIndex = idx;
          render();
        };
      })(i));
      list.appendChild(btn);
    }
  }

  function createObject(zone, config) {
    zone.innerHTML = '';
    var el = document.createElement('div');
    el.className = 'object ' + config.className;
    el.textContent = tx(config.text);
    zone.appendChild(el);
    return el;
  }

  function animateObject(el, duration) {
    el.style.transition = 'none';
    el.style.top = '12px';
    el.offsetHeight;
    el.style.transition = 'top ' + duration + 'ms cubic-bezier(.22,.72,.23,1)';
    el.style.top = 'calc(100% - 92px)';
  }

  function applyLanguage() {
    document.getElementById('eyebrow').textContent = LANG === 'cn' ? '自由落体实验' : 'FREE FALL LAB';
    document.getElementById('sideTitle').textContent = tx(I18N.sideTitle);
    document.getElementById('sideTagline').textContent = tx(I18N.sideTagline);
    document.getElementById('heroTitle').textContent = tx(I18N.heroTitle);
    document.getElementById('heroDesc').textContent = tx(I18N.heroDesc);
    document.getElementById('hudLabel1').textContent = tx(I18N.hud1);
    document.getElementById('hudLabel2').textContent = tx(I18N.hud2);
    document.getElementById('hudLabel3').textContent = tx(I18N.hud3);
    document.getElementById('hudValue3').textContent = tx(I18N.gravityRate);
    document.getElementById('btnPrev').textContent = tx(I18N.prev);
    document.getElementById('replayBtn').textContent = tx(I18N.replay);
    document.getElementById('btnNext').textContent = tx(I18N.next);
    document.getElementById('langBtn').textContent = LANG === 'cn' ? 'CN' : 'EN';
  }

  function render() {
    applyLanguage();
    buildStyleSwitcher();
    buildSceneButtons();
    drawBackdrop();
    var scene = SCENES[currentIndex];
    document.getElementById('frameInd').textContent = (currentIndex + 1) + ' / ' + SCENES.length;
    document.getElementById('sceneCode').textContent = tx(scene.code);
    document.getElementById('sceneName').textContent = tx(scene.name);
    document.getElementById('sceneTip').textContent = tx(scene.tip);
    document.getElementById('leftTitle').textContent = tx(scene.leftTitle);
    document.getElementById('leftNote').textContent = tx(scene.leftNote);
    document.getElementById('rightTitle').textContent = tx(scene.rightTitle);
    document.getElementById('rightNote').textContent = tx(scene.rightNote);
    document.getElementById('hudValue1').textContent = tx(scene.metric1);
    document.getElementById('hudValue2').textContent = tx(scene.metric2);
    document.getElementById('takeawayTitle').textContent = tx(scene.takeTitle);
    document.getElementById('takeawayBody').textContent = tx(scene.takeBody);
    document.getElementById('observationText').textContent = tx(scene.observation);
    document.getElementById('rocketText').textContent = tx(scene.rocket);
    var left = createObject(document.getElementById('leftZone'), scene.left);
    var right = createObject(document.getElementById('rightZone'), scene.right);
    setTimeout(function () {
      animateObject(left, scene.left.duration);
      animateObject(right, scene.right.duration);
    }, 70);
  }

  document.getElementById('langBtn').addEventListener('click', function () {
    LANG = LANG === 'cn' ? 'en' : 'cn';
    render();
  });
  document.getElementById('replayBtn').addEventListener('click', function () {
    render();
  });
  document.getElementById('btnPrev').addEventListener('click', function () {
    currentIndex = (currentIndex - 1 + SCENES.length) % SCENES.length;
    render();
  });
  document.getElementById('btnNext').addEventListener('click', function () {
    currentIndex = (currentIndex + 1) % SCENES.length;
    render();
  });
  window.addEventListener('resize', render);

  render();
})();
</script>
</body>
</html>`

const GAME_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{
  --phys-0: oklch(0.78 0.13 215);
  --phys-1: oklch(0.55 0.13 215);
  --phys-2: oklch(0.35 0.10 215);
  --phys-3: oklch(0.92 0.08 215);
  --gold: oklch(0.85 0.14 85);
  --bg-0: oklch(0.14 0.035 265);
  --bg-1: oklch(0.18 0.04 265);
  --bg-2: oklch(0.22 0.045 265);
  --bg-3: oklch(0.28 0.05 265);
  --accent: var(--phys-0);
  --accent-strong: var(--phys-1);
  --line: oklch(0.35 0.05 265 / 0.35);
  --text-main: oklch(0.96 0.01 265);
  --text-dim: oklch(0.75 0.02 265);
  --text-mute: oklch(0.55 0.03 265);
  --bg-main: linear-gradient(180deg, #05060f, #0d0e1a);
  --bg-panel: linear-gradient(180deg, rgba(15,17,32,0.86), rgba(8,10,20,0.92));
  --bg-panel-strong: linear-gradient(180deg, rgba(17,20,38,0.9), rgba(10,12,24,0.98));
  --sb-bg: rgba(8,10,24,0.9);
  --sb-border: rgba(120,203,255,0.14);
  --sb-accent: var(--accent);
  --sb-dim: rgba(226,232,240,0.62);
  --sb-mute: rgba(226,232,240,0.42);
  --sb-btn-bd: color-mix(in oklch, var(--accent), transparent 55%);
  --sb-btn-bg: transparent;
  --ctrl-bg: linear-gradient(135deg, var(--accent), var(--gold));
  --ctrl-color: #06111f;
  --scan: rgba(120, 203, 255, 0.08);
  --grid-color: color-mix(in oklch, var(--accent), transparent 88%);
}
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{
  font-family:"Inter","Noto Sans SC",sans-serif;
  background:var(--bg-main);
  color:var(--text-main);
}
.app{
  display:grid;
  grid-template-columns:220px 1fr;
  height:100vh;
  width:100%;
}
.game-sidebar{
  padding:16px 14px;
  border-right:1px solid var(--sb-border);
  background:var(--sb-bg);
  display:flex;
  flex-direction:column;
  gap:10px;
  position:relative;
  overflow-y:auto;
  padding-bottom:18px;
  scrollbar-width:thin;
}
.game-sidebar::before{
  content:"";
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 18% 0%, color-mix(in oklch, var(--accent), transparent 82%), transparent 45%),
    radial-gradient(circle at 100% 100%, color-mix(in oklch, var(--gold), transparent 90%), transparent 36%);
  pointer-events:none;
}
.game-sidebar>*{position:relative;z-index:1}
.lang-btn,.vm-btn,.pick-btn,.action-btn{
  font-family:"JetBrains Mono",monospace;
  text-transform:uppercase;
  letter-spacing:.08em;
}
.lang-btn{
  width:max-content;
  border:1px solid var(--sb-btn-bd);
  background:var(--sb-btn-bg);
  color:var(--sb-accent);
  padding:6px 10px;
  font-size:10px;
  font-weight:700;
  cursor:pointer;
}
.style-switcher{display:flex;gap:4px}
.vm-btn{
  border:1px solid var(--sb-btn-bd);
  background:var(--sb-btn-bg);
  color:var(--sb-dim);
  padding:4px 6px;
  font-size:8px;
  font-weight:700;
  cursor:pointer;
}
.vm-btn:hover,.vm-btn.vm-active{
  color:var(--sb-accent);
  border-color:var(--sb-accent);
  background:color-mix(in oklch, var(--accent), transparent 88%);
}
.meta,.guide,.score,.status{
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--bg-panel);
  position:relative;
  overflow:hidden;
}
.meta::before,.meta::after,.guide::before,.guide::after,.score::before,.score::after,.status::before,.status::after{
  content:"";
  position:absolute;
  width:10px;
  height:10px;
  border:1px solid color-mix(in oklch, var(--accent), transparent 40%);
  opacity:.55;
}
.meta::before,.guide::before,.score::before,.status::before{top:8px;left:8px;border-right:none;border-bottom:none}
.meta::after,.guide::after,.score::after,.status::after{bottom:8px;right:8px;border-left:none;border-top:none}
.meta{padding:14px 12px}
.eyebrow{
  font-family:"JetBrains Mono",monospace;
  font-size:10px;
  color:var(--gold);
  letter-spacing:.14em;
}
.title{
  margin-top:6px;
  font-family:"Space Grotesk",sans-serif;
  font-size:21px;
  line-height:1.08;
  font-weight:700;
}
.subline{
  margin-top:6px;
  color:var(--text-dim);
  font-size:12px;
  line-height:1.6;
}
.score{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  padding:12px;
}
.score .cell{
  border:1px solid var(--line);
  border-radius:10px;
  padding:10px;
  background:var(--bg-panel-strong);
}
.score .k{
  font-family:"JetBrains Mono",monospace;
  font-size:9px;
  color:var(--text-mute);
  letter-spacing:.12em;
}
.score .v{
  margin-top:6px;
  font-size:18px;
  font-weight:800;
}
.guide,.status{padding:12px}
.guide p,.status p{
  margin:0;
  color:var(--text-dim);
  font-size:12px;
  line-height:1.7;
}
.main{
  position:relative;
  min-width:0;
  overflow:hidden;
}
.main::before{
  content:"";
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 75% 8%, color-mix(in oklch, var(--accent), transparent 84%), transparent 22%),
    radial-gradient(circle at 10% 100%, color-mix(in oklch, var(--gold), transparent 92%), transparent 26%);
  pointer-events:none;
}
.content{
  position:relative;
  z-index:1;
  display:flex;
  flex-direction:column;
  height:100%;
  gap:14px;
  padding:16px 18px 18px;
}
.hero{
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:flex-start;
}
.hero h1{
  margin:0;
  font-family:"Space Grotesk",sans-serif;
  font-size:29px;
  line-height:1.14;
  letter-spacing:-0.03em;
  padding-bottom:4px;
}
.hero p{
  margin:8px 0 0;
  color:var(--text-dim);
  font-size:13px;
  line-height:1.65;
  max-width:720px;
}
.arena{
  flex:1;
  min-height:0;
  border:1px solid var(--line);
  border-radius:18px;
  overflow:hidden;
  position:relative;
  isolation:isolate;
  background:linear-gradient(180deg, color-mix(in oklch, var(--bg-2), transparent 6%), color-mix(in oklch, var(--bg-0), transparent 0%));
}
.arena::before{
  content:"";
  position:absolute;
  inset:0;
  background:
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size:64px 64px;
  opacity:.5;
  z-index:0;
}
.arena::after{
  content:"";
  position:absolute;
  inset:0;
  background:
    repeating-linear-gradient(180deg, transparent 0 3px, var(--scan) 3px 6px),
    linear-gradient(transparent 0 calc(100% - 80px), color-mix(in oklch, var(--phys-2), transparent 18%) calc(100% - 80px) 100%);
  pointer-events:none;
  z-index:0;
}
.round-head{
  position:absolute;
  top:14px;
  left:18px;
  right:18px;
  display:flex;
  justify-content:space-between;
  gap:16px;
  z-index:2;
}
.round-code{
  font-family:"JetBrains Mono",monospace;
  color:var(--gold);
  font-size:10px;
  letter-spacing:.14em;
}
.round-title{
  margin-top:6px;
  font-size:18px;
  font-weight:700;
}
.round-desc{
  margin-top:6px;
  color:var(--text-dim);
  font-size:12px;
  line-height:1.65;
  max-width:620px;
}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{
  border:1px solid var(--line);
  background:var(--bg-panel);
  padding:8px 10px;
  border-radius:12px;
  font-family:"JetBrains Mono",monospace;
  font-size:10px;
  color:var(--text-dim);
}
.lanes{
  position:absolute;
  inset:118px 18px 186px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:22px;
  z-index:2;
}
.lane{
  position:relative;
  border:1px solid color-mix(in oklch, var(--accent), transparent 62%);
  border-radius:18px 18px 0 0;
  background:linear-gradient(180deg, color-mix(in oklch, var(--accent), transparent 92%), transparent 36%);
}
.lane::before{
  content:"";
  position:absolute;
  left:12px;
  right:12px;
  bottom:0;
  border-top:2px dashed color-mix(in oklch, var(--phys-3), transparent 28%);
}
.lane-head{
  text-align:center;
  padding-top:14px;
}
.lane-title{
  font-size:17px;
  font-weight:700;
}
.lane-note{
  margin-top:4px;
  color:var(--text-mute);
  font-size:11px;
}
.drop-zone{
  position:absolute;
  inset:74px 18px 18px;
}
.object{
  position:absolute;
  left:50%;
  top:10px;
  transform:translateX(-50%);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:800;
  color:#06111f;
  box-shadow:0 0 36px color-mix(in oklch, var(--accent), transparent 86%);
}
.object.ball,.object.paperBall{border-radius:50%}
.object.ball{width:74px;height:74px}
.object.paperBall{width:64px;height:64px}
.object.paper{width:116px;height:26px;border-radius:10px}
.object.book{width:128px;height:34px;border-radius:12px;color:#f8fafc}
.metal{background:linear-gradient(180deg, color-mix(in oklch, var(--phys-3), transparent 12%), var(--phys-0))}
.paperFlat{background:linear-gradient(180deg, #fffdf2, #e8dfc7)}
.paperBallFill{background:linear-gradient(180deg, #f1d7a1, #cf9d48)}
.bookFill{background:linear-gradient(180deg, #f25f5c, #b42318)}
.controls{
  position:absolute;
  left:18px;
  right:18px;
  bottom:18px;
  display:grid;
  grid-template-columns:1fr auto;
  gap:14px;
  align-items:end;
  padding:14px;
  border:1px solid var(--line);
  border-radius:18px;
  background:color-mix(in oklch, var(--bg-1), transparent 6%);
  backdrop-filter:blur(10px);
  z-index:2;
}
.pick-row{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
}
.pick-btn,.action-btn{
  border:1px solid var(--line);
  border-radius:12px;
  padding:10px 12px;
  font-size:10px;
  font-weight:700;
  cursor:pointer;
}
.pick-btn{
  background:var(--bg-panel);
  color:var(--text-main);
}
.pick-btn.active{
  border-color:var(--accent);
  background:color-mix(in oklch, var(--accent), transparent 86%);
}
.action-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.action-btn{
  background:var(--ctrl-bg);
  color:var(--ctrl-color);
}
.action-btn.secondary{
  background:var(--bg-panel);
  color:var(--text-main);
}
.message{
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--bg-panel-strong);
  padding:12px 14px;
  font-size:13px;
  line-height:1.7;
  min-height:72px;
  overflow-wrap:anywhere;
}
.ok{color:#27d29b}
.bad{color:#ff8c8c}
body.mode-light{
  --bg-main: linear-gradient(180deg, #fafaf5, #f0f0ea);
  --bg-panel: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(244,244,238,0.92));
  --bg-panel-strong: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(240,240,234,0.98));
  --text-main: #0f172a;
  --text-dim: rgba(15,23,42,0.76);
  --text-mute: rgba(15,23,42,0.48);
  --sb-bg: rgba(255,255,255,0.92);
  --sb-border: rgba(15,23,42,0.08);
  --sb-dim: rgba(15,23,42,0.58);
  --sb-mute: rgba(15,23,42,0.42);
  --grid-color: rgba(15,23,42,0.04);
  --scan: transparent;
}
body.mode-dark{
  --bg-main: linear-gradient(180deg, #0a0a0a, #111111);
  --bg-panel: linear-gradient(180deg, rgba(25,25,25,0.86), rgba(15,15,15,0.96));
  --bg-panel-strong: linear-gradient(180deg, rgba(31,31,31,0.92), rgba(18,18,18,0.98));
  --text-main: #e5e5e5;
  --text-dim: rgba(229,229,229,0.72);
  --text-mute: rgba(229,229,229,0.46);
  --sb-bg: rgba(12,12,12,0.92);
  --sb-border: rgba(255,255,255,0.1);
  --sb-dim: rgba(229,229,229,0.66);
  --sb-mute: rgba(229,229,229,0.4);
  --grid-color: rgba(255,255,255,0.03);
}
body.mode-cyberpunk{
  --scan: rgba(120, 203, 255, 0.08);
}
@media (max-width: 960px){
  .controls{grid-template-columns:1fr}
  .action-row{justify-content:flex-start}
}
</style>
</head>
<body class="mode-cyberpunk">
<div class="app">
  <aside class="game-sidebar">
    <button class="lang-btn" id="langBtn">CN</button>
    <div class="style-switcher" id="styleSwitcher"></div>
    <section class="meta">
      <div class="eyebrow">自由落体实验</div>
      <div class="title" id="sideTitle">谁先落地？</div>
      <div class="subline" id="sideTagline">先做判断，再释放物体，用结果区分空气阻力和重力加速度。</div>
    </section>
    <section class="score">
      <div class="cell"><div class="k" id="roundLabel">round</div><div class="v" id="roundValue">1 / 4</div></div>
      <div class="cell"><div class="k" id="scoreLabel">score</div><div class="v" id="scoreValue">0</div></div>
    </section>
    <section class="guide"><p id="guideContent">玩法：先选“左边先到 / 同时落地 / 右边先到”，再按“释放物体”。每一关都在练同一件事：把空气阻力和重力加速度分开。</p></section>
    <section class="status"><p id="statusText">可以切换亮色 / 暗色 / 赛博三种显示模式，但判断结果不会变。</p></section>
  </aside>
  <main class="main">
    <div class="content">
      <section class="hero">
        <div>
          <h1 id="heroTitle">先预测，再让物体自己说话</h1>
          <p id="heroDesc">别只背结论。这个小游戏会反复让你先判断、再观察结果、最后解释为什么会这样，帮助把直觉真正改过来。</p>
        </div>
      </section>
      <section class="arena">
        <div class="round-head">
          <div>
            <div class="round-code" id="roundCode">TRIAL 01</div>
            <div class="round-title" id="roundTitle">硬币 vs 平展开纸</div>
            <div class="round-desc" id="roundDesc">条件：普通空气，同样高度，同时放手。现在要判断的是谁更先到地，而不是谁“看起来更重”。</div>
          </div>
          <div class="chips">
            <div class="chip" id="chip1">FIELD · 重力节奏</div>
            <div class="chip" id="chip2">WAVE · 空气拖拽</div>
          </div>
        </div>
        <div class="lanes">
          <section class="lane">
            <div class="lane-head">
              <div class="lane-title" id="leftTitle">硬币</div>
              <div class="lane-note" id="leftNote">空气中</div>
            </div>
            <div class="drop-zone" id="leftZone"></div>
          </section>
          <section class="lane">
            <div class="lane-head">
              <div class="lane-title" id="rightTitle">平展开纸</div>
              <div class="lane-note" id="rightNote">空气中</div>
            </div>
            <div class="drop-zone" id="rightZone"></div>
          </section>
        </div>
        <div class="controls">
          <div>
            <div class="pick-row">
              <button class="pick-btn" data-pick="left" data-option="left" id="pickLeft">左边先到</button>
              <button class="pick-btn" data-pick="tie" data-option="tie" id="pickTie">同时落地</button>
              <button class="pick-btn" data-pick="right" data-option="right" id="pickRight">右边先到</button>
            </div>
            <div class="message" id="messageBox">本游戏一共 4 关。你会在不同情境里反复判断：到底是空气阻力还是重力节奏在主导结果。</div>
          </div>
          <div class="action-row">
            <button class="action-btn" id="dropBtn">释放物体</button>
            <button class="action-btn secondary" id="nextBtn">下一关</button>
            <button class="action-btn secondary" id="resetBtn">重新开始</button>
          </div>
        </div>
      </section>
    </div>
  </main>
</div>
<script>
(function () {
  var LANG = 'cn';
  var MODE = 'cyberpunk';
  var picked = null;
  var locked = false;
  var score = 0;
  var roundIndex = 0;
  var MODES = [
    { id: 'light', label: 'LIGHT' },
    { id: 'dark', label: 'DARK' },
    { id: 'cyberpunk', label: 'CYBER' }
  ];
  var TEXT = {
    sideTitle: { cn: '谁先落地？', en: 'Who Lands First?' },
    sideTagline: { cn: '先做判断，再释放物体，用结果区分空气阻力和重力加速度。', en: 'Predict first, release second, and use the result to separate air drag from gravity.' },
    roundLabel: { cn: '回合', en: 'Round' },
    scoreLabel: { cn: '得分', en: 'Score' },
    guide: { cn: '玩法：先选“左边先到 / 同时落地 / 右边先到”，再按“释放物体”。每一关都在练同一件事：把空气阻力和重力加速度分开。', en: 'Choose left / tie / right first, then release the objects. Every round trains the same skill: separating air drag from gravity.' },
    status: { cn: '可以切换亮色 / 暗色 / 赛博三种显示模式，但判断结果不会变。', en: 'Switch light, dark, or cyber display modes. The physics result stays the same.' },
    heroTitle: { cn: '先预测，再让物体自己说话', en: 'Predict First, Then Let the Objects Speak' },
    heroDesc: { cn: '别只背结论。这个小游戏会反复让你先判断、再观察结果、最后解释为什么会这样，帮助把直觉真正改过来。', en: 'Do not just memorize the rule. Predict, watch, and explain until the intuition really changes.' },
    pickLeft: { cn: '左边先到', en: 'Left First' },
    pickTie: { cn: '同时落地', en: 'Land Together' },
    pickRight: { cn: '右边先到', en: 'Right First' },
    drop: { cn: '释放物体', en: 'Release' },
    next: { cn: '下一关', en: 'Next Round' },
    reset: { cn: '重新开始', en: 'Reset' }
  };
  var ROUNDS = [
    {
      code: { cn: 'TRIAL 01', en: 'TRIAL 01' },
      title: { cn: '硬币 vs 平展开纸', en: 'Coin vs Flat Paper' },
      desc: { cn: '条件：普通空气，同样高度，同时放手。现在要判断的是谁更先到地，而不是谁“看起来更重”。', en: 'Condition: normal air, same height, same release. Judge arrival time, not who merely looks heavier.' },
      chip1: { cn: 'FIELD · 重力节奏', en: 'FIELD · Gravity Rhythm' },
      chip2: { cn: 'WAVE · 空气拖拽', en: 'WAVE · Air Drag' },
      leftTitle: { cn: '硬币', en: 'Coin' },
      leftNote: { cn: '空气中', en: 'In Air' },
      rightTitle: { cn: '平展开纸', en: 'Flat Paper' },
      rightNote: { cn: '空气中', en: 'In Air' },
      left: { className: 'object ball metal', text: { cn: '硬币', en: 'Coin' }, duration: 1400 },
      right: { className: 'object paper paperFlat', text: { cn: '纸', en: 'Paper' }, duration: 2400 },
      answer: 'left',
      explain: { cn: '正确答案是左边先到。平展开的纸迎风面积更大，空气更容易把它拖慢；这不是重力“偏心”，而是阻力在捣乱。', en: 'Left is correct. Flat paper presents more area to the air, so drag slows it more strongly.' }
    },
    {
      code: { cn: 'TRIAL 02', en: 'TRIAL 02' },
      title: { cn: '书盖纸实验', en: 'Book Covers Paper' },
      desc: { cn: '条件：左边是“书和贴在上面的纸”，右边是单独一本书。想想书是不是先替纸挡住了前方空气。', en: 'Condition: the left object is book + paper, the right object is a book alone. Think about whether the book shields the paper from air.' },
      chip1: { cn: 'MASS · 结构遮挡', en: 'MASS · Shielding' },
      chip2: { cn: 'PHOTON · 反直觉', en: 'PHOTON · Counterintuitive' },
      leftTitle: { cn: '书 + 纸', en: 'Book + Paper' },
      leftNote: { cn: '纸贴在书上', en: 'Paper on Book' },
      rightTitle: { cn: '单独一本书', en: 'Book Alone' },
      rightNote: { cn: '空气中', en: 'In Air' },
      left: { className: 'object book bookFill', text: { cn: '书+纸', en: 'Book+Paper' }, duration: 1500 },
      right: { className: 'object book bookFill', text: { cn: '书', en: 'Book' }, duration: 1500 },
      answer: 'tie',
      explain: { cn: '正确答案是同时落地。纸前面的空气被书先“劈开”了，所以纸不再像单独下落时那样被明显拖慢。', en: 'Tie is correct. The book clears the air in front of the paper, so drag on the paper drops sharply.' }
    },
    {
      code: { cn: 'TRIAL 03', en: 'TRIAL 03' },
      title: { cn: '钢球 vs 木球', en: 'Steel Ball vs Wood Ball' },
      desc: { cn: '条件：两个球外形接近，近似忽略空气。现在真正要抓住的是共同的重力加速度。', en: 'Condition: the two balls have similar shape and air effects are nearly ignored. Focus on shared gravitational acceleration.' },
      chip1: { cn: 'FIELD · 共同加速', en: 'FIELD · Shared Acceleration' },
      chip2: { cn: 'CONSTANT · g', en: 'CONSTANT · g' },
      leftTitle: { cn: '钢球', en: 'Steel Ball' },
      leftNote: { cn: '近似无空气', en: 'Air Nearly Ignored' },
      rightTitle: { cn: '木球', en: 'Wood Ball' },
      rightNote: { cn: '近似无空气', en: 'Air Nearly Ignored' },
      left: { className: 'object ball metal', text: { cn: '钢球', en: 'Steel' }, duration: 1650 },
      right: { className: 'object ball paperBallFill', text: { cn: '木球', en: 'Wood' }, duration: 1650 },
      answer: 'tie',
      explain: { cn: '正确答案是同时落地。忽略空气后，重的和轻的都会按同样的重力节奏变快。', en: 'Tie is correct. Once air is taken out of the story, heavy and light objects speed up with the same gravity rhythm.' }
    },
    {
      code: { cn: 'TRIAL 04', en: 'TRIAL 04' },
      title: { cn: '纸团 vs 平展开纸', en: 'Paper Ball vs Flat Paper' },
      desc: { cn: '条件：两张纸质量差不多，但形状不同。这一关专门用来观察“形状改变空气阻力”。', en: 'Condition: the two papers have similar mass but different shape. This round isolates how shape changes drag.' },
      chip1: { cn: 'WAVE · 形状差异', en: 'WAVE · Shape Effect' },
      chip2: { cn: 'MASS · 质量接近', en: 'MASS · Similar Mass' },
      leftTitle: { cn: '揉成纸团', en: 'Paper Ball' },
      leftNote: { cn: '空气中', en: 'In Air' },
      rightTitle: { cn: '平展开纸', en: 'Flat Paper' },
      rightNote: { cn: '空气中', en: 'In Air' },
      left: { className: 'object paperBall paperBallFill', text: { cn: '纸团', en: 'Ball' }, duration: 1550 },
      right: { className: 'object paper paperFlat', text: { cn: '平纸', en: 'Flat' }, duration: 2400 },
      answer: 'left',
      explain: { cn: '正确答案是左边先到。质量接近时，形状会明显改变空气阻力；纸团更紧凑，所以更快。', en: 'Left is correct. With similar mass, shape changes air drag a lot. The compact paper ball moves through the air more easily.' }
    }
  ];

  function tx(v) {
    return v[LANG] || v.cn || v.en || '';
  }

  function buildStyleSwitcher() {
    var host = document.getElementById('styleSwitcher');
    host.innerHTML = '';
    for (var i = 0; i < MODES.length; i++) {
      var mode = MODES[i];
      var btn = document.createElement('button');
      btn.className = 'vm-btn' + (MODE === mode.id ? ' vm-active' : '');
      btn.textContent = mode.label;
      btn.addEventListener('click', (function (nextMode) {
        return function () {
          MODE = nextMode;
          document.body.className = 'mode-' + nextMode;
          buildStyleSwitcher();
        };
      })(mode.id));
      host.appendChild(btn);
    }
  }

  function applyStaticText() {
    document.getElementById('sideTitle').textContent = tx(TEXT.sideTitle);
    document.getElementById('sideTagline').textContent = tx(TEXT.sideTagline);
    document.getElementById('roundLabel').textContent = tx(TEXT.roundLabel);
    document.getElementById('scoreLabel').textContent = tx(TEXT.scoreLabel);
    document.getElementById('guideContent').textContent = tx(TEXT.guide);
    document.getElementById('statusText').textContent = tx(TEXT.status);
    document.getElementById('heroTitle').textContent = tx(TEXT.heroTitle);
    document.getElementById('heroDesc').textContent = tx(TEXT.heroDesc);
    document.getElementById('pickLeft').textContent = tx(TEXT.pickLeft);
    document.getElementById('pickTie').textContent = tx(TEXT.pickTie);
    document.getElementById('pickRight').textContent = tx(TEXT.pickRight);
    document.getElementById('dropBtn').textContent = tx(TEXT.drop);
    document.getElementById('nextBtn').textContent = tx(TEXT.next);
    document.getElementById('resetBtn').textContent = tx(TEXT.reset);
    document.getElementById('langBtn').textContent = LANG === 'cn' ? 'CN' : 'EN';
  }

  function mountObject(host, config) {
    host.innerHTML = '';
    var el = document.createElement('div');
    el.className = config.className;
    el.textContent = tx(config.text);
    host.appendChild(el);
    return el;
  }

  function animateObject(el, duration) {
    el.style.transition = 'none';
    el.style.top = '10px';
    el.offsetHeight;
    el.style.transition = 'top ' + duration + 'ms cubic-bezier(.22,.72,.23,1)';
    el.style.top = 'calc(100% - 94px)';
  }

  function setActivePick(nextPick) {
    picked = nextPick;
    var buttons = document.querySelectorAll('.pick-btn');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (btn.getAttribute('data-pick') === nextPick) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  function renderRound() {
    applyStaticText();
    buildStyleSwitcher();
    var round = ROUNDS[roundIndex];
    document.getElementById('roundCode').textContent = tx(round.code);
    document.getElementById('roundTitle').textContent = tx(round.title);
    document.getElementById('roundDesc').textContent = tx(round.desc);
    document.getElementById('chip1').textContent = tx(round.chip1);
    document.getElementById('chip2').textContent = tx(round.chip2);
    document.getElementById('leftTitle').textContent = tx(round.leftTitle);
    document.getElementById('leftNote').textContent = tx(round.leftNote);
    document.getElementById('rightTitle').textContent = tx(round.rightTitle);
    document.getElementById('rightNote').textContent = tx(round.rightNote);
    document.getElementById('roundValue').textContent = (roundIndex + 1) + ' / ' + ROUNDS.length;
    document.getElementById('scoreValue').textContent = String(score);
    mountObject(document.getElementById('leftZone'), round.left);
    mountObject(document.getElementById('rightZone'), round.right);
    setActivePick(null);
    locked = false;
    var msg = document.getElementById('messageBox');
    msg.className = 'message';
    msg.textContent = LANG === 'cn'
      ? '先做预测，再释放物体。关键不是猜对，而是看清空气阻力和重力节奏。'
      : 'Predict first, then release. The goal is not luck, but separating drag from gravity.';
  }

  function judgeRound() {
    if (locked) return;
    var msg = document.getElementById('messageBox');
    if (!picked) {
      msg.className = 'message bad';
      msg.textContent = LANG === 'cn'
        ? '还没选择预测。先判断“左边先到 / 同时落地 / 右边先到”。'
        : 'Pick left, tie, or right before releasing the objects.';
      return;
    }
    locked = true;
    var round = ROUNDS[roundIndex];
    var left = document.querySelector('#leftZone .object');
    var right = document.querySelector('#rightZone .object');
    animateObject(left, round.left.duration);
    animateObject(right, round.right.duration);
    setTimeout(function () {
      var correct = picked === round.answer;
      if (correct) score += 1;
      document.getElementById('scoreValue').textContent = String(score);
      msg.className = 'message';
      msg.innerHTML = (correct
        ? '<span class="ok">' + (LANG === 'cn' ? '回答正确。' : 'Correct. ') + '</span>'
        : '<span class="bad">' + (LANG === 'cn' ? '这次猜错了。' : 'Not this time. ') + '</span>'
      ) + tx(round.explain);
    }, Math.max(round.left.duration, round.right.duration) + 140);
  }

  document.getElementById('langBtn').addEventListener('click', function () {
    LANG = LANG === 'cn' ? 'en' : 'cn';
    renderRound();
  });
  document.getElementById('dropBtn').addEventListener('click', judgeRound);
  document.getElementById('nextBtn').addEventListener('click', function () {
    roundIndex = (roundIndex + 1) % ROUNDS.length;
    renderRound();
  });
  document.getElementById('resetBtn').addEventListener('click', function () {
    score = 0;
    roundIndex = 0;
    renderRound();
  });

  var pickButtons = document.querySelectorAll('.pick-btn');
  for (var i = 0; i < pickButtons.length; i++) {
    pickButtons[i].addEventListener('click', function () {
      if (locked) return;
      setActivePick(this.getAttribute('data-pick'));
    });
  }

  renderRound();
})();
</script>
</body>
</html>`

function cloneCourseContent(): CourseContent {
  return JSON.parse(JSON.stringify(baseCourseContent)) as CourseContent
}

const courseContent = cloneCourseContent()

courseContent.ideas = courseContent.ideas.map((idea) => ({
  ...(idea as CourseIdeaSummary),
  style_key: "phys",
}))

courseContent.rendered_sections = {
  ...courseContent.rendered_sections,
  anim_freefall_scenes: {
    ...courseContent.rendered_sections.anim_freefall_scenes,
    html: ANIMATION_HTML,
  },
  game_freefall_prediction_lab: {
    ...courseContent.rendered_sections.game_freefall_prediction_lab,
    html: GAME_HTML,
  },
}

export default courseContent
