'use client'

import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CornerDownLeft, Layers3, ScanLine } from 'lucide-react'
import type { Concept } from '@/lib/transformer-viz/bridge'
import s from './model-overview.module.css'

const tour: { key: string; concept: Concept; title: string; text: string; shape: string }[] = [
  { key: 'embedding', concept: 'embedding', title: '先把符号放进向量空间', text: '每个 token 查到一个 48 维词向量，再加上它所在位置的向量。相同字符在不同位置有了不同的输入表示。T 是当前序列长度。', shape: 'T 个编号 → T × 48' },
  { key: 'norm-attn', concept: 'norm', title: '进入注意力前，先调整尺度', text: 'LayerNorm 对每个位置自己的 48 个特征求均值和方差。它不混合位置；此处采用 Pre-LN，所以归一化位于子层之前。', shape: 'T × 48 → T × 48' },
  { key: 'attention', concept: 'attention', title: '让每个位置寻找可参考的信息', text: '同一输入分别投影成 Q、K、V。Q 与 K 点积得到匹配分数，除以 √16；因果 mask 屏蔽未来位置。3 个头各自在 16 维空间中计算。', shape: '每头：Q、K、V 为 T × 16；分数为 T × T' },
  { key: 'softmax', concept: 'softmax', title: '把匹配分数变成混合比例', text: '对每个 query 的可见位置做 softmax。每行权重非负、和为 1；未来位置权重为 0。权重决定后续从各位置的 V 中汇聚多少信息。', shape: 'T × T 分数 → T × T 权重 A' },
  { key: 'projection', concept: 'projection', title: '收集信息，再合并三个头', text: '每个头用 AV 得到 T × 16 的输出。三个头沿特征轴拼成 T × 48，再经输出投影 Wₒ 组合各头的信息。', shape: '3 × (T × 16) → T × 48' },
  { key: 'residual-attn', concept: 'residual', title: '把注意力更新加回主干', text: '一条支路绕过了归一化和注意力，保留 x。将注意力输出逐元素加回 x，得到 u。长度和隐藏维度保持不变。', shape: 'u = x + Attention(LN₁(x))' },
  { key: 'norm-mlp', concept: 'norm', title: '准备下一次特征变换', text: '第二个 LayerNorm 使用自己的参数，对 u 的每一行归一化。旁路仍然保留原始 u，供下一次残差加法使用。', shape: 'T × 48 → T × 48' },
  { key: 'mlp', concept: 'mlp', title: '在每个位置内部加工特征', text: 'MLP 将 48 维扩展到 192 维，经 GELU 非线性，再压回 48 维。所有位置共享参数，但这里不会直接交换不同位置的信息。', shape: 'T × 48 → T × 192 → T × 48' },
  { key: 'residual-mlp', concept: 'residual', title: '完成一个 Block，继续向深处走', text: '将 MLP 的输出加回 u，得到 y。它进入下一个 Block。这个小模型共 3 个 Block，结构相同、参数各不相同。', shape: 'y = u + MLP(LN₂(u))' },
  { key: 'output', concept: 'output', title: '将最后位置的表示读成预测', text: '经过全部 Block 和最终 LayerNorm，每个位置投影到词表的 3 个 logits，再经 softmax。生成时取最后有效位置的分布选出下一 token，追加到前缀后再次计算。', shape: 'T × 48 → T × 3；取最后一行预测' },
]

type Props = { onOpen: (id: Concept) => void; passed: Concept[]; storageMessage: string }

export function ModelOverview({ onOpen, passed, storageMessage }: Props) {
  const [step, setStep] = useState<number | null>(null)
  const [variant, setVariant] = useState<'decoder' | 'original'>('decoder')
  const current = step === null ? null : tour[step]
  const open = (id: Concept) => onOpen(id)
  const moduleProps = { onOpen, passed, activeKey: current?.key }

  return <div className={s.overview}>
    <section className={s.intro} aria-labelledby='overview-title'>
      <div><span className={s.eyebrow}>THE BIG PICTURE / 先看整体</span><h1 id='overview-title' tabIndex={-1}>Transformer，<br />是一种怎样的结构？</h1></div>
      <div className={s.definition}><p>它是一类处理序列的神经网络。<strong>自注意力</strong>让每个位置读取相关位置的信息，<strong>前馈网络</strong>进一步变换特征；把这样的模块叠起来，就得到逐层更新的上下文表示。</p><p>用于语言生成时，模型把这些表示转成<strong>下一个词元的概率</strong>，再不断重复。下面先读懂结构，再点击任意部件，进入它的动画、数学与代码实验。</p></div>
    </section>

    <section className={s.architecture} aria-label='Transformer 架构总览'>
      <div className={s.sectionTop}><div><span className={s.eyebrow}>01 / 架构与数据流</span><h2>从一串符号，到一次预测</h2></div><div className={s.variantButtons} role='group' aria-label='比较 Transformer 架构'><button aria-pressed={variant === 'decoder'} onClick={() => setVariant('decoder')}>本实验 · GPT 式</button><button aria-pressed={variant === 'original'} onClick={() => { setVariant('original'); setStep(null) }}>原始 Transformer</button></div></div>
      {variant === 'original' ? <div className={s.original}>
        <div className={s.originalFlow}><div><small>源序列</small><strong>编码器 Encoder</strong><span>双向自注意力 → 前馈网络</span></div><ArrowRight size={24} /><div><small>目标前缀 + 编码器输出</small><strong>解码器 Decoder</strong><span>因果自注意力 → 交叉注意力 → 前馈网络</span></div><ArrowRight size={24} /><div><small>输出</small><strong>下一目标词元</strong><span>词表投影 → Softmax</span></div></div>
        <p>2017 年论文面向翻译：解码器用 cross-attention 读取编码器输出。原图采用 Post-LN（残差相加之后归一化）。下方可操作模型采用 <b>decoder-only / Pre-LN</b>，保留因果自注意力，没有编码器和交叉注意力。两者共享注意力与前馈的核心思想。</p><a href='https://arxiv.org/html/1706.03762v7' target='_blank' rel='noreferrer'>查看原论文 Figure 1 <ArrowUpRight size={13} /></a>
      </div> : <>
        <div className={s.pipeline}>
          <div className={s.tokens}><span className={s.caption}>输入 · token 序列</span><div>{['C', 'B', 'A', 'B', 'B', 'C'].map((t, i) => <span key={i}><b>{t}</b><small>{i}</small></span>)}</div><small>位置 0…T−1 · 当前示例 T = 6</small></div>
          <ArrowRight className={s.pipeArrow} size={20} />
          <Module {...moduleProps} id='embedding' label='词元 + 位置嵌入' className={s.embedding}><span className={s.miniEquation}>E[token] + P[position]</span><small>离散编号 → T × 48 向量</small></Module>
          <ArrowRight className={s.pipeArrow} size={20} />
          <a className={s.stack} href='#block-map'><Layers3 size={23} /><strong>Transformer Block × 3</strong><small>结构相同，参数不同</small><span>在下方展开一个 Block <ArrowDown size={13} /></span></a>
          <ArrowRight className={s.pipeArrow} size={20} />
          <Module {...moduleProps} id='norm' nodeKey='final-norm' label='最终 LayerNorm' className={s.finalNorm}><span className={s.miniEquation}>T × 48</span><small>逐位置调整特征尺度</small></Module>
          <ArrowRight className={s.pipeArrow} size={20} />
          <Module {...moduleProps} id='output' label='词表投影 + Softmax' className={s.output}><span className={s.miniEquation}>T × 48 → T × 3</span><small>最后位置 → 下一词元分布</small></Module>
        </div>
        <div className={s.generationLoop}><CornerDownLeft size={17} /><span><b>生成循环</b>　从最后位置的分布选一个 token，追加到输入，再跑一遍。3D 实验使用 greedy argmax。</span></div>
      </>}
      <div className={s.scope}><span>本实验的具体规模</span><b>3 Blocks</b><b>3 Heads / Block</b><b>48 维表示</b><b>11 位置容量</b><span>训练任务：A / B / C 排序；用于观察计算原理。</span></div>
    </section>

    <section className={s.cutaway} id='block-map' aria-labelledby='block-title'>
      <div className={s.sectionTop}><div><span className={s.eyebrow}>02 / 打开一个 BLOCK</span><h2 id='block-title'>先交换信息，再加工特征</h2></div><span className={s.clickHint}><ScanLine size={15} />点击有 ↗ 的模块，进入交互学习</span></div>
      <div className={s.cutawayGrid}>
        <div className={s.block}>
          <div className={s.blockMeta}><span>GPT STYLE / PRE-LN</span><span>输入 x、输出 y ∈ ℝ<sup>T×48</sup></span></div>
          <div className={s.lanes}>
            <div className={s.lane}>
              <div className={s.laneHeading}><b>① 跨位置交换信息</b><small>因果多头自注意力</small></div>
              <div className={s.branch}><div className={s.port}><b>x</b><span>来自嵌入层或前一 Block</span></div><div className={s.bypass}><span>保留 x</span></div>
                <div className={s.mainPath}>
                  <Module {...moduleProps} id='norm' nodeKey='norm-attn' label='LayerNorm ①' className={s.norm}><small>每个位置独立归一化</small></Module><Flow />
                  <Module {...moduleProps} id='attention' label='Q · K · V 与匹配' className={s.attention}><div className={s.heads}><span>Head 1<em>16 维</em></span><span>Head 2<em>16 维</em></span><span>Head 3<em>16 维</em></span></div><span className={s.miniEquation}>QKᵀ / √16 + 因果 mask</span><small>每个位置只能读取自己及之前的位置</small></Module><Flow />
                  <Module {...moduleProps} id='softmax' label='Masked Softmax' className={s.softmax}><span className={s.weightBars} aria-hidden='true'><i /><i /><i /><i /></span><small>每一行：匹配分数 → 和为 1 的权重 A</small></Module><Flow />
                  <Module {...moduleProps} id='projection' label='汇聚 V · 合并多头' className={s.projection}><span className={s.miniEquation}>AV → Concat → Wₒ</span><span className={s.concat} aria-hidden='true'><i /><i /><i /></span><small>3 份 16 维 → 一份 48 维</small></Module><Flow />
                </div>
                <Module {...moduleProps} id='residual' nodeKey='residual-attn' label='残差相加 ①' className={s.add}><span className={s.addEquation}><b>＋</b> u = x + Attention(LN₁(x))</span></Module>
              </div>
              <div className={s.laneExit}>得到 u，送入②前馈子层 <ArrowRight size={16} /></div>
            </div>
            <div className={s.lane}>
              <div className={s.laneHeading}><b>② 逐位置加工特征</b><small>前馈网络 FFN / MLP</small></div>
              <div className={s.branch}><div className={s.port}><b>u</b><span>来自注意力子层的残差输出</span></div><div className={s.bypass}><span>保留 u</span></div>
                <div className={s.mainPath}>
                  <Module {...moduleProps} id='norm' nodeKey='norm-mlp' label='LayerNorm ②' className={s.norm}><small>独立于第一个 LN 的参数</small></Module><Flow />
                  <Module {...moduleProps} id='mlp' label='MLP · GELU' className={s.mlp}><span className={s.featureShape}><i style={{ width: '42%' }}>Linear · 48 → 192</i><ArrowDown size={14} /><i className={s.gelu}>GELU 非线性</i><ArrowDown size={14} /><i style={{ width: '42%' }}>Linear · 192 → 48</i></span><small>各位置共享参数；不直接混合位置</small></Module><Flow />
                </div>
                <Module {...moduleProps} id='residual' nodeKey='residual-mlp' label='残差相加 ②' className={s.add}><span className={s.addEquation}><b>＋</b> y = u + MLP(LN₂(u))</span></Module>
              </div>
              <div className={s.laneExit}>得到 y，送入下一 Block / 最终 LN <ArrowRight size={16} /></div>
              <div className={s.twoJobs}><b>两种不同的计算</b><p>Attention 沿序列位置汇聚信息。<br />MLP 在单个位置内部变换特征。</p><span>两者最终都回到 T × 48，才能加回残差流。</span></div>
            </div>
          </div>
          <div className={s.blockFoot}>灰色旁路 = 原始表示直通　·　＋ = 逐元素相加　·　箭头 = 前向计算顺序</div>
        </div>

        <aside className={s.guide} aria-label='结构导览'>
          <span className={s.eyebrow}>FOLLOW THE COMPUTATION</span><h3>沿数据流走一遍</h3>
          <p>先建立每个部件的作用与顺序，再打开细节。导览高亮的是结构步骤，不是数值推理动画。</p>
          {current ? <><div className={s.tourText} aria-live='polite' aria-atomic='true'><span className={s.tourCount}>{String(step! + 1).padStart(2, '0')} / {tour.length}</span><h4>{current.title}</h4><p>{current.text}</p><code>{current.shape}</code></div><div className={s.tourControls}><button aria-label='导览上一步' disabled={step === 0} onClick={() => setStep(i => Math.max(0, i! - 1))}><ChevronLeft size={16} /></button><button onClick={() => setStep(i => i === tour.length - 1 ? null : i! + 1)}>{step === tour.length - 1 ? '结束导览' : '下一步'}<ChevronRight size={16} /></button></div><button className={s.enter} onClick={() => open(current.concept)}>打开这一步的交互实验<ArrowUpRight size={16} /></button></> : <button className={s.enter} onClick={() => { setVariant('decoder'); setStep(0) }}>开始 10 步结构导览<ArrowRight size={16} /></button>}
          <div className={s.legend}><h4>读图时记住三件事</h4><p><b>Token</b> 是序列中的离散单位。在这个小模型中，一个字符就是一个 token。</p><p><b>T × 48</b> 表示 T 个位置，每个位置有 48 个特征。特征维没有预设的自然语言含义。</p><p><b>参数与表示不同。</b>权重是训练学到的；图中流动的表示随输入改变。这里观察的是一次前向计算。</p></div>
          <div className={s.learningNote}><span>{passed.length} / 8 部件已通过</span><p>点击部件后可做概念题、代码填空与数值检查。仅浏览总览不会计为掌握。</p></div>
        </aside>
      </div>
    </section>

    <footer className={s.footer}><div><b>从真实模型走向算法</b><p>进入模块后继续使用 Brendan Bycroft 的 3D 引擎、模型权重与本地推理。</p><span>{storageMessage}</span></div><div><a href='https://bbycroft.net/llm' target='_blank' rel='noreferrer'>LLM Visualization · 原始模型<ArrowUpRight size={13} /></a><a href='https://poloclub.github.io/transformer-explainer/' target='_blank' rel='noreferrer'>Transformer Explainer · 对照阅读<ArrowUpRight size={13} /></a><a href='/standalone/transformer-lab/model/NOTICE.txt' target='_blank' rel='noreferrer'>开源来源与许可<ArrowUpRight size={13} /></a></div></footer>
  </div>
}

function Flow() { return <span className={s.flow} aria-hidden='true'><ArrowDown size={17} /></span> }

function Module({ id, nodeKey = id, label, children, className = '', onOpen, passed, activeKey }: { id: Concept; nodeKey?: string; label: string; children: ReactNode; className?: string; onOpen: Props['onOpen']; passed: Concept[]; activeKey?: string }) {
  return <button className={`${s.module} ${className}`} data-active={activeKey === nodeKey} data-concept={id} onClick={() => onOpen(id)} aria-label={`打开${label}交互学习`}>
    <span className={s.moduleLabel}>{label}<span>{passed.includes(id) ? <Check size={14} /> : <ArrowUpRight size={14} />}</span></span>
    {children}
  </button>
}
