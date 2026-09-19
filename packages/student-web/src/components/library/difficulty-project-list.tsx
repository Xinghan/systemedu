import type { Locale } from "@/lib/i18n/locales"
import { discoveryLevel, type DiscoveryEntry } from "@/lib/library-discovery"
import { DiscoveryProjectCard } from "./discovery-project-card"
import styles from "./discovery.module.css"

const LEVELS = [
  { rank: 0, title: ["轻松开始", "An easy start"], hint: ["3 分钟体验 · 打开就能操作，留下第一件作品", "3-minute experiences · Try something and keep your first creation"] },
  { rank: 1, title: ["跟着引导，做一件作品", "Make a guided creation"], hint: ["15 分钟小项目 · 修改、比较，再验证自己的想法", "15-minute projects · Change, compare and test your ideas"] },
  { rank: 3, title: ["进入完整项目", "Begin a full project"], hint: ["工程深度 1–2 / 5 · 按课程准备材料与工具", "Project depth 1–2 / 5 · Prepare the materials and tools"] },
  { rank: 4, title: ["多走一步，串起一个系统", "Connect a working system"], hint: ["工程深度 3 / 5 · 数据、工具与实际验证", "Project depth 3 / 5 · Data, tools and real tests"] },
  { rank: 5, title: ["挑战复杂工程", "Take on complex engineering"], hint: ["工程深度 4 / 5 · 多个模块一起工作", "Project depth 4 / 5 · Make multiple modules work together"] },
  { rank: 6, title: ["深入前沿研究", "Explore frontier research"], hint: ["工程深度 5 / 5 · 训练、评估与独立研究", "Project depth 5 / 5 · Training, evaluation and independent research"] },
  { rank: 7, title: ["更多完整项目", "More full projects"], hint: ["工程深度待标注 · 先查看具体要求", "Depth not yet specified · Check the project requirements"] },
]
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
