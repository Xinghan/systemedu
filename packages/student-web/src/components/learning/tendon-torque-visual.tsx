"use client"
import { useEffect, useMemo, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import type { SlideTechnicalVisual } from "@/lib/types/api"
import { assessStall, torqueBudget, torqueFormat as fmt, torqueNm } from "@/lib/tendon-torque"
import { TorqueObject3D } from "./torque-object-3d"
import "./tendon-torque.css"

function Equation({source}:{source:string}) {
  const html=useMemo(()=>katex.renderToString(source,{displayMode:true,throwOnError:false,output:"htmlAndMathml",trust:false}),[source])
  return <div className="tq-equation" role="math" aria-label={source} dangerouslySetInnerHTML={{__html:html}}/>
}
function CompareTable({rows,heads=["证据","看什么","能回答什么"]}:{rows:string[][];heads?:string[]}) {
  return <div className="tq-table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>
}
function BudgetTable({radius=1,factor=1.5}:{radius?:number;factor?:number}) {
  const b=torqueBudget(10,radius,5,factor)
  return <><CompareTable heads={["预算步骤","代入 / 条件","需求扭矩"]} rows={[["① 单根腱线","10 N × "+radius+" cm；垂直拉力",fmt(b.single)+" N·m"],["② 五指共同负载","5 根绳张力均为 10 N，同半径",fmt(b.total)+" N·m"],["③ 设计余量","总需求 × "+factor,fmt(b.required)+" N·m"],["④ 查持续能力","电压、温升、工况、连续扭矩","资料不足，待核验"]]}/><Equation source={String.raw`\begin{aligned}\tau_{\mathrm{budget}}&=k\sum_{i=1}^{5}F_i r_i\\&=${factor}\times5\times10\times${fmt(radius/100)}\\&=${fmt(b.required)}\;\mathrm{N\cdot m}\end{aligned}`}/></>
}

function TorqueLab() {
  const [radius,setRadius]=useState(1)
  const [playing,setPlaying]=useState(false)
  const [samples,setSamples]=useState<number[]>([1])
  useEffect(()=>{if(!playing)return;const id=window.setInterval(()=>{setRadius(r=>{const n=Math.round((r+.1)*10)/10;if(n>=2){return 2}return n})},300);return()=>window.clearInterval(id)},[playing])
  useEffect(()=>{if(radius>=2&&playing){const id=window.setTimeout(()=>setPlaying(false),0);return()=>window.clearTimeout(id)}},[radius,playing])
  useEffect(()=>{const stop=()=>{if(document.hidden)setPlaying(false)};document.addEventListener("visibilitychange",stop);return()=>document.removeEventListener("visibilitychange",stop)},[])
  const t=torqueNm(10,radius)
  return <><div className="tq-grid"><div className="tq-panel"><p className="tq-eyebrow">VIRTUAL EXPERIMENT · 单变量实验</p><h3>半径加倍，扭矩怎样变？</h3><p>固定：一根绳、张力 10 N、φ = 90°。改变：挂点到轴的距离。</p><label>摇臂半径：{radius.toFixed(1)} cm<input aria-label="实验摇臂半径" type="range" min="0.5" max="2" step="0.1" value={radius} onChange={e=>{setPlaying(false);setRadius(Number(e.target.value))}}/></label><div className="tq-toolbar"><button onClick={()=>{if(radius>=2)setRadius(.5);setPlaying(v=>!v)}}>{playing?"暂停变化":"播放半径变化"}</button><button onClick={()=>{setPlaying(false);setRadius(r=>Math.min(2,Math.round((r+.1)*10)/10))}}>单步 +0.1 cm</button><button onClick={()=>setSamples(s=>Array.from(new Set([...s,radius])).sort((a,b)=>a-b))}>记录当前读数</button><button onClick={()=>{setPlaying(false);setRadius(1);setSamples([1])}}>重置实验</button></div><p className="tq-note">播放是在扫描输入参数，不是模拟舵机运行速度。停止后数值保持，可记录证据。</p></div><div className="tq-panel"><svg viewBox="0 0 480 290" role="img" aria-label={`力臂 ${radius} 厘米，拉力 10 牛顿，扭矩 ${fmt(t)} 牛米`}><defs><marker id="tq-lab-a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#d46c42"/></marker></defs><rect x="48" y="44" width="80" height="86" rx="12" fill="#294e65"/><circle cx="90" cy="88" r="15" fill="#b2c2cc"/><line x1="90" y1="88" x2={90+radius*135} y2="88" stroke="#e2b054" strokeWidth="16"/><line x1={90+radius*135} y1="88" x2={90+radius*135} y2="190" stroke="#d46c42" strokeWidth="4" markerEnd="url(#tq-lab-a)"/><text x="155" y="53">r = {radius.toFixed(1)} cm</text><text x={100+radius*135} y="170">10 N</text><text x="45" y="235">所需扭矩</text><rect x="145" y="216" width={t/.2*250} height="30" rx="4" fill="#27899c"/><text x="145" y="275">{fmt(t)} N·m（满刻度 0.2 N·m）</text></svg><Equation source={String.raw`\tau=10\;\mathrm N\times${fmt(radius/100)}\;\mathrm m=${fmt(t)}\;\mathrm{N\cdot m}`}/></div></div><CompareTable heads={["记录的半径 r / cm","计算扭矩 τ / N·m","相对 1 cm 的倍数"]} rows={samples.map(r=>[r.toFixed(1),fmt(torqueNm(10,r)),fmt(r)+" 倍"])}/><p className="tq-note">解析模型输出，不是传感器实测值。理想准静态、忽略摩擦和传动损耗。对照端点：1 cm → 0.10 N·m；2 cm → 0.20 N·m。</p></>
}

function RatingDecision() {
  const [choice,setChoice]=useState("")
  const [checked,setChecked]=useState(false)
  return <div className="tq-grid"><div className="tq-panel"><p className="tq-eyebrow">SPECIFICATION CHECK</p><h3>0.75 小于 0.883，就能放心装吗？</h3><CompareTable heads={["项目","已知","未知"]} rows={[["需求","教学预算 0.750 N·m","真实绳张力 / 摩擦"],["舵机","堵转 9 kgf·cm ≈ 0.883 N·m","连续扭矩 / 温升"],["工况","仅有示例数值","电压、负载持续时间"]]}/><p>这里的 9 kgf·cm 是题目示例，不是推荐型号。</p></div><div className="tq-panel"><h3>选择有证据支持的结论</h3>{["可以，需求比堵转小就一定安全","不确定，仍缺持续运行能力和真实负载数据","余量乘过 1.5，就不必看温升"].map((v,i)=><label className="tq-option" key={v}><input type="radio" name="torque-rating" checked={choice===String(i)} onChange={()=>{setChoice(String(i));setChecked(false)}}/>{v}</label>)}<button disabled={!choice} onClick={()=>setChecked(true)}>检查判断</button>{checked&&<p role="status" className={choice==="1"?"tq-success":"tq-warning"}>{choice==="1"?"正确。比堵转小只通过粗筛，不能证明可以持续工作。把缺失的规格列入下一步验证。":"再比较数据的含义：堵转是转不动时的边界，不是可持续输出的承诺；余量不能代替缺失的规格。"}</p>}</div></div>
}

function BudgetReport() {
  const [radius,setRadius]=useState(1),[factor,setFactor]=useState(1.5)
  const [saved,setSaved]=useState(false)
  const budget=torqueBudget(10,radius,5,factor)
  const outcome=assessStall(budget.required,9)==="insufficient"?"当前预算已达到或超过示例堵转值，需调整方案。":"低于示例堵转值，但持续能力资料不足，不能确认可用。"
  function download() {
    const canvas=document.createElement("canvas");canvas.width=1500;canvas.height=960
    const ctx=canvas.getContext("2d");if(!ctx)return
    ctx.fillStyle="#faf8f2";ctx.fillRect(0,0,1500,960);ctx.fillStyle="#203f54";ctx.font="bold 46px sans-serif";ctx.fillText("M42 · 扭矩预算计算图",70,90)
    ctx.font="27px sans-serif"
    const lines=["教学示例 / 理想准静态模型 / 非硬件安全认证","每根绳张力假设 10 N；5 根；垂直拉力；忽略传动损耗",`摇臂半径 ${radius.toFixed(1)} cm = ${fmt(radius/100)} m`, `单根：10 × ${fmt(radius/100)} = ${fmt(budget.single)} N·m`, `五指：5 × ${fmt(budget.single)} = ${fmt(budget.total)} N·m`,`设计余量：${factor} × ${fmt(budget.total)} = ${fmt(budget.required)} N·m`,"示例规格：堵转 9 kgf·cm ≈ 0.883 N·m；持续扭矩未知",outcome,"待补证据：真实绳张力、全行程力臂、摩擦、电压、温升与持续扭矩。","下一阶段 M43：复核行程与预算后，再设计整手联动。"]
    lines.forEach((s,i)=>ctx.fillText(s,70,170+i*67));canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="torque-budget.png";a.click();setSaved(true);window.setTimeout(()=>URL.revokeObjectURL(url),1000)},"image/png")
  }
  return <><div className="tq-grid"><div className="tq-panel"><p className="tq-eyebrow">YOUR ARTIFACT · 可带走的计算图</p><h3>调整参数，生成这一阶段的成果</h3><label>半径：{radius.toFixed(1)} cm<input type="range" aria-label="报告摇臂半径" min="0.5" max="2" step="0.1" value={radius} onChange={e=>{setRadius(Number(e.target.value));setSaved(false)}}/></label><label>设计余量：{factor.toFixed(1)} 倍<input type="range" aria-label="报告设计余量" min="1.5" max="2" step="0.1" value={factor} onChange={e=>{setFactor(Number(e.target.value));setSaved(false)}}/></label><p className="tq-warning">{outcome}</p><button onClick={download}>下载 torque-budget.png</button>{saved&&<p role="status">已生成下载文件，保留了假设、计算与待核验项。</p>}</div><div><BudgetTable radius={radius} factor={factor}/></div></div><p className="tq-note">本练习采用教学示例，不要求儿童带电堵转测试。真实硬件试验须由成人指导，遵循设备额定值与防夹伤要求。</p></>
}

export function TendonTorqueVisual({visual}:{visual:Extract<SlideTechnicalVisual,{renderer:"tendon-torque"}>}) {
  const scene=visual.scene
  return <section className="tq-surface" aria-label={visual.aria_label||"M42 扭矩教学"}>
    {scene==="overview"&&<><div className="tq-heading"><span>FROM ONE FINGER TO FIVE</span><h3>行程合适，还要检查“拉得动”</h3><p>上一节的标定回答位置；这一节的预算回答负载。两份证据一起决定下一步。</p></div><CompareTable rows={[["M41 · 标定表","舵机角度 → 手指弯曲量","位置能否到达目标"],["M42 · 扭矩计算图","绳张力 × 垂直力臂 → 总负载","需要多少；还缺什么规格"],["M43 · 整手联动","实际布线 + 负载 + 行程核验","是否具备联动试验条件"]]}/><div className="tq-chain"><span>真实负载假设</span><b>→</b><span>单指计算</span><b>→</b><span>五指 + 余量</span><b>→</b><span>规格证据</span></div></>}
    {scene==="calibration"&&<><h3>同一张标定表，不能替代两类检查</h3><CompareTable rows={[["位置链","输入角度 → 拉绳位移 → 弯曲姿态","M41 的标定记录"],["力的链","回弹 / 接触 / 摩擦 → 绳张力 → 轴扭矩","M42 的负载预算"],["改变摇臂后","同样角度不一定得到原来的绳位移","重做行程标定并重算扭矩"]]}/><p className="tq-warning">没有真实标定数据，就不画一条冒充实测的漂亮曲线。把上一节自己的标定表带来复核。</p></>}
    {scene==="material"&&<><div className="tq-heading"><span>GENERATED IMAGE + HTML ANNOTATION</span><h3>先区分：拉绳力、回弹力与指尖接触力</h3></div><div className="tq-legend"><span className="orange">橙色：屈曲腱线</span><span className="blue">蓝色：回弹件</span><span>浅色：打印指节；灰色：铰接点</span></div><CompareTable heads={["量","发生在哪里","本次怎样处理"]} rows={[["绳张力","腱线内部，传递到摇臂挂点","教学假定为 10 N"],["回弹作用","弹性件与关节之间","是所需拉力的来源之一"],["指尖接触力","手指末端与物体接触处","不可直接当作绳张力"]]}/><p className="tq-note">上图：左侧伸直、右侧弯曲的生成结构示意。只用于辨认两侧部件与姿态，不作为尺寸、关节轨迹或实验测量证据。</p></>}
    {scene==="geometry"&&<><TorqueObject3D/><Equation source={"|\\tau|=F r\\sin\\varphi=F r_{\\perp}"}/><p className="tq-note">φ = 90° 时 r⊥ = r；φ = 0° 时拉力作用线通过轴，力矩为 0。此处显示力矩大小；平衡时舵机提供相反方向的力矩。</p></>}
    {scene==="tradeoff"&&<><h3>短摇臂省扭矩，但必须回头核对行程</h3><CompareTable heads={["条件","半径 1 cm","半径 2 cm"]} rows={[["同一根绳，张力 10 N，垂直作用","0.10 N·m","0.20 N·m"],["同一转角下的绳位移","取决于挂点与导向布置","改变半径后需重新标定"],["能否只看扭矩选半径","不能；还要弯到目标位置","不能；还要满足扭矩需求"]]}/><Equation source={"\\frac{\\tau_2}{\\tau_1}=\\frac{r_2}{r_1}=2"}/><p className="tq-note">比较条件：F 与 φ 保持不变。普通摇臂的拉绳位移受布线几何影响，不把固定半径线轮的弧长关系无条件套用到所有机构。</p></>}
    {scene==="budget"&&<><h3>一笔账，逐项写出假设</h3><BudgetTable/><p className="tq-note">五指张力均为 10 N、有效半径均为 1 cm、垂直拉力。真实五指若不同，应逐根求和，不能盲目乘 5。余量 1.5 只是此教学预算的设计选择。</p></>}
    {scene==="rating"&&<><div className="tq-grid"><div className="tq-panel"><p className="tq-eyebrow">UNIT CHECK</p><h3>kgf·cm 是力矩，不是质量</h3><Equation source={"1\\;\\mathrm{kgf\\cdot cm}=0.0980665\\;\\mathrm{N\\cdot m}"}/><Equation source={"9\\;\\mathrm{kgf\\cdot cm}\\approx0.883\\;\\mathrm{N\\cdot m}"}/><p>换算采用标准重力 9.80665 m/s²；与 0.750 N·m 需求使用相同单位。</p></div><div className="tq-panel"><h3>堵转值不是持续输出承诺</h3><CompareTable heads={["说明书项目","含义","是否足够"]} rows={[["堵转扭矩","轴转不动时的边界输出","只作粗筛"],["连续扭矩 / 工况","能维持工作的负载范围","还要核对电压与温升"],["预算安全余量","覆盖部分负载不确定性","不替代规格证据"]]}/></div></div></>}
    {scene==="lab"&&<TorqueLab/>}
    {scene==="decision"&&<RatingDecision/>}
    {scene==="report"&&<BudgetReport/>}
    {scene==="redesign"&&<><h3>改变一个设计，写下收益与代价</h3><CompareTable heads={["调整","可能降低什么","必须重新核验"]} rows={[["缩短摇臂","同样张力下所需轴扭矩","绳位移和手指弯曲是否到位"],["改善绳道、减少摩擦","实际传动损耗与绳张力","改善前后的张力证据"],["改变联动 / 差速布线","负载分配与动作次序","不保证最坏负载降低；需逐工况复核"]]}/><p className="tq-warning">“不用五根同时满载”不是可以随意删掉负载的理由。机构改变后，必须重新定义最不利工况。</p></>}
    {scene==="handoff"&&<><h3>带着两份证据，进入整手联动</h3><CompareTable heads={["已完成","在下一阶段怎样使用","仍需补齐"]} rows={[["M41 行程标定","检查摇臂是否能拉到目标姿态","改半径或布线后重标定"],["M42 扭矩预算 PNG","确定负载假设与需求范围","持续扭矩、电压、温升与真实负载"],["M43 装配方案","把五指与单舵机传动连起来","成人指导下循序验证，避免堵转与夹伤"]]}/><p className="tq-success">本节成果不是一句“够用”，而是一份可以被别人复核的计算图：假设 → 数值 → 规格 → 不确定性 → 下一步。</p><a className="tq-source" href="https://openstax.org/books/university-physics-volume-1/pages/10-6-torque" target="_blank" rel="noreferrer">力矩定义参考：OpenStax University Physics</a></>}
  </section>
}
