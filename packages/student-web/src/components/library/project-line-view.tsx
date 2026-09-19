import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Locale } from "@/lib/i18n/locales"
import type { DiscoveryEntry } from "@/lib/library-discovery"
import { PROJECT_LINES, lineHref, localized } from "@/lib/project-lines/catalog"
import styles from "./project-line-view.module.css"

export function ProjectLineView({ locale, entries, loading }: { locale: Locale; entries: DiscoveryEntry[]; loading: boolean }) {
  return <section className={styles.lineView} aria-labelledby="lines-title">
    <header className={styles.intro}>
      <div><p className={styles.eyebrow}>{locale === "zh" ? "沿着好奇心，走进一个领域" : "FOLLOW A WORLD OF CURIOSITY"}</p><h2 id="lines-title">{locale === "zh" ? "选一个世界，开始你的探索。" : "Choose a world to explore."}</h2></div>
      <p>{locale === "zh" ? "每条项目线都从小发现开始，通向一件真正的大作品。先选主题，再看里面的项目。" : "Each line connects small discoveries to an ambitious creation. Pick a theme to see its projects."}</p>
    </header>
    <div className={styles.lineGrid}>
      {PROJECT_LINES.map((line, index) => {
        const ready = entries.filter(entry => entry.lineId === line.id && entry.available).length
        return <Link key={line.id} href={lineHref(line.id)} className={styles.lineCard} data-line-card={line.id}>
          <div className={styles.lineArt}><Image src={line.image} alt="" fill sizes="(max-width: 650px) 100vw, 50vw" className={styles.cover} /><span className={styles.lineNumber}>{String(index + 1).padStart(2, "0")} / {locale === "zh" ? "主题项目线" : "PROJECT LINE"}</span></div>
          <div className={styles.lineCopy}><p className={styles.domains}>{localized(line.domains, locale)}</p><h3>{localized(line.title, locale)}</h3><p className={styles.description}>{localized(line.description, locale)}</p>
            <div className={styles.lineFooter}><span>{loading ? (locale === "zh" ? "正在载入开放状态…" : "Loading availability…") : ready > 0 ? (locale === "zh" ? `${ready} 个项目可开始` : `${ready} projects ready`) : (locale === "zh" ? "路线已规划 · 起点筹备中" : "Route planned · Starting points in preparation")}</span><strong>{locale === "zh" ? "进入项目线" : "Explore this line"}<ArrowUpRight size={17} /></strong></div>
          </div>
        </Link>
      })}
    </div>
  </section>
}
