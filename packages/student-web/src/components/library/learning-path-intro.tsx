import Link from "next/link"
import { ArrowDown, ArrowRight, MoveUpRight } from "lucide-react"
import { LINES_HREF } from "@/lib/project-lines/catalog"
import styles from "./learning-path-intro.module.css"

const COPY = {
  zh: {
    eyebrow: "一条项目线，一个探索方向",
    title: "从 3 分钟开始，",
    continuation: "一步步深入一个领域。",
    body: "围绕同一个主题，边做项目边学知识。从第一件小作品，逐步走向自己的完整工程。",
    action: "发现我的项目线",
    example: "以太空探索为例",
    process: "你会怎样一步步学会",
    note: "从适合你的起点开始，每一站都能留下自己的作品。",
    steps: [
      { phase: "先体验", title: "3 分钟体验", action: "先动手，发现兴趣", outcome: "拍下第一张星球照片" },
      { phase: "学方法", title: "引导课程", action: "学方法，做小作品", outcome: "用观察写出驾驶规则" },
      { phase: "搭系统", title: "系统与挑战", action: "搭系统，测试改进", outcome: "组装并验证自己的探测车" },
      { phase: "做工程", title: "完整工程", action: "做工程，深入研究", outcome: "用探测车完成探索任务" },
    ],
  },
  en: {
    eyebrow: "ONE PROJECT LINE. A FIELD TO EXPLORE.",
    title: "Start with 3 minutes.",
    continuation: "Go deeper, one project at a time.",
    body: "Follow one theme and learn by making. Grow from a small first creation to a complete engineering project of your own.",
    action: "Find my project line",
    example: "An example: space exploration",
    process: "How your learning grows",
    note: "Choose a starting point that fits. Make something of your own at every stop.",
    steps: [
      { phase: "Explore", title: "3-minute experience", action: "Try it. Find your spark.", outcome: "Take your first world photo" },
      { phase: "Learn", title: "Guided course", action: "Learn a method. Make it.", outcome: "Turn observations into driving rules" },
      { phase: "Build", title: "Systems & challenges", action: "Build. Test. Improve.", outcome: "Assemble and test your rover" },
      { phase: "Engineer", title: "Full project", action: "Engineer. Investigate.", outcome: "Carry out a rover exploration mission" },
    ],
  },
}

export function LearningPathIntro({ locale }: { locale: "zh" | "en" }) {
  const c = COPY[locale]
  const image = "space-journey-arrows-v3"
  return (
    <section className={styles.journey} aria-labelledby="learning-path-title" data-learning-path>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{c.eyebrow}</p>
        <h2 id="learning-path-title"><span>{c.title}</span>{c.continuation}</h2>
        <p className={styles.body}>{c.body}</p>
        <Link href={LINES_HREF} className={styles.explore}>{c.action}<MoveUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <figure className={styles.figure}>
        <div className={styles.panorama} aria-hidden="true">
          {/* Static responsive WebP assets keep this illustration small without a second image-processing request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/library/learning-path/${image}-1440.webp`}
            srcSet={`/library/learning-path/${image}-960.webp 960w, /library/learning-path/${image}-1440.webp 1440w, /library/learning-path/${image}-2172.webp 2172w`}
            sizes="(min-width: 1312px) 954px, (min-width: 1060px) calc(100vw - 358px), calc(100vw - 64px)"
            width={2172} height={724} alt="" loading="lazy" decoding="async" />
        </div>
        <figcaption className={styles.caption}>
          <div className={styles.example}><span>{c.example} · {c.process}</span><span aria-hidden="true">{locale === "zh" ? "由浅入深" : "EASY TO ADVANCED"}<ArrowRight size={14} /></span></div>
          <div className={styles.vectorPanorama} aria-hidden="true" data-learning-process>
            {/* A native SVG stays sharp at every screen size; captions remain selectable HTML. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/library/learning-path/learning-process-v1.svg" width={1200} height={240} alt="" loading="lazy" decoding="async" />
          </div>
          <ol className={styles.steps}>
            {c.steps.map((step, index) => <li key={step.title}>
              <div className={`${styles.mobileArt} ${styles[`scene${index}`]}`} aria-hidden="true" />
              <div className={styles.stepCopy}>
                <h3>{step.phase}</h3>
                <p className={styles.kind}>{step.title}</p>
                <div className={`${styles.mobileVector} ${styles[`scene${index}`]}`} aria-hidden="true" />
                <p className={styles.outcome}>{step.outcome}</p>
              </div>
              {index < 3 && <ArrowDown className={styles.nextArrow} size={20} aria-hidden="true" />}
            </li>)}
          </ol>
          <p className={styles.note}>{c.note}</p>
        </figcaption>
      </figure>
    </section>
  )
}
