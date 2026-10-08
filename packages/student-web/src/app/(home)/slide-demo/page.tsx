"use client"

/**
 * 方案 B v2 (图鉴引线式) — AI 图 + 图注边距 + 细引线标注, 融为一张科学图鉴。
 *
 * 与 v1(白气泡浮层) 的区别: 图不铺满, 而是在暖纸卡片里居中留出四周边距;
 * 标注文字排在边距, 细引线从文字精准指向图中物体锚点; 文字与图共享同一张
 * 暖纸底/同一套字体/同一种笔触 —— 是一张完整插画, 不是"图+浮层"。
 *
 * 坐标系: anchor(ax,ay) = 图中物体位置(相对图片 %); label(lx,ly) = 文字落点(相对整块画布 %)。
 * 引线 = 从 label 边缘拐一个直角到 anchor。SVG 覆盖层画线, HTML 层排字。
 */

import { useState, useRef, useLayoutEffect } from "react"

type Lang = "zh" | "en"

interface Anno {
  zh: string
  en: string
  ax: number; ay: number  // 锚点(图中物体), 相对【图片】%
  side: "top" | "bottom" | "left" | "right"  // 标签在图的哪一侧边距
  lp: number  // 标签沿该侧的位置 %(top/bottom=横向, left/right=纵向)
  accent?: boolean
}

interface DemoImage {
  id: string
  file: string
  titleZh: string; titleEn: string
  captionZh: string; captionEn: string
  pad: { t: number; r: number; b: number; l: number }  // 图在卡片内的四周边距 %
  annos: Anno[]
}

const IMAGES: DemoImage[] = [
  {
    id: "scale",
    file: "bullet_micron_scale.img_1.png",
    titleZh: "2.5 微米有多小", titleEn: "How small is 2.5 micron",
    captionZh: "从头发丝到 PM2.5,一路缩小 30 倍", captionEn: "From a hair to PM2.5, 30x smaller",
    pad: { t: 30, r: 4, b: 4, l: 4 },  // 图内上方大片留白 → 标签全排在顶部边距
    annos: [
      { zh: "头发丝 70μm", en: "Hair · 70μm", ax: 21, ay: 58, side: "top", lp: 21 },
      { zh: "可见灰尘 30μm", en: "Dust · 30μm", ax: 41, ay: 55, side: "top", lp: 41 },
      { zh: "红血球 7μm", en: "Red cell · 7μm", ax: 63, ay: 60, side: "top", lp: 63 },
      { zh: "PM10 · 10μm", en: "PM10 · 10μm", ax: 82, ay: 60, side: "top", lp: 82 },
      { zh: "PM2.5 · 2.5μm", en: "PM2.5 · 2.5μm", ax: 96, ay: 64, side: "top", lp: 96, accent: true },
    ],
  },
  {
    id: "lung1",
    file: "theory_theory_lung_deposition.img_1.png",
    titleZh: "呼吸道三层结构", titleEn: "Three zones of the airway",
    captionZh: "颗粒越小,走得越深", captionEn: "The smaller the particle, the deeper it goes",
    pad: { t: 6, r: 34, b: 6, l: 6 },  // 图形居中偏窄 → 标签排右侧边距
    annos: [
      { zh: "鼻腔 ET 区", en: "Nasal (ET)", ax: 48, ay: 17, side: "right", lp: 16 },
      { zh: "气管 · 支气管 TB 区", en: "Bronchi (TB)", ax: 52, ay: 50, side: "right", lp: 50 },
      { zh: "肺泡 AI 区 · 3 亿个", en: "Alveoli (AI) · 300M", ax: 50, ay: 84, side: "right", lp: 84, accent: true },
    ],
  },
  {
    id: "lung2",
    file: "theory_theory_lung_deposition.img_2.png",
    titleZh: "PM10 vs PM2.5 沉积对比", titleEn: "PM10 vs PM2.5 deposition",
    captionZh: "大颗粒卡在上层,PM2.5 直达肺泡进血液", captionEn: "Big particles stop high; PM2.5 reaches the blood",
    pad: { t: 24, r: 6, b: 6, l: 6 },  // 上方留白 → 两个主标签排顶部
    annos: [
      { zh: "PM10 大多卡在鼻腔", en: "PM10 caught in the nose", ax: 34, ay: 20, side: "top", lp: 20 },
      { zh: "PM2.5 深入肺泡", en: "PM2.5 reaches the alveoli", ax: 66, ay: 22, side: "top", lp: 74, accent: true },
    ],
  },
]

const IMG_RATIO = 16 / 9  // 图片本身宽高比

function Plate({ img, lang }: { img: DemoImage; lang: Lang }) {
  const [hover, setHover] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
  // 顶/底标签防重叠后的横向落点(卡片 %); null 前用锚点位置兜底
  const [lxByIdx, setLxByIdx] = useState<Record<number, number>>({})

  // 图在卡片内的盒子(百分比 → 卡片坐标)
  const ib = { x: img.pad.l, y: img.pad.t, w: 100 - img.pad.l - img.pad.r, h: 100 - img.pad.t - img.pad.b }
  const imgHpctOfCard = (ib.w / IMG_RATIO)          // 图高相对卡片宽的百分比
  const cardHpct = imgHpctOfCard / (ib.h / 100)      // 卡片高相对卡片宽的百分比
  const anchorPct = (a: Anno) => ({ x: ib.x + ib.w * a.ax / 100, y: ib.y + ib.h * a.ay / 100 })

  // 顶/底标签一维防重叠: 理想位=物体正上方, 实测标签宽 → 从左到右推挤, 两端夹在卡片内。
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const cw = card.clientWidth
    if (!cw) return
    const gap = 1.4 // 标签间最小间隙(卡片 %)
    const edge = 1.5 // 距卡片左右边最小留白 %

    const topIdx = img.annos.map((a, i) => ({ a, i })).filter(({ a }) => a.side === "top" || a.side === "bottom")
    // 每个标签的半宽(卡片 %)
    const items = topIdx.map(({ a, i }) => {
      const el = labelRefs.current[i]
      const halfPct = el ? (el.offsetWidth / cw) * 100 / 2 : 4
      return { i, ideal: anchorPct(a).x, half: halfPct }
    }).sort((p, q) => p.ideal - q.ideal)

    // 从左到右: 每个不早于 上一个右缘+gap+half, 且不越左边
    let cursor = -Infinity
    for (const it of items) {
      const minCenter = cursor + gap + it.half
      let c = Math.max(it.ideal, minCenter, edge + it.half)
      c = Math.min(c, 100 - edge - it.half) // 不越右边
      ;(it as { c: number }).c = c
      cursor = c + it.half
    }
    // 若最右超界, 从右到左回推(整体左移)
    const last = items[items.length - 1] as (typeof items[number] & { c: number }) | undefined
    if (last && last.c + last.half > 100 - edge) {
      let rc = 100 - edge
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k] as typeof items[number] & { c: number }
        it.c = Math.min(it.c, rc - it.half)
        rc = it.c - it.half - gap
      }
    }
    const next: Record<number, number> = {}
    for (const it of items) next[it.i] = (it as { c: number }).c
    setLxByIdx((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [img, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {lang === "zh" ? img.titleZh : img.titleEn}
        </div>
        <div style={{ fontSize: 13, color: "var(--sub)", marginTop: 2 }}>
          {lang === "zh" ? img.captionZh : img.captionEn}
        </div>
      </div>

      {/* 图鉴底板: 暖纸卡片, 图居中留边距, SVG 引线 + HTML 标签共处一层 */}
      <div
        ref={cardRef}
        style={{
          position: "relative", width: "100%",
          aspectRatio: `100 / ${cardHpct.toFixed(2)}`,
          background: "var(--paper)", border: "1px solid var(--border)",
          borderRadius: 16, boxShadow: "var(--shadow)", overflow: "hidden",
        }}
      >
        {/* 图片(居中留边距) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/slide-demo/${img.file}`}
          alt=""
          style={{
            position: "absolute",
            left: `${ib.x}%`, top: `${ib.y}%`, width: `${ib.w}%`,
            borderRadius: 8, display: "block",
            boxShadow: "0 1px 0 rgba(0,0,0,.04)",
          }}
        />

        {/* 引线层 (SVG, 全卡片坐标 0-100) */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {img.annos.map((a, i) => {
            const an = anchorPct(a)
            const horiz = a.side === "top" || a.side === "bottom"
            // 标签防重叠后的横向位置(顶/底); 未测量前用锚点 x 兜底
            const lx = lxByIdx[i] ?? an.x
            // 引线: 标签处斜/直落到物体。顶/底 = 从(lx, 图注带y)到(物体)；
            //       左/右 = 从(图注带x, an.y)水平到物体。
            const start =
              a.side === "top" ? { x: lx, y: img.pad.t * 0.62 }
              : a.side === "bottom" ? { x: lx, y: 100 - img.pad.b * 0.62 }
              : a.side === "left" ? { x: img.pad.l * 0.5, y: an.y }
              : { x: 100 - img.pad.r * 0.5, y: an.y }
            const active = hover === i
            const stroke = a.accent ? "#D97757" : "#9A917E"
            // 顶/底: 若标签被推离物体, 用两段折线(先竖下到物体高度上方, 再斜到物体)更自然;
            // 这里简单用直线(标签→物体), 视觉上是一条从文字指到物体的引线。
            void horiz
            return (
              <g key={i} opacity={active ? 1 : 0.85}>
                <line
                  x1={start.x} y1={start.y} x2={an.x} y2={an.y}
                  stroke={stroke} strokeWidth={active ? 0.5 : 0.32}
                  vectorEffect="non-scaling-stroke" strokeLinecap="round"
                />
                <circle cx={an.x} cy={an.y} r={active ? 1.1 : 0.8} fill={stroke} />
              </g>
            )
          })}
        </svg>

        {/* 标签层 (HTML)。顶/底标签横向位置来自防重叠布局(lxByIdx), 居中于该点、
            不重叠不越界; 左/右标签沿边距纵向排。 */}
        {img.annos.map((a, i) => {
          const active = hover === i
          const horiz = a.side === "top" || a.side === "bottom"
          const an = anchorPct(a)
          const y =
            a.side === "top" ? img.pad.t * 0.5
            : a.side === "bottom" ? 100 - img.pad.b * 0.5
            : an.y
          const x =
            a.side === "left" ? img.pad.l * 0.5
            : a.side === "right" ? 100 - img.pad.r * 0.5
            : (lxByIdx[i] ?? an.x)  // 顶/底: 防重叠位
          const pos: React.CSSProperties = horiz
            ? { left: `${x}%`, transform: "translate(-50%,-50%)" }        // 顶/底居中于防重叠位
            : a.side === "left"
              ? { left: `${x}%`, transform: "translate(-50%,-50%)" }
              : { left: `${x}%`, transform: "translate(-50%,-50%)" }
          return (
            <div
              key={i}
              ref={(el) => { labelRefs.current[i] = el }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                position: "absolute", top: `${y}%`, ...pos,
                fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, lineHeight: 1.25,
                letterSpacing: "0.01em", whiteSpace: "nowrap", cursor: "default",
                color: a.accent ? "#9A4A2E" : "var(--ink-2)",
                borderBottom: `1.5px solid ${a.accent ? "#D97757" : "var(--border-2)"}`,
                paddingBottom: 2,
                textShadow: "0 0 6px var(--paper), 0 0 6px var(--paper)",
                scale: active ? "1.05" : "1", transition: "scale .12s",
              }}
            >
              {lang === "zh" ? a.zh : a.en}
            </div>
          )
        })}
      </div>
    </figure>
  )
}

export default function SlideDemoPage() {
  const [lang, setLang] = useState<Lang>("zh")
  return (
    <main className="page-wide" style={{ maxWidth: 880 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>方案 B v2 · 图鉴引线式</h1>
          <p style={{ color: "var(--sub)", margin: "6px 0 0", fontSize: 14, maxWidth: "58ch" }}>
            图在暖纸底板上居中留出图注边距,标注文字排在边距、细引线精准指向物体。文字与图共享同一张纸、同一套字体 —— 一张完整的科学图鉴,不再是"图 + 浮层"。
          </p>
        </div>
        <div style={{ display: "inline-flex", border: "1px solid var(--border-2)", borderRadius: 999, padding: 2 }}>
          {(["zh", "en"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: "4px 12px", borderRadius: 999,
                border: "none", cursor: "pointer",
                background: lang === l ? "var(--primary-soft)" : "transparent",
                color: lang === l ? "var(--primary-ink)" : "var(--sub)",
              }}>
              {l === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 44, marginTop: 28 }}>
        {IMAGES.map((img) => <Plate key={img.id} img={img} lang={lang} />)}
      </div>
    </main>
  )
}
