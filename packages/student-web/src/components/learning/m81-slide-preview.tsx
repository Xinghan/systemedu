"use client"

import { useState } from "react"
import type { SlideEntry } from "@/lib/types/api"
import { SlideBody } from "./teacher-scene-view"

export function M81SlidePreview({ slides }: { slides: SlideEntry[] }) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  return <main className="min-h-screen bg-[#EDF2F5] px-5 py-8 text-[#193D53] sm:px-10"><div className="mx-auto max-w-[1200px]">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-[#C9D7DF] pb-6"><div><p className="mb-2 text-xs font-semibold tracking-[.16em] text-[#5A7D92]">分子怪兽猎人 / 新版教学 slide</p><h1 className="text-3xl font-bold tracking-tight">M81 · 让每一条预测误差可见</h1><p className="mt-3 text-sm text-[#617D8E]">本批 11 页全部重做 · KaTeX 公式 + JSXGraph 坐标图 + 可操作练习</p></div><span className="rounded-full border border-[#DAC0A5] bg-[#FFF2E4] px-4 py-2 text-xs font-semibold text-[#99613C]">本地预览 · M81 已上线 · v1</span></header>
    <div className="mb-5 flex flex-wrap gap-2">{[[3,"04 看散点"],[7,"08 拖点 / 播放"],[8,"09 亲手练习"]].map(([i,label])=><button key={String(i)} type="button" onClick={()=>setIndex(Number(i))} className="rounded-md bg-white px-4 py-2 text-xs text-[#386983] ring-1 ring-[#C6D7E2]">{label}</button>)}<a href="/slide-preview/m80" className="px-3 py-2 text-xs text-[#678394] underline">上一批 M80</a></div>
    <nav aria-label="新版 slide 页码" className="mb-5 flex flex-wrap gap-2">{slides.map((s,i)=><button key={s.slide_id} type="button" aria-label={`第 ${i+1} 页：${s.title}`} aria-current={index===i?"page":undefined} onClick={()=>setIndex(i)} className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-semibold ${index===i?"border-[#244F67] bg-[#244F67] text-white":"border-[#C4D5DF] bg-white text-[#5C7A8D]"}`}>{String(i+1).padStart(2,"0")}</button>)}</nav>
    <article className="rounded-2xl border border-[#CBD9E1] bg-[#FFFEFB] px-5 py-7 shadow-sm sm:px-8"><div className="mb-4 flex justify-between gap-4 text-xs font-semibold text-[#648495]"><span>M81 / {String(index+1).padStart(2,"0")} · 本次重做</span><span>{index===7?"动态坐标实验":index===8?"计算 → 检验 → 证据卡":"精确教学视觉"}</span></div><h2 className="mb-4 text-2xl font-bold leading-relaxed">{slide.title}</h2><SlideBody key={slide.slide_id} slide={slide} ideaMap={new Map()} renderedSections={{}} projectName="molecule-monster-hunter" knodeDir="knodes/M81-w0-module" /><details className="mt-4 border-t border-[#D8E2E8] pt-4 text-sm text-[#66808F]"><summary className="cursor-pointer">查看本页讲稿（新版暂未配音）</summary><p className="mt-3 leading-7">{slide.audio_script}</p></details></article>
    <footer className="mt-5 flex items-center justify-between"><button type="button" disabled={index===0} onClick={()=>setIndex(i=>i-1)} className="rounded-lg border border-[#BBD0DD] bg-white px-5 py-2.5 text-sm disabled:opacity-30">← 上一页</button><span className="text-sm text-[#708897]">{index+1} / {slides.length}</span><button type="button" disabled={index===slides.length-1} onClick={()=>setIndex(i=>i+1)} className="rounded-lg bg-[#244F67] px-5 py-2.5 text-sm text-white disabled:opacity-30">下一页 →</button></footer><p className="mt-6 text-xs leading-6 text-[#748B98]">来源：本节点原作业 A–E 五条数据。原表未注明物理单位与测量来源，本次不将它们包装成真实模型成绩。<a href="https://scikit-learn.org/stable/modules/model_evaluation.html#regression-metrics" target="_blank" rel="noreferrer" className="ml-1 underline">指标定义参考</a></p>
  </div></main>
}
