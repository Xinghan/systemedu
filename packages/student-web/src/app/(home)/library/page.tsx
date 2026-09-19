"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { ArrowRight, ArrowUpRight, Camera, Layers3, LayoutGrid, Orbit, Plus, Route, Search, SlidersHorizontal, Telescope, X } from "lucide-react"
import { library, myProjects, type LibraryProjectSummary } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useLocale } from "@/lib/i18n/use-t"
import { makeDiscoveryEntries, sortDiscoveryEntries } from "@/lib/library-discovery"
import { PROJECT_LINES, LINES_HREF, SPACE_LINE, localized, type DiscoveryKind } from "@/lib/project-lines/catalog"
import { ApplyProjectModal } from "@/components/layout/apply-project-modal"
import { DifficultyProjectList } from "@/components/library/difficulty-project-list"
import { ProjectLineDetail } from "@/components/library/project-line-detail"
import { ProjectLineView } from "@/components/library/project-line-view"
import { DISCOVERY_COPY } from "@/components/library/discovery-copy"
import styles from "@/components/library/discovery.module.css"

const KINDS: DiscoveryKind[] = ["all", "micro", "guided", "integration", "full"]
const KIND_ICONS = { all: Orbit, micro: Telescope, guided: Camera, integration: Layers3, full: Orbit }

export default function LibraryListPage() {
  return <Suspense fallback={<main className={styles.page} aria-busy="true"><div className={styles.loading}><span /></div></main>}><LibraryBrowser /></Suspense>
}

function LibraryBrowser() {
  const locale = useLocale()
  const c = DISCOVERY_COPY[locale]
  const searchParams = useSearchParams()
  const showLines = searchParams.get("view") === "lines"
  const lineId = showLines ? searchParams.get("line") : null
  const selectedLine = PROJECT_LINES.find(line => line.id === lineId)
  const { loggedIn, hydrate } = useAuthStore()
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [pulled, setPulled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [kind, setKind] = useState<DiscoveryKind>("all")
  const [query, setQuery] = useState("")
  const [domain, setDomain] = useState("all")
  const [difficulty, setDifficulty] = useState("all")
  const [sort, setSort] = useState("difficulty")
  const [lineFilter, setLineFilter] = useState("all")
  const [showPlanned, setShowPlanned] = useState(true)
  const [applyOpen, setApplyOpen] = useState(false)

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    let active = true
    library.listProjects().then(all => {
      if (active) { setProjects(all); setLoadFailed(false) }
    }).catch(() => { if (active) setLoadFailed(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  useEffect(() => {
    if (!loggedIn) return
    let active = true
    myProjects.list().then(mine => { if (active) setPulled(new Set(mine.map(item => item.slug))) }).catch(() => {})
    return () => { active = false }
  }, [loggedIn])

  const entries = useMemo(() => makeDiscoveryEntries(projects, locale), [projects, locale])
  const availableCount = entries.filter(entry => entry.available).length
  const listed = entries.filter(entry => showPlanned || entry.available)
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const result = entries.filter(entry => {
      if (!showPlanned && !entry.available) return false
      if (kind !== "all" && kind !== entry.kind) return false
      if (lineFilter !== "all" && entry.lineId !== lineFilter) return false
      if (domain !== "all" && domain !== entry.domain) return false
      if (difficulty === "light" && entry.kind !== "micro") return false
      if (difficulty === "guided" && entry.kind !== "guided") return false
      if (difficulty === "1-2" && (entry.difficulty == null || entry.difficulty > 2)) return false
      if (difficulty === "3" && entry.difficulty !== 3) return false
      if (difficulty === "4-5" && (entry.difficulty == null || entry.difficulty < 4)) return false
      const domainName = c.domainNames[entry.domain as keyof typeof c.domainNames] || ""
      return terms.every(term => `${entry.searchText} ${domainName.toLowerCase()}`.includes(term))
    })
    return sortDiscoveryEntries(result, sort, locale)
  }, [entries, query, showPlanned, kind, domain, difficulty, sort, c, locale, lineFilter])

  const hasFilters = kind !== "all" || query !== "" || domain !== "all" || difficulty !== "all" || lineFilter !== "all" || !showPlanned || sort !== "difficulty"
  function reset() { setKind("all"); setQuery(""); setDomain("all"); setDifficulty("all"); setLineFilter("all"); setSort("difficulty"); setShowPlanned(true) }
  function retry() { setLoading(true); setLoadFailed(false); setReload(value => value + 1) }

  return (
    <main className={styles.page} data-locale={locale}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>{c.eyebrow}</p><div className={styles.titleRow}><h1>{c.title}</h1><p>{c.intro}</p></div></div>
        <span className={styles.libraryCount}><i />{showLines ? <><b>{PROJECT_LINES.length}</b> {c.lineCount}</> : loading ? c.loading : <><b>{availableCount}</b> {c.libraryCount}</>}</span>
      </header>
      <div className={styles.viewBar}>
        <nav className={styles.viewSwitch} aria-label={c.viewLabel}>
          <Link href="/library" scroll={false} aria-current={!showLines ? "page" : undefined}><LayoutGrid size={16} aria-hidden="true" />{c.projectsView}</Link>
          <Link href={LINES_HREF} scroll={false} aria-current={showLines ? "page" : undefined}><Route size={16} aria-hidden="true" />{c.linesView}</Link>
        </nav>
        <p>{showLines ? c.linesHint : c.projectsHint}</p>
      </div>
      {loadFailed && <div className={styles.error} role="alert"><p>{c.error}</p><button type="button" onClick={retry}>{c.retry}<ArrowRight size={14} /></button></div>}
      {showLines ? selectedLine ? <ProjectLineDetail line={selectedLine} locale={locale} entries={entries} pulled={loggedIn ? pulled : new Set()} />
        : lineId ? <div className={styles.emptyState}><h2>{locale === "zh" ? "这条项目线暂未收录" : "This project line is not available"}</h2><Link href={LINES_HREF}>{locale === "zh" ? "返回所有项目线" : "Back to all project lines"}<ArrowRight size={15} /></Link></div>
        : <ProjectLineView locale={locale} entries={entries} loading={loading} /> : <>
      <section className={styles.discovery} aria-labelledby="discovery-title">
        <div className={styles.discoveryHeading}><div><h2 id="discovery-title">{c.discover}</h2><p>{c.discoverHint}</p></div><SlidersHorizontal size={19} strokeWidth={1.3} aria-hidden="true" /></div>
        <div className={styles.kindTabs} role="group" aria-label={locale === "zh" ? "项目类型" : "Project type"}>
          {KINDS.map(value => {
            const Icon = KIND_ICONS[value]
            const count = listed.filter(entry => value === "all" || entry.kind === value).length
            return <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={styles.kindTab} data-kind-filter={value}><div><Icon size={17} strokeWidth={1.5} /><strong>{c.kinds[value]}</strong><span>{(value === "guided" || value === "integration") && count === 0 ? c.planning : count}</span></div><small>{c.kindHints[value]}</small></button>
          })}
        </div>
        <div className={styles.filterBar}>
          <label className={styles.search}><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={c.search} aria-label={c.search} />{query && <button type="button" onClick={() => setQuery("")} aria-label={locale === "zh" ? "清空搜索" : "Clear search"}><X size={14} /></button>}</label>
          <label className={styles.select}><span>{locale === "zh" ? "项目线" : "Project line"}</span><select value={lineFilter} onChange={event => setLineFilter(event.target.value)} aria-label={locale === "zh" ? "项目线筛选" : "Project line filter"}><option value="all">{locale === "zh" ? "所有项目线" : "All project lines"}</option>{PROJECT_LINES.map(line => <option key={line.id} value={line.id}>{localized(line.title, locale)}</option>)}</select></label>
          <label className={styles.select}><span>{c.domain}</span><select value={domain} onChange={event => setDomain(event.target.value)} aria-label={c.domain}><option value="all">{c.allDomains}</option>{Object.entries(c.domainNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={styles.select}><span>{c.difficulty}</span><select value={difficulty} onChange={event => setDifficulty(event.target.value)} aria-label={c.difficulty}><option value="all">{c.allChallenges}</option><option value="light">{c.light}</option><option value="guided">{c.guidedChallenge}</option><option value="1-2">{c.score12}</option><option value="3">{c.score3}</option><option value="4-5">{c.score45}</option></select></label>
        </div>
        <div className={styles.resultBar}><p role="status" aria-live="polite"><b>{filtered.length}</b> {c.result}{hasFilters && <button type="button" onClick={reset}>{c.reset}</button>}</p><div><label className={styles.plannedToggle}><input type="checkbox" checked={showPlanned} onChange={event => setShowPlanned(event.target.checked)} />{c.showPlanned}</label><select value={sort} onChange={event => setSort(event.target.value)} aria-label={c.sort}><option value="difficulty">{c.difficultyAsc}</option><option value="recent">{c.recent}</option></select></div></div>
        {loading && <div className={styles.loading} role="status"><span />{c.loading}</div>}
        {filtered.length > 0 ? <DifficultyProjectList entries={filtered} locale={locale} pulled={loggedIn ? pulled : new Set()} />
          : !loading && <div className={styles.emptyState}><Search size={25} strokeWidth={1.2} /><h3>{kind === "integration" ? (locale === "zh" ? "组装项目正在筹备中" : "Assembly projects are in preparation") : c.emptyTitle}</h3><p>{kind === "integration" ? (locale === "zh" ? "进入各条主题线，可以查看将来如何组合自己的作品。" : "Explore the project lines to see how your creations will fit together.") : c.emptyBody}</p>{kind === "integration" && <Link href={LINES_HREF}>{c.viewLine}<ArrowRight size={15} /></Link>}<button type="button" onClick={reset}>{c.reset}<ArrowRight size={15} /></button></div>}
        <p className={styles.timeNote}>{c.timeNote}</p>
      </section>
      </>}
      {!showLines && <aside className={styles.familyNote}><span className={styles.familyMark}><Telescope size={23} strokeWidth={1.3} /></span><div><strong>{c.familyTitle}</strong><p>{c.familyBody}</p></div><Link href={SPACE_LINE.firstProjectHref}>{c.start}<ArrowUpRight size={15} /></Link></aside>}
      <section className={styles.request}><div><h2>{c.requestTitle}</h2><p>{c.requestBody}</p></div><button type="button" onClick={() => setApplyOpen(true)}><Plus size={15} />{c.requestAction}</button></section>
      <ApplyProjectModal open={applyOpen} onClose={() => setApplyOpen(false)} />
    </main>
  )
}
