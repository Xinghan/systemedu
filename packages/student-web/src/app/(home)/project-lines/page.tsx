import Link from "next/link"
import { ArrowUpRight, Camera, Flag, Orbit, Rocket, Telescope } from "lucide-react"
import styles from "./project-lines.module.css"

const nextProjects = [
  { n: "02", title: "把探测器稳稳送下去", domain: "航天 · 控制", work: "一份自己的着陆记录", icon: Rocket },
  { n: "03", title: "开车找到观察点", domain: "机械 · 视觉", work: "一张地形照片和自己的路线", icon: Camera },
]

export default function ProjectLinesPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>PROJECT LINES / 01</p>
          <h1>太空探索。<br /><span>从一次小小的发现开始。</span></h1>
          <p className={styles.intro}>先留下自己的第一张星球照片，再一步步学会着陆、观察、造车。<br />把每次探索的作品，带进你的火星远征。</p>
          <div className={styles.tags}><span>零编程基础可开始</span><span>电脑 / 平板浏览器</span><span>作品可以下载</span></div>
        </div>
        <div className={styles.orbitArt} aria-hidden="true"><div className={styles.orbitRing} /><div className={styles.orbitRing2} /><div className={styles.planet} /><span className={styles.satellite} /><span className={styles.orbitLabel}>YOUR FIRST EXPEDITION</span><Telescope size={30} strokeWidth={1} /></div>
      </section>

      <section className={styles.launch} aria-labelledby="start-title">
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>第一站 / 先动手试试</p><h2 id="start-title">一个小项目，一件自己的作品。</h2></div><span className={styles.available}>首个项目已开放体验</span></div>
        <div className={styles.projectGrid}>
          <Link className={styles.featured} href="/explore/space-exploration/spot-a-world">
            <div className={styles.cardTop}><span>01 / 天文 · 空间观察</span><span>约 3 分钟</span></div>
            <div className={styles.preview} aria-hidden="true"><span className={styles.previewMoon} /><span className={styles.previewFrame} /><span className={styles.previewCaption}>月球已入镜 · 等你按下快门</span></div>
            <div className={styles.cardCopy}><h3>我的第一张星球照片</h3><p>移动镜头，拉近一个世界。<br />带走你亲手取景的照片和观测记录。</p><span className={styles.start}>打开观测台 <ArrowUpRight size={19} /></span></div>
          </Link>
          {nextProjects.map(({ n, title, domain, work, icon: Icon }) => (
            <article className={styles.planned} key={n}>
              <div className={styles.cardTop}><span>{n} / {domain}</span><span>筹备中</span></div>
              <Icon className={styles.plannedIcon} size={42} strokeWidth={1} />
              <div className={styles.cardCopy}><h3>{title}</h3><p>计划带走：{work}。</p><span className={styles.notYet}>独立入口 · 约 3 分钟的设计目标</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.journey} aria-labelledby="journey-title">
        <div><p className={styles.eyebrow}>远征路线 / 内容规划</p><h2 id="journey-title">小发现，慢慢拼成大远征。</h2><p>每一步都有作品。按兴趣探索，准备好了再挑战下一站。</p></div>
        <ol className={styles.journeySteps}>
          <li><Orbit size={23} strokeWidth={1.2} /><strong>短体验</strong><span>3 个独立入口</span><small>首个已可体验</small></li>
          <li><Telescope size={23} strokeWidth={1.2} /><strong>引导小项目</strong><span>5 个不同领域的任务</span><small>约 15 分钟 / 个 · 筹备中</small></li>
          <li><Rocket size={23} strokeWidth={1.2} /><strong>组装与验证</strong><span>让自己的作品一起运行</span><small>筹备中</small></li>
          <li><Flag size={23} strokeWidth={1.2} /><strong>终极宝藏 · 火星车</strong><span>进入完整工程项目</span><Link href="/library/mars-analog-rover">查看现有完整课程 ↗</Link></li>
        </ol>
      </section>

      <aside className={styles.parentNote}><strong>给第一次陪孩子来的你</strong><p>帮孩子打开观测台，再把操作交给孩子。无需安装软件或准备材料；卡住时可以点“给我一个提示”。完成后请孩子展示照片，说说自己选了什么、怎样拍到的。</p><span>当前体验无需登录，作品只保存在本机浏览器。约 3 分钟为设计目标，欢迎实际试用后一起调整。</span></aside>
    </main>
  )
}
