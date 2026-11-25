import type { Metadata } from 'next'
import { TransformerModelExplorer } from './model-explorer'
import { TOPICS } from './model-content'
import { lessons } from './reader-lessons'
import { FirstPrinciples } from './reader'

export const metadata: Metadata = {
  title: '从零推导 Transformer · 交互原理实验室',
  description: '从词元、向量和概率开始，手算注意力、训练与生成，走进可逐格检查的三维 Transformer。',
}
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = await searchParams
  const part = TOPICS.find(t=>t.id===query.part)?.id ?? 'embedding'
  const from = lessons.find(l=>l.id===query.from)?.id
  if (query.view==='model' || query.view==='math' || query.view==='overview' || query.practice!==undefined) {
    const mode = query.view==='model'||query.view==='math' ? query.view : 'overview'
    return <TransformerModelExplorer initialMode={mode} initialConcept={part} fromLesson={from}/>
  }
  return <FirstPrinciples/>
}
