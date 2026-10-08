"use client"

import type {SlideTechnicalVisual} from '@/lib/types/api'
import {useReadonlySteps} from './readonly-presentation'
import './python-variable.css'

type Trace=Extract<SlideTechnicalVisual,{renderer:'code-trace'}>
export function PythonVariableVisual({visual}:{visual:Trace}){
  const {root,step:index}=useReadonlySteps(visual.steps.length)
  const step=visual.steps[index]
  if(!step)return null
  const code=step.code||visual.code,variables=step.variables||[]
  return <section ref={root} className="py-variable" aria-label={visual.aria_label} data-presentation="readonly" data-demo-step={index}>
    <header><div><span className="py-eyebrow">M08 / PYTHON · 只读讲解</span><h3>{step.title}</h3></div><span className="py-status">演示状态 {index+1} / {visual.steps.length}</span></header>
    <div className="py-evidence-grid">
      <article className="py-code"><h4>01 / 源代码 <small>高亮 = 当前检查的语句</small></h4><ol aria-label="Python 源代码">{code.split('\n').map((line,i)=><li key={i} className={step.active_lines.includes(i+1)?'active':''}><span>{i+1}</span><code>{line||' '}</code></li>)}</ol><p>赋值 <code>=</code>：先求右侧的值，再与左侧名字绑定。</p></article>
      <article className="py-binding"><h4>02 / 当前名称绑定 <small>此刻，不是历史</small></h4><table><thead><tr><th>变量名</th><th>当前值 / repr</th></tr></thead><tbody>{variables.length?variables.map(v=><tr key={v.name}><th><code>{v.name}</code></th><td><code>{v.value}</code></td></tr>):<tr><td colSpan={2}>尚无本例创建的变量</td></tr>}</tbody></table><p>表示字符串时，引号不是文字值的一部分。</p></article>
      <article className={'py-console '+(step.error?'has-error':'')}><h4>03 / 终端输出 <small>已打印的内容会保留</small></h4><pre aria-label="终端输出">{step.output||'（尚无标准输出）'}</pre>{step.error&&<p role="status" className="py-error">{step.error}</p>}</article>
    </div>
    <p className="py-explanation">{step.detail}</p>
    <section className="py-trace"><h4>完整执行轨迹 <small>所有状态直接可读，无须操作</small></h4><table><thead><tr><th>步骤 / 语句</th><th>当前变量值</th><th>累计输出 / 错误</th></tr></thead><tbody>{visual.steps.map((s,i)=><tr key={i} data-trace-row={i} aria-current={i===index?'step':undefined} className={i===index?'current':''}><th><b>{i+1}. {s.title}</b><code>{s.active_lines.map(n=>(s.code||visual.code).split('\n')[n-1]).join('\n')||'尚未执行'}</code></th><td><code>{s.variables?.map(v=>`${v.name} → ${v.value}`).join('\n')||'尚无本例变量'}</code></td><td><code>{s.output||'（尚无标准输出）'}</code>{s.error&&<code className="py-trace-error">{s.error}</code>}</td></tr>)}</tbody></table></section>
    <footer>教学轨迹 · 示例由 Python 核验。这里不执行任意代码；请在自己的 Python 环境运行后记录实际结果。</footer>
  </section>
}
