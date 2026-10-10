"use client"
import { useState } from "react"
import type { SlideEntry } from "@/lib/types/api"
import { LessonSlidesProvider, LessonSlideCarousel, LessonSlideshowButton } from "./lesson-slides"

export function DiversityBatchPreview({decks}:{decks:{module:string;node:string;slides:SlideEntry[]}[]}) {
  const [deck,setDeck]=useState(0)
  const [width,setWidth]=useState("1152")
  return <main className="min-h-screen bg-[var(--paper)] px-5 py-6 text-[var(--ink)]"><div className="mx-auto" style={{maxWidth:Number(width)}}><p className="text-xs text-[var(--primary-ink)]">分子猎人 · 本批新作 M88 / M89 · 22 页</p><h1 className="my-3 text-2xl font-semibold">从结构多样性，到逐条可复核的筛选理由</h1><label className="mb-4 flex items-center gap-3 text-sm">预览内容宽度<select aria-label="预览内容宽度" value={width} onChange={e=>setWidth(e.target.value)} className="rounded border bg-[var(--paper)] p-2">{[480,720,960,1152].map(w=><option key={w} value={w}>{w} px</option>)}</select><span className="text-[var(--sub)]">仅用于布局验收</span></label><nav className="mb-5 flex gap-3">{decks.map((d,i)=><button type="button" key={d.module} onClick={()=>setDeck(i)} aria-pressed={i===deck} className="rounded-lg border px-4 py-2">{d.module} · {i===0 ? "多样性选择" : "拒绝理由"}</button>)}</nav><Deck key={deck} {...decks[deck]}/></div></main>
}
function Deck({module,node,slides}:{module:string;node:string;slides:SlideEntry[]}) {
  const [index,setIndex]=useState(0)
  return <LessonSlidesProvider slides={slides} projectName="molecule-monster-hunter" moduleId={module} knodeDir={`knodes/${node}`} title={`${module} 新版老师讲课`} currentIndex={index} onIndexChange={setIndex}><div className="mb-4 flex items-center justify-between gap-4"><nav className="flex flex-wrap gap-2" aria-label="新版页码">{slides.map((s,i)=><button type="button" key={s.slide_id} aria-label={`第 ${i+1} 页：${s.title}`} aria-current={index===i?"page":undefined} className="rounded border px-3 py-2 text-sm" onClick={()=>setIndex(i)}>{String(i+1).padStart(2,"0")}</button>)}</nav><LessonSlideshowButton/></div><LessonSlideCarousel/><p className="mt-5 text-xs text-[var(--sub)]">版本：diversity-rejection-v1。新讲稿暂未配音，旧音频未沿用。公式与结构精确绘制，互动结果可复算。</p></LessonSlidesProvider>
}
