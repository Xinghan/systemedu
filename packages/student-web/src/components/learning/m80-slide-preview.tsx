"use client"

import { useState } from "react"
import type { SlideEntry } from "@/lib/types/api"
import { SlideBody } from "./teacher-scene-view"

export function M80SlidePreview({ slides }: { slides: SlideEntry[] }) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  return <main className="min-h-screen bg-[#f0f3f1] px-5 py-8 text-[#183748] sm:px-10">
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-[#c9d6d6] pb-6">
        <div><p className="mb-2 text-xs font-semibold tracking-[.16em] text-[#548077]">分子怪兽猎人 / 教学视觉修复</p><h1 className="text-3xl font-bold tracking-tight">M80 · 不平衡分类的证据实验台</h1><p className="mt-3 text-sm text-[#617983]">本批仅此节点 · 10 页全部新版 · 使用真实播放器组件 · 本地预览，尚未部署</p></div>
        <span className="rounded-full border border-[#bbd3c8] bg-[#e2f0e8] px-4 py-2 text-xs font-semibold text-[#33705a]">EVIDENCE v1 · 2026-09-08</span>
      </header>
      <nav aria-label="新版 slide 页码" className="mb-5 flex flex-wrap gap-2">
        {slides.map((s, i) => <button key={s.slide_id} type="button" aria-label={`第 ${i + 1} 页：${s.title}`} aria-current={index === i ? "page" : undefined} onClick={() => setIndex(i)} className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-semibold ${index === i ? "border-[#214d5b] bg-[#214d5b] text-white" : "border-[#c5d5d8] bg-white text-[#587480]"}`}>{String(i + 1).padStart(2, "0")}</button>)}
      </nav>
      <article className="rounded-2xl border border-[#ccd8d7] bg-[#fffefa] px-5 py-7 shadow-sm sm:px-8">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold text-[#547c73]"><span>M80 / {String(index + 1).padStart(2, "0")} · 本次重做</span><span>{slide.kind === "animation" ? "四步动态演示" : slide.kind === "game" ? "可操作实验" : "精确 HTML / 数学排版"}</span></div>
        <h2 className="mb-4 text-2xl font-bold leading-relaxed">{slide.title}</h2>
        <SlideBody key={slide.slide_id} slide={slide} ideaMap={new Map()} renderedSections={{}} projectName="molecule-monster-hunter" knodeDir="knodes/M80-w0-module" />
        <details className="mt-4 border-t border-[#d8e1dd] pt-4 text-sm text-[#5c727a]"><summary className="cursor-pointer">查看本页修订讲稿（旧录音未沿用）</summary><p className="mt-3 leading-7">{slide.audio_script}</p></details>
      </article>
      <footer className="mt-5 flex items-center justify-between"><button type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)} className="rounded-lg border border-[#b9cfd4] bg-white px-5 py-2.5 text-sm disabled:opacity-30">← 上一页</button><span className="text-sm text-[#687f88]">{index + 1} / {slides.length}</span><button type="button" disabled={index === slides.length - 1} onClick={() => setIndex(i => i + 1)} className="rounded-lg bg-[#214d5b] px-5 py-2.5 text-sm text-white disabled:opacity-30">下一页 →</button></footer>
      <p className="mt-7 text-xs leading-6 text-[#768a90]">修订重点：TP 2、FP 1 的准确率应为 98%；不再虚构真实模型 AUC=0.8，也不再声称“只认 AUC”。依据 <a className="underline" href="https://scikit-learn.org/stable/modules/model_evaluation.html#classification-metrics" target="_blank" rel="noreferrer">scikit-learn 指标定义</a>核对。</p>
    </div>
  </main>
}
