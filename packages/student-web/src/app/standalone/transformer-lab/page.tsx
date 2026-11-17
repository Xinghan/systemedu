import type { Metadata } from 'next'
import { TransformerModelExplorer } from './model-explorer'
export const metadata:Metadata={title:'Transformer · 交互模型实验室',description:'基于 Brendan Bycroft 开源 3D 模型，探索真实张量计算，并在模型内部完成概念检查与 Python 实验。'}
export default function Page(){return <TransformerModelExplorer/>}
