"use client"

import Link from 'next/link'
import { useState } from 'react'
import type { CourseIdeaSummary, RenderedSection, SlideEntry } from '@/lib/types/api'
import { SlideDeckPlayer } from './teacher-scene-view'
import numbering from '@/lib/data/molecule-numbering-v2.json'

export function NumberedCoursePreview({moduleId,title,knodeDir,slides,images,audio,ideas,renderedSections}:{moduleId:string;title:string;knodeDir:string;slides:SlideEntry[];images:Record<string,string>;audio:Record<string,string>;ideas:CourseIdeaSummary[];renderedSections:Record<string,RenderedSection>}) {
  const [index,setIndex]=useState(0)
  const n=numbering.modules.findIndex(m=>m.new===moduleId)
  const base='/slide-preview/molecule-v2/'
  return <main className="min-h-screen bg-[var(--paper)] p-5 text-[var(--ink)]">
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-[var(--primary-ink)]">分子猎人 · 连续编号预览 · {n+1} / 47 · 编号已上线{moduleId==='M05'?` · 本批新改版 ${slides.length} 页 / 本地待部署`:['M01','M02','M03','M04','M08'].includes(moduleId)?` · 只读改版 ${slides.length} 页 / 已部署`:''}</p>
      <h1 className="my-3 text-2xl font-semibold">{moduleId} · {title}</h1>
      <p className="mb-4 text-sm text-[var(--sub)]">本批 M05：9 页只读改版，第 4 页真实 3D 自动显示隐式氢，第 7 页自动读取 SMILES；其余为精确结构、对照与参考代码。本批无新增图片、暂未配音，本地待部署。M04 九页已于 9 月 15 日上线；下一节按顺序改 M06。</p>
      <nav aria-label="全部 47 节课程" className="mb-5 flex flex-wrap gap-2">
        {numbering.modules.map(m=><Link key={m.new} href={base+m.new} title={m.title} aria-current={m.new===moduleId?'page':undefined} className={'rounded border px-2 py-1 text-xs '+(m.new===moduleId?'bg-[var(--primary)] text-white':'bg-[var(--paper-2)]')}>{m.new}</Link>)}
      </nav>
      <nav aria-label="当前节点幻灯片" className="mb-4 flex flex-wrap gap-2">
        {slides.map((s,i)=><button key={s.slide_id} onClick={()=>setIndex(i)} aria-current={i===index?'page':undefined} className="rounded border px-3 py-2 text-sm">{i+1} · {s.title}</button>)}
      </nav>
      <section className="overflow-hidden rounded-2xl border bg-[var(--paper)]">
        <SlideDeckPlayer deck={{slides,ideas,renderedSections,knodeDir}} projectName="molecule-monster-hunter" moduleId={moduleId} currentIndex={index} onIndexChange={setIndex} autoPlay={false} layout="content" previewImageSources={images} previewAudioSources={audio}/>
      </section>
      <nav aria-label="按编号顺序学习" className="my-5 flex justify-between text-sm">
        {n>0?<Link href={base+numbering.modules[n-1].new}>← {numbering.modules[n-1].new} 上一节</Link>:<span/>}
        {n<46?<Link href={base+numbering.modules[n+1].new}>{numbering.modules[n+1].new} 下一节 →</Link>:<span>全课程共 47 节</span>}
      </nav>
    </div>
  </main>
}
