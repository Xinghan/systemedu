"use client"
import { useState, type CSSProperties } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"
import type { ModuleId, RecordData } from "./record"
import s from "./post-training.module.css"

type Props = { moduleId: ModuleId; lab: RecordData["lab"]; update: (lab: RecordData["lab"]) => void }
export function ConceptLab({ moduleId, lab, update }: Props) {
  const [playing, setPlaying] = useState(false)
  if (moduleId === "M01") {
    const routes = [
      ["目标示范", "SFT", "输入 + 正确 JSON", "最小化目标 continuation 的负对数似然。"],
      ["成对偏好", "DPO", "同输入 + chosen / rejected", "相对参考策略提高偏好回答的概率比。"],
      ["人类评分偏好", "RM → RLHF", "比较数据 → 奖励模型", "先学奖励，再优化策略；监控奖励投机。"],
      ["可验证结果", "RLVR", "采样回答 + 验证器奖励", "用可执行结果提供信号；检查验证器覆盖和漏洞。"],
    ]
    const route = routes[lab.signal]
    return <aside className={s.lab} aria-label="后训练方法实验"><div className={s.labHeading}><span>INTERACTIVE 01</span><strong>改变学习信号，观察训练目标</strong></div>
      <div className={s.signalButtons}>{routes.map((r,i) => <button key={r[0]} aria-pressed={lab.signal === i} onClick={() => update({ ...lab, signal: i })}>{r[0]}</button>)}</div>
      <div className={s.signalFlow}><div><small>DATA</small><strong>{route[2]}</strong></div><span aria-hidden>→</span><div><small>OBJECTIVE</small><strong>{route[1]}</strong></div><span aria-hidden>→</span><div><small>PARAMETERS</small><strong>全参数 / LoRA / QLoRA</strong></div></div>
      <p role="status">{route[3]} 参数策略是另一条轴：选择 LoRA 不会替你决定学习信号。</p></aside>
  }
  if (moduleId === "M02") {
    const tokens = ["<user>", "ticket", "<assistant>", "{category:", "account}", "<EOS>", "<PAD>"]
    const probs = [.4,.3,.7,.8,.6,.9,.5]
    const enabled = tokens.map((_,i) => i > 0 && i < 6 && (i >= 3 || !lab.maskPrompt) && (i !== 5 || lab.keepEos))
    const count = enabled.filter(Boolean).length
    const nll = enabled.reduce((sum,on,i) => sum + (on ? -Math.log(probs[i]) : 0),0)/count
    return <aside className={s.lab} aria-label="SFT token 掩码实验"><div className={s.labHeading}><span>INTERACTIVE 02</span><strong>损失究竟来自哪些位置？</strong></div>
      <div className={s.labOptions}><label><input type="checkbox" checked={lab.maskPrompt} onChange={e => update({ ...lab, maskPrompt: e.target.checked })} />屏蔽 prompt 标签</label><label><input type="checkbox" checked={lab.keepEos} onChange={e => update({ ...lab, keepEos: e.target.checked })} />保留 EOS 监督</label></div>
      <div className={s.tokens}>{tokens.map((token,i) => <div key={i} className={enabled[i] ? s.activeToken : s.ignoredToken}><small>位置 {i}</small><code>{token}</code><span>{enabled[i] ? `logit ${i-1} → label ${i}` : "不计 loss"}</span><small>{enabled[i] ? `p=${probs[i].toFixed(1)}` : "label = −100"}</small></div>)}</div>
      <div className={s.labResult}><strong>{count} <small>有效目标</small></strong><strong>{nll.toFixed(3)} <small>mean NLL</small></strong><code>−Σ log p(target) / N</code></div>
      <p role="status">{!lab.maskPrompt ? "当前把 prompt 也计入目标，已偏离本项目 completion-only 契约。" : !lab.keepEos ? "当前未训练结束标记；输出停止行为可能变差。" : "当前掩码符合本项目契约：只监督回答和 EOS，padding 不计损失。"}</p><p className={s.labNote}>简化 token 示意与固定概率，用于检查目标选择；不是 Qwen 的真实分词或训练结果。位置0没有前序 logit，不参与此 loss。</p></aside>
  }
  if (moduleId === "M05") return <aside className={s.lab} aria-label="结课实验矩阵"><div className={s.labHeading}><span>EXPERIMENT DESIGN</span><strong>同一份 test，四个可比较的结果</strong></div><div className={s.experimentGrid}>{["FLOAT · baseline","NF4 · baseline","FLOAT + LoRA","NF4 + LoRA"].map((x,i) => <div key={x}><small>RUN 0{i+1}</small><strong>{x}</strong><span>schema valid / exact match / macro F1</span></div>)}</div><p>这些是待运行的实验组，不是预填的测量结果。数据 hash、模型 SHA、prompt 和解码参数应保持一致。</p></aside>
  const params = 2*4096*lab.rank
  const quant = moduleId === "M04" && lab.quantized
  const weightGiB = 7e9*(quant ? .5 : 2)/2**30
  return <aside className={s.lab} aria-label={moduleId === "M03" ? "LoRA 三维矩阵实验" : "QLoRA 三维存储实验"}>
    <div className={s.labHeading}><span>3D EXPLORER · {moduleId === "M03" ? "LOW-RANK UPDATE" : "WEIGHT STORAGE"}</span><button onClick={() => setPlaying(p => !p)} aria-label={playing ? "暂停三维旋转" : "开始三维旋转"}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "暂停" : "旋转"}</button></div>
    <div className={s.scene}>
      <div className={`${s.matrixWorld} ${playing ? s.spinning : ""}`} style={{ "--angle": `${lab.angle}deg`, "--rank-size": `${Math.max(14,lab.rank*2)}px` } as CSSProperties}>
        <div className={`${s.matrix} ${s.baseMatrix}`} style={{ height: quant ? 90 : 160 }}><span>W₀</span><small>{quant ? "NF4 · FROZEN" : "BF16 · FROZEN"}</small><i /></div>
        <div className={`${s.matrix} ${s.bMatrix}`}><span>B</span><i /></div>
        <div className={`${s.matrix} ${s.aMatrix}`}><span>A</span><i /></div>
        <div className={s.deltaLabel}>ΔW = (α/r) BA</div>
      </div>
    </div>
    <div className={s.matrixLegend}><span><i />冻结基座 W₀</span><span><i />B: 4096 × {lab.rank}</span><span><i />A: {lab.rank} × 4096</span></div>
    <div className={s.labControls}><label>Rank r<select value={lab.rank} onChange={e => update({ ...lab, rank: Number(e.target.value) })}>{[2,4,8,16,32].map(r => <option key={r}>{r}</option>)}</select></label><label>视角<input aria-label="三维视角" type="range" min="-60" max="30" value={lab.angle} onChange={e => update({ ...lab, angle: Number(e.target.value) })} /></label>{moduleId === "M04" && <label className={s.quantToggle}><input type="checkbox" checked={lab.quantized} onChange={e => update({ ...lab, quantized: e.target.checked })} />NF4 存储</label>}<button aria-label="重置三维实验" onClick={() => { setPlaying(false); update({ ...lab, rank: 8, angle: -25, quantized: true }) }}><RotateCcw size={16} /></button></div>
    <div className={s.labResult}><strong>{params.toLocaleString()}<small>单层 adapter 参数</small></strong><strong>{(params/(4096*4096)*100).toFixed(2)}%<small>相对单层基座参数</small></strong>{moduleId === "M04" ? <strong>{weightGiB.toFixed(2)} GiB<small>假设7B权重的理想载荷</small></strong> : <strong>{(16/lab.rank).toFixed(2)}<small>α=16 时的缩放</small></strong>}</div>
    <p role="status">r={lab.rank}，rank(ΔW) ≤ {lab.rank}。{moduleId === "M04" ? "切换精度只改变基座存储，adapter 参数数量保持不变。" : "提高 rank 增加更新空间的容量；是否提升任务效果需要消融实验。"}</p>
    <p className={s.labNote}>三维几何用于表达结构，尺寸不按实际矩阵比例绘制。{moduleId === "M04" ? "7B 仅用于量级算例，本课程训练0.5B；理想载荷不含量化元数据、未量化层、激活、梯度和优化器，不是训练显存预测。" : "网格不表示真实模型权重。旋转可暂停；所有数值也以文本给出。"}</p>
  </aside>
}
