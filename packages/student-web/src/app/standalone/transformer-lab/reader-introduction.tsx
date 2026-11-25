'use client'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ReaderConceptIndex } from './reader-concept-index'
import c from './reader.module.css'

const passages = [
  { start:'I deposited the cash at the ', end:'.', clue:'deposited the cash（把现金存入）', meaning:'银行', category:'金融', translation:'我把现金存进了银行。', continuation:'The teller handed me a receipt.', continuationCN:'柜员递给我一张回执。' },
  { start:'We sat on the ', end:' of the river.', clue:'of the river（河流的）', meaning:'河岸', category:'户外活动', translation:'我们坐在河岸上。', continuation:'The water moved slowly past us.', continuationCN:'河水从我们身旁缓缓流过。' },
]
const tasks = ['判断主题','翻译成中文','续写一句'] as const
const stages = [
  { title:'把文字变成数字', text:'模型先把句子切成小片段，称为词元。每个词元用一组数表示，还要让模型知道这些片段的先后顺序。', lesson:'embedding' },
  { title:'联系前后文', text:'在一个叫作“自注意力”的步骤里，每个位置按需要从其他可见位置取回信息。这样，同一个 bank 遇到 cash 或 river 时，就能得到不同的表示。', lesson:'routing' },
  { title:'逐层加工', text:'每个位置再用一个小网络加工刚得到的信息，并把改动加回原来的表示。这些步骤会重复多层，后一层可以利用前一层已经找出的关系。', lesson:'feedforward' },
  { title:'给出任务需要的结果', text:'判断主题时，模型给各个类别打分。生成文字时，模型给候选的下一个词元打分，接上选出的词元，再算下一步。', lesson:'readout' },
]
type Props = { first: string; resume?: { id:string; title:string } }
export function ReaderIntroduction({first,resume}:Props) {
  const [passage,setPassage] = useState(0)
  const [task,setTask] = useState(1)
  const example = passages[passage]
  const result = [example.category, example.translation, example.continuation][task]
  const explanations = [
    '分类可以只输出一个标签。例如，先让模型读完整句，再根据整句的表示给几个预设主题打分。',
    '翻译需要读懂原句，再逐步写出译文。选对 bank 的中文意思，是其中一步。',
    '续写要根据已经读到的文字逐个预测后续词元。这里给出一种合理的续写，原句还可以有其他接法。',
  ]
  return <>
    <header className={c.lessonHead}>
      <p className={c.kicker}>课程导读</p>
      <h1 id="reader-title" tabIndex={-1}>Transformer 是什么？它能用来做什么？</h1>
      <p>Transformer 是一种神经网络架构，可以用来翻译、判断文章主题，也可以用来生成文字。“架构”指模型内部各个计算步骤的组织方式。这些用途有一个共同之处。模型处理一个词时，需要结合其他词提供的线索。</p>
    </header>
    <div className={c.orientation}>
      <div className={c.story}>
        <h2>为什么要联系上下文？</h2>
        <p>单看英文单词 <i lang="en">bank</i>，你能想到“银行”，也能想到“河岸”。只查词典会得到两个解释。要决定该用哪个，你会接着看句子里说的是存钱，还是一条河。</p>
        <p>Transformer 也需要解决这类问题。它在计算中调整各个词对当前位置的影响，让同一个词在不同句子里获得不同的表示。随后，模型就可以利用这份信息判断主题、翻译句子，或继续写下去。</p>
        <h2>架构怎样变成一个会做事的模型？</h2>
        <p>以翻译为例，训练时可以给模型看许多配对的原文和译文。一段文字会被切成小片段，每个片段叫作一个词元。模型试着预测译文里的下一个词元，再根据它给正确答案的概率调整内部参数。训练让它逐渐学会哪些线索有用。使用时，我们给它一段新的原文，它便用学到的参数生成译文。</p>
        <p>这个思路也能用于图像。例如，把照片分成许多小块，让各块交换信息，模型就可以综合不同区域的特征来判断照片里是什么。本课用文字来讲，方便你亲手算出每一步。 <a className={c.paperLink} href="https://research.google/pubs/an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale/" target="_blank" rel="noreferrer">图像识别论文 ↗</a></p>
      </div>
      <section className={c.contextDemo} aria-labelledby="context-question">
        <h2 id="context-question">这里的 bank 指什么？</h2>
        <p>换一句原文，找出影响你判断的词。</p>
        <div className={c.choices} aria-label="选择原句">{['存钱的句子','河边的句子'].map((label,i)=><button key={label} aria-pressed={passage===i} onClick={()=>setPassage(i)}>{label}</button>)}</div>
        <blockquote lang="en">{example.start}<mark>bank</mark>{example.end}</blockquote>
        <p className={c.clue}>线索是 {example.clue}，这里的 bank 指<strong>{example.meaning}</strong>。</p>
        <h3>同一句话，可以交给模型做什么？</h3>
        <div className={c.choices} aria-label="选择任务">{tasks.map((label,i)=><button key={label} aria-pressed={task===i} onClick={()=>setTask(i)}>{label}</button>)}</div>
        <div className={c.exampleOutput} aria-live="polite"><small>{tasks[task]} · 示例输出</small><strong>{result}</strong>{task===2&&<span>{example.continuationCN}</span>}<p>{explanations[task]}</p></div>
      </section>
    </div>
    <section className={c.overviewFlow}><h2>一句话在模型里经历了什么？</h2>
      <ol>{stages.map(stage=><li key={stage.lesson}><a href={'#lesson/'+stage.lesson}>{stage.title} <ArrowRight size={14}/></a><p>{stage.text}</p></li>)}</ol>
    </section>
    <section className={c.story}><h2>为什么这门课从「猫追」讲起？</h2>
      <p>最早的 Transformer 用于机器翻译，其中的编码器读原句，解码器参考原句写译文。后来，研究者也用编码器做文本分类，用只含解码器的模型续写文章、生成对话回复。这些模型共享核心计算，能读取哪些文字、最后要输出什么，则由任务决定。 <a className={c.paperLink} href="https://research.google/pubs/attention-is-all-you-need/" target="_blank" rel="noreferrer">Transformer 原论文 ↗</a></p>
      <p>我们先选最容易亲手验算的一条路。读到「猫追」时，把候选词缩小到三个，你就能算清模型怎样利用前文，给每个候选词分配概率。到第 11 节，再用同样的部件搭回翻译器，解释译文里的每个位置怎样读取原文。</p>
    </section>
    <div className={c.startLinks}><a href={'#lesson/'+first}>进入第一节 · 算一次下一词预测 <ArrowRight size={16}/></a>{resume&&<a href={'#lesson/'+resume.id}>继续上次的课 · {resume.title}</a>}</div>
    <ReaderConceptIndex/>
  </>
}
