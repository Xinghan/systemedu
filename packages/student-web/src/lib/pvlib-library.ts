import type { Locale } from "@/lib/i18n/locales"
import type { DiscoveryEntry } from "@/lib/library-discovery"
import { PVLIB_SLUG } from "@/lib/pvlib-preview"

export type PvlibLibraryPreview = {
  title: string
  nodeCount: number
  firstModuleId: string
  coverHref: string | null
}

export function withPvlibLibraryPreview(entries: DiscoveryEntry[], preview: PvlibLibraryPreview | null, locale: Locale): DiscoveryEntry[] {
  if (!preview) return entries
  const titleEn = "Forecast the sunshine"
  const outcome = locale === "zh" ? "自己的 3D 打印低压光伏预测站、两日预测与实测对照、可复查的作品档案" : "A 3D-printed low-voltage solar forecasting station, two dated trials, and reproducible evidence"
  const entry: DiscoveryEntry = {
    id: PVLIB_SLUG, kind: "full", title: locale === "zh" ? preview.title : titleEn,
    domain: "energy", difficulty: 4, available: true, publishedAt: 0,
    lineId: "energy-motion", source: "local", preview: true,
    courseHref: `/preview/pvlib/${encodeURIComponent(preview.firstModuleId)}`,
    startLabel: locale === "zh" ? "进入课程" : "Start course",
    preparation: locale === "zh" ? "可先在浏览器学习；实物制作需要 3D 打印、低压器材及成人协助。" : "Start in the browser; fabrication requires 3D printing, low-voltage parts and adult support.",
    coverImage: preview.coverHref || undefined,
    project: { slug: PVLIB_SLUG, title: titleEn, title_zh: preview.title, status: "draft", domain: "Energy", difficulty: 4, knode_count: preview.nodeCount, final_outcomes: [{ title: outcome, kind: "capability", description: outcome }] },
    searchText: `${PVLIB_SLUG} ${preview.title} ${titleEn} pvlib 光伏 太阳能 发电预报 功率预测 动力发明家 能源与动力 solar power energy forecast 3D printing`.toLowerCase(),
  }
  // A local reviewed course is one entry even if the service also lists its draft.
  return [...entries.filter(item => item.id !== PVLIB_SLUG), entry]
}
