"use client"
import { useState } from "react"
import type { SlideEntry } from "@/lib/types/api"
import { LessonSlideCarousel, LessonSlidesProvider, LessonSlideshowButton } from "./lesson-slides"

export function RankingSlidePreview({ slides }: { slides: SlideEntry[] }) {
  const [index,setIndex] = useState(0)
  return <LessonSlidesProvider slides={slides} projectName="molecule-monster-hunter" moduleId="M87" knodeDir="knodes/M87-w0-top10" title="M87 · 加权综合排名 Top10" currentIndex={index} onIndexChange={setIndex}>
    <main className="min-h-screen bg-[var(--paper)] px-4 py-6 text-[var(--ink)] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 border-b border-[var(--border-2)] pb-5">
          <p className="text-xs font-semibold tracking-wider text-[var(--primary-ink)]">分子猎人 · 本批新增 M87 · 10 页全部重做</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">从筛选幸存者，到一份可解释的 Top10</h1><LessonSlideshowButton /></div>
          <p className="mt-3 text-sm text-[var(--sub)]">ranking-v1 · 公式、动态过程与可下载的排名证据。沿用刚确认的单页播放器与放大浮窗；本地预览，未部署、未配音。</p>
        </header>
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="M87 新版页码">{slides.map((slide,i)=><button type="button" key={slide.slide_id} aria-label={`第 ${i+1} 页：${slide.title}`} aria-current={index===i?"page":undefined} onClick={()=>setIndex(i)} className={`min-w-10 rounded-lg border px-3 py-2 text-sm ${index===i?"border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-ink)]":"border-[var(--border-2)] bg-[var(--card)]"}`}>{String(i+1).padStart(2,"0")}</button>)}</nav>
        <nav className="mb-5 flex flex-wrap gap-3 text-xs text-[var(--primary-ink)]" aria-label="重点效果"><button type="button" onClick={()=>setIndex(3)} className="underline">04 归一化动态</button><button type="button" onClick={()=>setIndex(4)} className="underline">05 总分逐项累加</button><button type="button" onClick={()=>setIndex(5)} className="underline">06 换单位反例</button><button type="button" onClick={()=>setIndex(6)} className="underline">07 权重实验与个人成果</button></nav>
        <LessonSlideCarousel />
        <footer className="mt-6 text-xs leading-6 text-[var(--sub)]">本批是原 M87 的逐页替换草稿，保留来源对应关系；原课程与生产环境未修改。<a href="/slide-preview/molecule-spatial" className="ml-2 underline">上一批 M03 / M86</a> · <a href="/slide-preview/lesson-reading#lesson-player" className="underline">合并阅读预览</a></footer>
      </div>
    </main>
  </LessonSlidesProvider>
}
