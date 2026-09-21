import type { Locale } from "@/lib/i18n/locales"
import { discoveryLevel, type DiscoveryEntry } from "@/lib/library-discovery"
import { DiscoveryProjectCard } from "./discovery-project-card"
import { PROJECT_LEVELS } from "@/lib/project-lines/levels"
import styles from "./discovery.module.css"

const LEVELS = PROJECT_LEVELS.map(item => ({ rank: item.level - 1, title: [String(item.level).padStart(2, "0") + " · " + item.title.zh, item.title.en], hint: [item.hint.zh, item.hint.en] }))
export function DifficultyProjectList({ entries, locale, pulled }: { entries: DiscoveryEntry[]; locale: Locale; pulled: Set<string> }) {
  const language = locale === "zh" ? 0 : 1
  return <div className={styles.levelList}>{LEVELS.map(level => {
    const group = entries.filter(entry => discoveryLevel(entry) === level.rank)
    return group.length > 0 && <section className={styles.levelSection} key={level.rank} data-difficulty-group={level.rank} aria-labelledby={`level-${level.rank}`}>
      <header className={styles.levelHeader}><div><h3 id={`level-${level.rank}`}>{level.title[language]}</h3><p>{level.hint[language]}</p></div><span>{group.length} {locale === "zh" ? "个项目" : "projects"}</span></header>
      <div className={styles.projectGrid}>{group.map(entry => <DiscoveryProjectCard key={entry.id} entry={entry} pulled={pulled.has(entry.id)} />)}</div>
    </section>
  })}</div>
}
