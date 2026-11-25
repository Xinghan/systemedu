'use client'
import { useState } from 'react'
import { usePython } from './use-python'
import c from './reader.module.css'

const examples:Record<string,{title:string; prompt:string; code:string}> = {
  mask:{
    title:'从允许访问的位置算出权重',
    prompt:'先运行原例，再把 visible 的第三项改成 True。用同一组分数观察未来词会分走多少权重。',
    code:`from math import exp, log

scores = [0.0, log(2), 10.0]
visible = [True, True, False]
peak = max(s for s, ok in zip(scores, visible) if ok)
mass = [exp(s - peak) if ok else 0 for s, ok in zip(scores, visible)]
weights = [m / sum(mass) for m in mass]
print([round(w, 4) for w in weights])`,
  },
  translation:{
    title:'用两个查询读取三个源位置',
    prompt:'每次循环处理一个目标查询。先预测打印出的行数、列数，再改变最后一个源键的方向，看哪一行受影响。',
    code:`from math import exp, sqrt

queries = [[1, 0], [0, 1]]
source_keys = [[1, 0], [0, 1], [-1, 0]]
for q in queries:
    scores = [sum(a*b for a, b in zip(q, k)) / sqrt(len(q)) for k in source_keys]
    mass = [exp(s - max(scores)) for s in scores]
    print([round(m / sum(mass), 4) for m in mass])`,
  },
  training:{
    title:'用两次前向计算检查反向传播的答案',
    prompt:'这里固定两个候选词的分数为 0 与 b，第二个是正确词。运行后比较两种斜率。把 b 改成 2，解释梯度的大小为何改变。',
    code:`from math import exp, log

def loss(b):
    return log(1 + exp(-b))

b, delta = 0.0, 0.0001
p = 1 / (1 + exp(-b))
slope = (loss(b + delta) - loss(b - delta)) / (2 * delta)
print("数值斜率", round(slope, 6), "公式结果", round(p - 1, 6))
print("更新前后", round(loss(b), 6), round(loss(b - 0.5*(p - 1)), 6))`,
  },
}
export function ReaderCode({id}:{id:string}) {
  const example=examples[id]
  return example?<Editor example={example} id={id}/>:null
}
function Editor({example,id}:{example:(typeof examples)[string]; id:string}) {
  const python=usePython()
  const [code,setCode]=useState(example.code)
  const [result,setResult]=useState<{source:string;output:string}|null>(null)
  return <section className={c.codeExample}><h3>{example.title}</h3><p>{example.prompt}</p>
    <label>可编辑的 Python 示例<textarea aria-label="本节 Python 示例" spellCheck={false} value={code} maxLength={20000} onChange={e=>setCode(e.target.value)}/></label>
    <div className={c.choices}><button disabled={python.status!=='idle'} onClick={()=>{setResult(null);python.runScript(code,r=>setResult({source:code,output:r.error??(r.stdout||'运行完成。')}),message=>setResult({source:code,output:message}))}}>{python.status==='idle'?'运行示例':python.status==='loading'?'加载 Python…':'正在运行…'}</button>{python.status!=='idle'&&<button onClick={python.cancel}>停止</button>}
    <a download={id+'-example.py'} href={'data:text/plain;charset=utf-8,'+encodeURIComponent(code)}>下载当前代码</a></div>
    {result&&<div role="status">{result.source!==code&&<b>代码已修改，下面是上次输出。</b>}<pre>{result.output}</pre></div>}
    <small>浏览器首次运行需联网加载 Python。下载的示例可用本机 Python 3 直接运行。</small>
  </section>
}
